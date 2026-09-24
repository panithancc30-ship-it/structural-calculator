/** Interaction diagram P–M ของหน้าตัดเสา (strain compatibility, Whitney stress block) */
import { ACI318_WSD as C, ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';

/** y วัดจากจุดศูนย์ถ่วง เป็นบวกไปทางผิวรับอัด */
export interface FiberBar {
  y: number;
  area: number;
}

export type InteractionShape = { kind: 'rect'; width: number; depth: number } | { kind: 'circle'; D: number };

/** จุดบนเส้นกำลังที่ยอมให้ — M (kg·cm), P (kg) */
export interface PMPoint {
  M: number;
  P: number;
}

export interface InteractionCurve {
  points: PMPoint[];
  /** 0.4·φ·Po */
  P0: number;
  /** 0.4·φ·Pn,max */
  Pmax: number;
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
    const fs = Math.max(-fy, Math.min(fy, (C.Es * K.epsCu * (c - dy)) / c));
    const F = bar.area * (fs - (dy < a ? 0.85 * fc : 0));
    Pn += F;
    Mn += F * bar.y;
  }
  return { Pn, Mn };
}

export function interactionCurve(
  shape: InteractionShape,
  bars: FiberBar[],
  fc: number,
  fy: number,
  spiral: boolean,
): InteractionCurve {
  const depth = shape.kind === 'rect' ? shape.depth : shape.D;
  const Ag = shape.kind === 'rect' ? shape.width * shape.depth : (Math.PI * shape.D ** 2) / 4;
  const Ast = bars.reduce((s, b) => s + b.area, 0);
  const Po = 0.85 * fc * (Ag - Ast) + fy * Ast;
  const PnMax = (spiral ? K.pmaxSpiral : K.pmaxTied) * Po;
  const factor = K.capacityFactor * (spiral ? K.phiSpiral : K.phiTied);

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

/** อัตราส่วนใช้งานตามรังสีจากจุดกำเนิดผ่านจุด (M, P) — ≤ 1 คือผ่าน */
export function rayUtilization(curve: InteractionCurve, M: number, P: number): number {
  const m = Math.abs(M);
  if (m < 1e-9 && P < 1e-9) return 0;
  let lambda = Infinity;
  const pts = curve.points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const ex = pts[i].M - a.M;
    const ey = pts[i].P - a.P;
    const den = m * ey - P * ex;
    if (Math.abs(den) < 1e-12) continue;
    const lam = (a.M * ey - a.P * ex) / den;
    const t = (a.M * P - a.P * m) / den;
    if (t >= -1e-9 && t <= 1 + 1e-9 && lam > 0) lambda = Math.min(lambda, lam);
  }
  return Number.isFinite(lambda) ? 1 / lambda : Infinity;
}

/** กำลังรับโมเมนต์ที่ยอมให้ ณ แรงอัด P */
export function momentCapacityAt(curve: InteractionCurve, P: number): number {
  if (P > curve.Pmax + 1e-9) return 0;
  let best = 0;
  const pts = curve.points;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const lo = Math.min(a.P, b.P);
    const hi = Math.max(a.P, b.P);
    if (P < lo - 1e-9 || P > hi + 1e-9) continue;
    const t = hi - lo < 1e-12 ? 0 : (P - a.P) / (b.P - a.P);
    best = Math.max(best, a.M + t * (b.M - a.M));
  }
  return best;
}
