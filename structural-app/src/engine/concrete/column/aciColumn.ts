/**
 * กำลังเสาตาม ACI 318-89 Appendix A.6 (Alternate Design Method)
 * กำลังยอมให้ = 40% ของกำลังตาม Chapter 10 (strain compatibility, Whitney stress block, รวม φ)
 * ผลความชะลูด: moment magnifier ตาม 10.10–10.11 โดยใช้ 2.5 เท่าของแรงใช้งานแทน Pu
 * ดัดสองแกน: Bresler เมื่อ Pn ≥ 0.1f′cAg, ต่ำกว่านั้นใช้ Mx/Mcx + My/Mcy ≤ 1
 */
import { ACI318_WSD as C, ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';
import { ACI_ADM } from '../codes/designCode';
import { fmt } from '../format';
import type { CalcStep } from '../types';
import type { ColumnGeometry } from './geometry';
import { momentCapacityAt, rayUtilization, type FiberBar, type InteractionShape, type PMCurve, type PMPoint } from './interaction';
import type { SlendernessInfo } from './slenderness';
import type { ColumnInput } from './types';

const A = ACI_ADM.column;

export interface AciCurve extends PMCurve {
  /** 0.4·φ·Po */
  P0: number;
  /** 0.4·φ — ตัวคูณจากกำลังระบุ → กำลังยอมให้ */
  factor: number;
}

export function beta1(fc: number): number {
  return Math.min(0.85, Math.max(0.65, 0.85 - (0.05 * (fc - 280)) / 70));
}

function compressionBlock(shape: InteractionShape, a: number): { area: number; yc: number } {
  if (shape.kind === 'rect') {
    const aa = Math.min(Math.max(a, 0), shape.depth);
    return { area: shape.width * aa, yc: shape.depth / 2 - aa / 2 };
  }
  const R = shape.D / 2;
  const aa = Math.min(Math.max(a, 0), shape.D);
  if (aa <= 0) return { area: 0, yc: 0 };
  if (aa >= shape.D) return { area: Math.PI * R * R, yc: 0 };
  const theta = 2 * Math.acos((R - aa) / R);
  const seg = theta - Math.sin(theta);
  return { area: (R * R * seg) / 2, yc: (4 * R * Math.sin(theta / 2) ** 3) / (3 * seg) };
}

/** กำลังระบุ (Pn, Mn) ที่ความลึกแกนสะเทิน c */
export function nominalPoint(shape: InteractionShape, bars: FiberBar[], fc: number, fy: number, c: number) {
  const H = shape.kind === 'rect' ? shape.depth / 2 : shape.D / 2;
  const a = Math.min(beta1(fc) * c, 2 * H);
  const block = compressionBlock(shape, a);
  let Pn = 0.85 * fc * block.area;
  let Mn = Pn * block.yc;
  for (const bar of bars) {
    const dy = H - bar.y;
    const fs = Math.max(-fy, Math.min(fy, (C.Es * A.epsCu * (c - dy)) / c));
    const F = bar.area * (fs - (dy < a ? 0.85 * fc : 0));
    Pn += F;
    Mn += F * bar.y;
  }
  return { Pn, Mn };
}

/** เส้นกำลังยอมให้ = 0.4·φ × เส้นกำลังระบุ ตัดที่ Pn,max */
export function aciInteractionCurve(shape: InteractionShape, bars: FiberBar[], fc: number, fy: number, spiral: boolean): AciCurve {
  const depth = shape.kind === 'rect' ? shape.depth : shape.D;
  const Ag = shape.kind === 'rect' ? shape.width * shape.depth : (Math.PI * shape.D ** 2) / 4;
  const Ast = bars.reduce((s, b) => s + b.area, 0);
  const Po = 0.85 * fc * (Ag - Ast) + fy * Ast;
  const PnMax = (spiral ? A.pmaxSpiral : A.pmaxTied) * Po;
  const factor = A.capacityFactor * (spiral ? A.phiSpiral : A.phiTied);

  const N = 180;
  const raw = Array.from({ length: N + 1 }, (_, i) => nominalPoint(shape, bars, fc, fy, depth * 0.01 * Math.pow(2000, i / N)));

  const nominal: PMPoint[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    const prev = raw[i - 1];
    if (p.Pn < 0) continue;
    if (nominal.length === 0) {
      if (prev) {
        const t = -prev.Pn / (p.Pn - prev.Pn);
        nominal.push({ P: 0, M: prev.Mn + t * (p.Mn - prev.Mn) });
      } else {
        nominal.push({ P: 0, M: p.Mn });
      }
    }
    if (p.Pn >= PnMax) {
      const q = prev && prev.Pn < PnMax ? prev : p;
      const t = q === p ? 0 : (PnMax - q.Pn) / (p.Pn - q.Pn);
      nominal.push({ P: PnMax, M: q.Mn + t * (p.Mn - q.Mn) });
      break;
    }
    nominal.push({ P: p.Pn, M: p.Mn });
  }
  nominal.push({ P: PnMax, M: 0 });

  return {
    points: nominal.map((pt) => ({ P: pt.P * factor, M: Math.max(0, pt.M) * factor })),
    P0: Po * factor,
    Pmax: PnMax * factor,
    factor,
  };
}

export interface AciSlenderness extends SlendernessInfo {
  k: number;
  EI: number;
  Pc: number;
  Cm: number;
  delta: number;
  stable: boolean;
  /** kg·cm */
  Mapplied: number;
  Mmin: number;
  Mdesign: number;
}

/**
 * k, M1/M2 และ βd ใช้ค่ากำหนดอัตโนมัติ (ACI_ADM.column.autoK, autoM1M2, autoBetaD)
 * @param axis 'x' = ดัดรอบแกน x (ใช้ความลึก h), 'y' = รอบแกน y (ใช้ b)
 * @param depth ขนาดหน้าตัดในทิศที่ดัด (ซม.)
 */
export function aciAxisSlenderness(input: ColumnInput, axis: 'x' | 'y', Ig: number, depth: number, phi: number): AciSlenderness {
  const Lu = input.Lu * 100;
  const k = A.autoK;
  const r = input.shape === 'circle' ? K.radiusGyrationCircle * input.D : K.radiusGyrationRect * depth;
  const ratio = (k * Lu) / r;
  const limit = A.slenderBracedA - A.slenderBracedB * A.autoM1M2;
  const Mapplied = Math.abs(axis === 'x' ? input.Mx : input.My) * 100;
  const Ec = C.EcCoef * Math.sqrt(input.fc);
  const EI = (A.EIcoef * Ec * Ig) / (1 + A.autoBetaD);
  const Pc = (Math.PI ** 2 * EI) / (k * Lu) ** 2;
  const slender = ratio > limit;

  let Cm = 1;
  let delta = 1;
  let stable = true;
  let Mmin = 0;
  let Mdesign = Mapplied;
  if (slender) {
    Cm = Math.max(A.CmMin, 0.6 + 0.4 * A.autoM1M2);
    const q = (A.slendernessLoadFactor * input.P) / (phi * Pc);
    stable = q < 1;
    delta = stable ? Math.max(1, Cm / (1 - q)) : Infinity;
    Mmin = input.P * (A.minEccBase + A.minEccCoef * depth);
    Mdesign = delta * Math.max(Mapplied, Mmin);
  }

  return {
    axis, k, r, ratio, limit, slender,
    tooSlender: ratio > A.slenderMax,
    EI, Pc, Cm, delta, stable, Mapplied, Mmin, Mdesign,
  };
}

export type AciMethod = 'axial' | 'uniaxial-x' | 'uniaxial-y' | 'resultant' | 'bresler' | 'contour';

export interface SlenderRow {
  label: string;
  required: string;
  provided: string;
  ok: boolean;
}

const ton = (kg: number) => fmt(kg / 1000, 2);
const tm = (kgcm: number) => fmt(kgcm / 1e5, 2);

/** กำลัง ความชะลูด และขั้นตอนคำนวณของเสาตาม ACI (ส่วนที่ต่างจาก วสท.) */
export function aciColumnStrength(input: ColumnInput, geom: ColumnGeometry, spiral: boolean, methodText: (m: AciMethod) => string) {
  const phi = spiral ? A.phiSpiral : A.phiTied;
  const P = Math.max(0, input.P);
  const sx = aciAxisSlenderness(input, 'x', geom.Ig.x, geom.depth.y, phi);
  const sy = aciAxisSlenderness(input, 'y', geom.Ig.y, geom.depth.x, phi);
  const Mx = sx.Mdesign;
  const My = sy.Mdesign;
  const sgnX = input.Mx < 0 ? -1 : 1;
  const sgnY = input.My < 0 ? -1 : 1;
  const finite = Number.isFinite(Mx) && Number.isFinite(My);

  let curveX: AciCurve;
  let curveY: AciCurve;
  let method: AciMethod;
  let utilization: number;
  const detail: { Px?: number; Py?: number; P0?: number; Pi?: number; Mcx?: number; Mcy?: number } = {};

  if (spiral) {
    const M = finite ? Math.hypot(Mx, My) : 0;
    const ux = M > 0 ? My / M : 0;
    const uy = M > 0 ? Mx / M : 1;
    const fibers = geom.bars.map((b) => ({ area: b.area, y: sgnY * b.x * ux + sgnX * b.y * uy }));
    curveX = aciInteractionCurve({ kind: 'circle', D: input.D, Ds: 0 }, fibers, input.fc, input.fy, true);
    curveY = curveX;
    method = M < 1e-6 ? 'axial' : 'resultant';
    utilization = method === 'axial' ? P / curveX.Pmax : rayUtilization(curveX, M, P);
  } else {
    curveX = aciInteractionCurve(
      { kind: 'rect', width: input.b, depth: input.h },
      geom.bars.map((b) => ({ area: b.area, y: sgnX * b.y })),
      input.fc, input.fy, false,
    );
    curveY = aciInteractionCurve(
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
    } else if (P / curveX.factor >= A.breslerAxialRatio * input.fc * geom.Ag) {
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

  const slenderRows: SlenderRow[] = [];
  for (const s of [sx, sy]) {
    slenderRows.push({
      label: `kLu/r แกน ${s.axis} (${s.slender ? 'เสายาว' : 'เสาสั้น'} ≤ ${fmt(s.limit, 1)})`,
      required: `≤ ${A.slenderMax}`,
      provided: fmt(s.ratio, 1),
      ok: !s.tooSlender,
    });
    if (s.slender) {
      slenderRows.push({
        label: `ตัวขยายโมเมนต์ δ แกน ${s.axis}`,
        required: '2.5P < φPc',
        provided: s.stable ? fmt(s.delta, 2) : 'ไม่เสถียร',
        ok: s.stable,
      });
    }
  }

  const Po = curveX.P0 / curveX.factor;
  const steps: CalcStep[] = [
    { label: 'Po', formula: '0.85f′c(Ag − Ast) + fy·Ast', value: `${ton(Po)} ตัน` },
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
  steps.push({ label: 'อัตราส่วนใช้งาน', formula: methodText(method), value: Number.isFinite(utilization) ? fmt(utilization, 2) : '—', print: true });

  return { slender: { x: sx, y: sy }, delta: Math.max(sx.delta, sy.delta), Mx, My, curveX, curveY, method, utilization, detail, slenderRows, steps };
}
