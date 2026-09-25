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

export type StrengthMethod = 'axial' | 'uniaxial-x' | 'uniaxial-y' | 'resultant' | 'contour';

export const METHOD_TH: Record<StrengthMethod, string> = {
  axial: 'แรงอัดล้วน',
  'uniaxial-x': 'ดัดรอบแกน x',
  'uniaxial-y': 'ดัดรอบแกน y',
  resultant: 'โมเมนต์ลัพธ์',
  contour: 'Mx/Mcx + My/Mcy',
};

export interface ColumnAnalysis {
  geom: ColumnGeometry;
  spiral: boolean;
  rho: number;
  slender: { x: AxisSlenderness; y: AxisSlenderness };
  /** ตัวคูณลดกำลังเสายาว (ค่าน้อยสุดสองแกน) — รวมอยู่ใน curveX, curveY แล้ว */
  R: number;
  /** โมเมนต์แรงใช้งาน (kg·cm) */
  Mx: number;
  My: number;
  curveX: InteractionCurve;
  curveY: InteractionCurve;
  method: StrengthMethod;
  utilization: number;
  detail: { Mcx?: number; Mcy?: number };
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
  const rho = geom.Ast / geom.Ag;
  const P = Math.max(0, input.P);
  const sx = axisSlenderness(input, 'x', geom.depth.y);
  const sy = axisSlenderness(input, 'y', geom.depth.x);
  const R = Math.min(sx.R, sy.R);
  const Mx = Math.abs(input.Mx) * 100;
  const My = Math.abs(input.My) * 100;
  const sgnX = input.Mx < 0 ? -1 : 1;
  const sgnY = input.My < 0 ? -1 : 1;

  let curveX: InteractionCurve;
  let curveY: InteractionCurve;
  let method: StrengthMethod;
  let utilization: number;
  const detail: ColumnAnalysis['detail'] = {};

