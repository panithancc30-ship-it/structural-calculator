import { ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';
import { worstStatus } from '../design/sectionCheck';
import { fmt } from '../format';
import { REBARS } from '../rebar';
import type { CalcStep, CheckItem, CheckStatus } from '../types';
import { columnGeometry, type ColumnGeometry, type FaceSpacing } from './geometry';
import { interactionCurve, momentCapacityAt, rayUtilization, type InteractionCurve } from './interaction';
import { axisSlenderness, type AxisSlenderness } from './slenderness';
import { spiralRequirement, spiralRho, tieRequirement, type SpiralRequirement, type TieRequirement } from './transverse';
import type { ColumnInput, ColumnLayout } from './types';

export type StrengthMethod = 'axial' | 'uniaxial-x' | 'uniaxial-y' | 'resultant' | 'bresler' | 'contour';

export const METHOD_TH: Record<StrengthMethod, string> = {
  axial: 'แรงอัดล้วน',
  'uniaxial-x': 'ดัดรอบแกน x',
  'uniaxial-y': 'ดัดรอบแกน y',
  resultant: 'โมเมนต์ลัพธ์',
  bresler: 'Bresler',
  contour: 'Mx/Mcx + My/Mcy',
};

export interface ColumnAnalysis {
  geom: ColumnGeometry;
  spiral: boolean;
  phi: number;
  rho: number;
  slender: { x: AxisSlenderness; y: AxisSlenderness };
  /** โมเมนต์ออกแบบหลังขยายผลความชะลูด (kg·cm) */
  Mx: number;
  My: number;
  curveX: InteractionCurve;
  curveY: InteractionCurve;
  method: StrengthMethod;
  utilization: number;
  detail: { Px?: number; Py?: number; P0?: number; Pi?: number; Mcx?: number; Mcy?: number };
  tie: TieRequirement | null;
  spiralReq: SpiralRequirement | null;
  checks: CheckItem[];
  steps: CalcStep[];
  status: CheckStatus;
}

const ton = (kg: number) => fmt(kg / 1000, 2);
const tm = (kgcm: number) => fmt(kgcm / 1e5, 2);
const FACE_TH: Record<FaceSpacing['face'], string> = {
  corner: 'มุม', top: 'ด้านบน', bottom: 'ด้านล่าง', left: 'ด้านซ้าย', right: 'ด้านขวา', ring: 'รอบวง',
};

export function analyzeColumn(input: ColumnInput, layout: ColumnLayout): ColumnAnalysis {
  const geom = columnGeometry(input, layout);
  const spiral = layout.kind === 'circle';
  const phi = spiral ? K.phiSpiral : K.phiTied;
  const rho = geom.Ast / geom.Ag;
  const P = Math.max(0, input.P);
  const sx = axisSlenderness(input, 'x', geom.Ig.x, geom.depth.y, phi);
  const sy = axisSlenderness(input, 'y', geom.Ig.y, geom.depth.x, phi);
  const Mx = sx.Mdesign;
  const My = sy.Mdesign;
  const sgnX = input.Mx < 0 ? -1 : 1;
  const sgnY = input.My < 0 ? -1 : 1;
  const finite = Number.isFinite(Mx) && Number.isFinite(My);

  let curveX: InteractionCurve;
  let curveY: InteractionCurve;
  let method: StrengthMethod;
  let utilization: number;
  const detail: ColumnAnalysis['detail'] = {};

  if (spiral) {
    const M = finite ? Math.hypot(Mx, My) : 0;
    const ux = M > 0 ? My / M : 0;
    const uy = M > 0 ? Mx / M : 1;
    const fibers = geom.bars.map((b) => ({ area: b.area, y: sgnY * b.x * ux + sgnX * b.y * uy }));
    curveX = interactionCurve({ kind: 'circle', D: input.D }, fibers, input.fc, input.fy, true);
    curveY = curveX;
    method = M < 1e-6 ? 'axial' : 'resultant';
    utilization = method === 'axial' ? P / curveX.Pmax : rayUtilization(curveX, M, P);
  } else {
    curveX = interactionCurve(
      { kind: 'rect', width: input.b, depth: input.h },
      geom.bars.map((b) => ({ area: b.area, y: sgnX * b.y })),
      input.fc, input.fy, false,
    );
    curveY = interactionCurve(
      { kind: 'rect', width: input.h, depth: input.b },
      geom.bars.map((b) => ({ area: b.area, y: sgnY * b.x })),
      input.fc, input.fy, false,
    );
    const tiny = 1e-6;
    if (Mx < tiny && My < tiny) {
      method = 'axial';
      utilization = P / curveX.Pmax;
    } else if (My <= tiny * Math.max(1, Mx)) {
      method = 'uniaxial-x';
      utilization = rayUtilization(curveX, Mx, P);
    } else if (Mx <= tiny * Math.max(1, My)) {
      method = 'uniaxial-y';
      utilization = rayUtilization(curveY, My, P);
    } else if (P / curveX.factor >= K.breslerAxialRatio * input.fc * geom.Ag) {
      method = 'bresler';
      detail.Px = P / rayUtilization(curveX, Mx, P);
      detail.Py = P / rayUtilization(curveY, My, P);
      detail.P0 = curveX.P0;
      const inv = 1 / detail.Px + 1 / detail.Py - 1 / detail.P0;
      detail.Pi = inv > 0 ? 1 / inv : 0;
      utilization = detail.Pi > 0 ? P / detail.Pi : Infinity;
    } else {
      method = 'contour';
      detail.Mcx = momentCapacityAt(curveX, P);
      detail.Mcy = momentCapacityAt(curveY, P);
      utilization = Mx / detail.Mcx + My / detail.Mcy;
    }
  }
  if (!finite) utilization = Infinity;

  const tie = spiral ? null : tieRequirement(input, geom, layout.tie.size);
  const spiralReq = spiral ? spiralRequirement(input, layout.tie.size) : null;

  // ---------- ตรวจสอบ ----------
  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, provided: string, status: CheckStatus) =>
    checks.push({ id: `C-${checks.length}`, group, label, required, provided, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);

  push('strength', 'แรงอัด P (ตัน)', `≤ ${ton(curveX.Pmax)}`, ton(P), okIf(P <= curveX.Pmax * 1.0001));
  push('strength', `อัตราส่วนใช้งาน (${METHOD_TH[method]})`, '≤ 1.00',
    Number.isFinite(utilization) ? fmt(utilization, 2) : '—', okIf(utilization <= 1.0001));

  for (const s of [sx, sy]) {
    push('slenderness', `kLu/r แกน ${s.axis} (${s.slender ? 'เสายาว' : 'เสาสั้น'} ≤ ${fmt(s.limit, 1)})`,
      `≤ ${K.slenderMax}`, fmt(s.ratio, 1), okIf(!s.tooSlender));
    if (s.slender) {
      push('slenderness', `ตัวขยายโมเมนต์ δ แกน ${s.axis}`, '2.5P < φPc', s.stable ? fmt(s.delta, 2) : 'ไม่เสถียร', okIf(s.stable));
    }
  }

  const minBars = spiral ? K.minBarsSpiral : K.minBarsRect;
  push('detail', 'อัตราส่วนเหล็ก ρg (%)', `${fmt(K.rhoMin * 100)} – ${fmt(K.rhoMax * 100)}`, fmt(rho * 100),
    okIf(rho + 1e-9 >= K.rhoMin && rho <= K.rhoMax + 1e-9));
  push('detail', 'จำนวนเหล็กยืน (เส้น)', `≥ ${minBars}`, `${geom.bars.length}`, okIf(geom.bars.length >= minBars));
  for (const sp of geom.spacing) {
    push('detail', `ช่องว่างเหล็ก${FACE_TH[sp.face]} (ซม.)`, `≥ ${fmt(sp.required, 1)}`, fmt(sp.minClear, 1), okIf(sp.ok));
  }

  const dt = REBARS[layout.tie.size].dia;
  if (tie) {
    push('transverse', 'ขนาดเหล็กปลอก (มม.)', `≥ ${fmt(tie.minDia * 10, 0)}`, fmt(dt * 10, 0), okIf(dt + 1e-9 >= tie.minDia));
    push('transverse', 'ระยะเหล็กปลอก (ซม.)', `≤ ${fmt(tie.sMax, 1)}`, fmt(layout.tie.spacing, 1), okIf(layout.tie.spacing <= tie.sMax + 1e-9));
  }
  if (spiralReq) {
    const rhoS = spiralRho(input, layout.tie.size, layout.tie.spacing);
    const clear = layout.tie.spacing - dt;
    push('transverse', 'ขนาดเหล็กเกลียว (มม.)', `≥ ${fmt(spiralReq.minDia * 10, 0)}`, fmt(dt * 10, 0), okIf(dt + 1e-9 >= spiralReq.minDia));
    push('transverse', 'อัตราส่วนเหล็กเกลียว ρs', `≥ ${fmt(spiralReq.rhoMin, 4)}`, fmt(rhoS, 4), okIf(rhoS + 1e-9 >= spiralReq.rhoMin));
    push('transverse', 'ช่องว่างระหว่างเกลียว (ซม.)', `${fmt(K.spiralClearMin, 1)} – ${fmt(K.spiralClearMax, 1)}`, fmt(clear, 1),
      okIf(clear + 1e-9 >= K.spiralClearMin && clear <= K.spiralClearMax + 1e-9));
  }

  // ---------- ขั้นตอนคำนวณ ----------
  const Po = curveX.P0 / curveX.factor;
  const steps: CalcStep[] = [
    { label: 'Ag, Ast', formula: 'พื้นที่หน้าตัด, พื้นที่เหล็กยืน', value: `${fmt(geom.Ag, 0)}, ${fmt(geom.Ast)} ซม.²` },
    { label: 'ρg', formula: 'Ast / Ag', value: `${fmt(rho * 100)} %`, print: true },
    { label: 'Po', formula: "0.85f′c(Ag − Ast) + fy·Ast", value: `${ton(Po)} ตัน` },
    { label: 'P ยอมให้', formula: `0.4·φ·${spiral ? '0.85' : '0.80'}Po, φ = ${phi}`, value: `${ton(curveX.Pmax)} ตัน`, print: true },
  ];
  for (const s of [sx, sy]) {
    steps.push({ label: `kLu/r (${s.axis})`, formula: `${fmt(s.k, 2)}·${fmt(input.Lu * 100, 0)} / ${fmt(s.r, 1)}`, value: fmt(s.ratio, 1), print: true });
    if (s.slender) {
      steps.push(
        { label: `Pc (${s.axis})`, formula: 'π²EI/(kLu)², EI = 0.4EcIg/(1+βd)', value: `${ton(s.Pc)} ตัน` },
        { label: `δ (${s.axis})`, formula: `Cm/(1 − 2.5P/φPc), Cm = ${fmt(s.Cm, 2)}`, value: s.stable ? fmt(s.delta, 2) : 'ไม่เสถียร', print: true },
      );
    }
  }
  steps.push(
    { label: 'Mx ออกแบบ', formula: sx.slender ? 'δ·max(Mx, P·emin)' : 'Mx', value: `${Number.isFinite(Mx) ? tm(Mx) : '—'} t·m`, print: true },
    { label: 'My ออกแบบ', formula: sy.slender ? 'δ·max(My, P·emin)' : 'My', value: `${Number.isFinite(My) ? tm(My) : '—'} t·m`, print: true },
  );
  if (method === 'bresler') {
    steps.push(
      { label: 'Px, Py', formula: 'กำลังยอมให้ที่ ey, ex เดี่ยว', value: `${ton(detail.Px!)}, ${ton(detail.Py!)} ตัน` },
      { label: 'Pi', formula: '1/(1/Px + 1/Py − 1/Po)', value: `${ton(detail.Pi!)} ตัน`, print: true },
    );
  } else if (method === 'contour') {
    steps.push({ label: 'Mcx, Mcy', formula: 'กำลังโมเมนต์ยอมให้ที่ P', value: `${tm(detail.Mcx!)}, ${tm(detail.Mcy!)} t·m`, print: true });
  }
  steps.push({ label: 'อัตราส่วนใช้งาน', formula: METHOD_TH[method], value: Number.isFinite(utilization) ? fmt(utilization, 2) : '—', print: true });
  if (tie) steps.push({ label: 's ปลอก max', formula: 'min(16db, 48dt, ด้านแคบ)', value: `${fmt(tie.sMax, 1)} ซม.`, print: true });
  if (spiralReq) {
    steps.push({ label: 'ρs,min', formula: "0.45(Ag/Ac − 1)f′c/fy", value: fmt(spiralReq.rhoMin, 4), print: true });
  }

  return {
    geom, spiral, phi, rho, slender: { x: sx, y: sy }, Mx, My, curveX, curveY,
    method, utilization, detail, tie, spiralReq, checks, steps, status: worstStatus(checks),
  };
}