  if (spiral) {
    const M = Math.hypot(Mx, My);
    const ux = M > 0 ? My / M : 0;
    const uy = M > 0 ? Mx / M : 1;
    const fibers = geom.bars.map((b) => ({ area: b.area, y: sgnY * b.x * ux + sgnX * b.y * uy }));
    const Ds = 2 * Math.max(0, ...geom.bars.map((b) => Math.hypot(b.x, b.y)));
    curveX = interactionCurve({ kind: 'circle', D: input.D, Ds }, fibers, input.fc, input.fy, true, R);
    curveY = curveX;
    method = M < 1e-6 ? 'axial' : 'resultant';
    utilization = method === 'axial' ? P / curveX.Pmax : rayUtilization(curveX, M, P);
  } else {
    curveX = interactionCurve(
      { kind: 'rect', width: input.b, depth: input.h },
      geom.bars.map((b) => ({ area: b.area, y: sgnX * b.y })),
      input.fc, input.fy, false, R,
    );
    curveY = interactionCurve(
      { kind: 'rect', width: input.h, depth: input.b },
      geom.bars.map((b) => ({ area: b.area, y: sgnY * b.x })),
      input.fc, input.fy, false, R,
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
    } else {
      // ดัดสองแกน: fa/Fa + fbx/Fb + fby/Fb ≤ 1 (อัดควบคุม) เทียบเท่า Mx/Mcx + My/Mcy ≤ 1 ที่แรงอัด P เดียวกัน
      method = 'contour';
      const Pc = Math.min(P, curveX.Pmax);
      detail.Mcx = momentCapacityAt(curveX, Pc);
      detail.Mcy = momentCapacityAt(curveY, Pc);
      utilization = Math.max(P / curveX.Pmax, Mx / detail.Mcx + My / detail.Mcy);
    }
  }
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
    push('slenderness', `Lu/r แกน ${s.axis} (${s.slender ? 'เสายาว' : 'เสาสั้น'} ≤ ${fmt(s.limit, 1)})`,
      `≤ ${K.slenderMax}`, fmt(s.ratio, 1), okIf(!s.tooSlender));
  }
  if (R < 1) push('slenderness', 'ตัวคูณลดกำลังเสายาว R', '1.32 − 0.006·Lu/r', fmt(R, 3), 'ok');

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
  const c = curveX;
  const steps: CalcStep[] = [
    { label: 'Ag, Ast', formula: 'พื้นที่หน้าตัด, พื้นที่เหล็กยืน', value: `${fmt(geom.Ag, 0)}, ${fmt(geom.Ast)} ซม.²` },
    { label: 'ρg', formula: 'Ast / Ag', value: `${fmt(rho * 100)} %`, print: true },
    {
      label: 'Pa',
      formula: `${spiral ? '' : '0.85'}Ag(0.25f′c + fs·ρg), fs = 0.4fy ≤ ${fmt(K.axialSteelMax, 0)} = ${fmt(c.fsa, 0)} ksc`,
      value: `${ton(c.Pa)} ตัน`,
      print: true,
    },
  ];
  for (const s of [sx, sy]) {
    steps.push({ label: `Lu/r (${s.axis})`, formula: `${fmt(input.Lu * 100, 0)} / ${fmt(s.r, 1)}`, value: fmt(s.ratio, 1), print: true });
  }
  if (R < 1) {
    steps.push(
      { label: 'R เสายาว', formula: '1.32 − 0.006·Lu/r (Lu/r มากสุด)', value: fmt(R, 3), print: true },
      { label: 'P ยอมให้', formula: 'R·Pa', value: `${ton(c.Pmax)} ตัน`, print: true },
    );
  }
  steps.push({ label: 'Mx, My', formula: 'แรงใช้งาน', value: `${tm(Mx)}, ${tm(My)} t·m`, print: true });
  if (method !== 'axial') {
    steps.push({ label: 'Fa', formula: '0.34(1 + ρg·m)f′c, m = fy/0.85f′c', value: `${fmt(c.Fa, 1)} ksc` });
    const axes: [string, InteractionCurve][] = spiral ? [['', curveX]] : [['x', curveX], ['y', curveY]];
    for (const [ax, cv] of axes) {
      if ((ax === 'x' && Mx < 1e-6) || (ax === 'y' && My < 1e-6)) continue;
      const tag = ax ? ` (${ax})` : '';
      steps.push(
        { label: `S${tag}`, formula: 'หน้าตัดแปลงไม่แตกร้าว เหล็ก (2n − 1)As', value: `${fmt(cv.S, 0)} ซม.³` },
        {
          label: `eb${tag}`,
          formula: spiral ? '0.43ρg·m·Ds + 0.14t' : '(0.67ρg·m + 0.17)d',
          value: `${fmt(cv.eb, 1)} ซม.`,
        },
        { label: `Nb, Mb${tag}`, formula: 'fa/Fa + fb/Fb = 1 ที่ e = eb', value: `${ton(cv.Nb)} ตัน, ${tm(cv.Mb)} t·m`, print: true },
        { label: `Mo${tag}`, formula: spiral ? '0.12Ast·fy·Ds' : '0.40As·fy(d − d′)', value: `${tm(cv.Mo)} t·m`, print: true },
      );
    }
  }
  if (method === 'contour') {
    steps.push({ label: 'Mcx, Mcy', formula: 'กำลังโมเมนต์ยอมให้ที่ P', value: `${tm(detail.Mcx!)}, ${tm(detail.Mcy!)} t·m`, print: true });
  }
  steps.push({ label: 'อัตราส่วนใช้งาน', formula: METHOD_TH[method], value: Number.isFinite(utilization) ? fmt(utilization, 2) : '—', print: true });
  if (tie) steps.push({ label: 's ปลอก max', formula: 'min(16db, 48dt, ด้านแคบ)', value: `${fmt(tie.sMax, 1)} ซม.`, print: true });
  if (spiralReq) {
    steps.push({ label: 'ρs,min', formula: "0.45(Ag/Ac − 1)f′c/fy", value: fmt(spiralReq.rhoMin, 4), print: true });
  }

  return {
    geom, spiral, rho, slender: { x: sx, y: sy }, R, Mx, My, curveX, curveY,
    method, utilization, detail, tie, spiralReq, checks, steps, status: worstStatus(checks),
  };
}
