/**
 * เส้นกำลังยอมให้ P–M ของเสา ตามมาตรฐาน วสท. วิธีหน่วยแรงใช้งาน (มาจาก ACI 318-63 บทที่ 14)
 *
 * เส้นเป็นเส้นตรงสามช่วง:
 *  - ดึงควบคุม (P < Nb): M = Mo + (Mb − Mo)·P/Nb
 *  - อัดควบคุม (P ≥ Nb): fa/Fa + fb/Fb = 1 → M = S·Fb·(1 − P/(Ag·Fa))
 *  - ตัดที่แรงอัดตามแนวแกน Pa (สูตรเสารับแรงตามแนวแกน ซึ่งรวมการเยื้องศูนย์ขั้นต่ำไว้แล้ว)
 */
import { ACI318_WSD as C, ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';

/** y วัดจากจุดศูนย์ถ่วง เป็นบวกไปทางผิวรับอัด */
export interface FiberBar {
  y: number;
  area: number;
}

/** Ds = เส้นผ่านศูนย์กลางวงเหล็กยืนของเสากลม */
export type InteractionShape = { kind: 'rect'; width: number; depth: number } | { kind: 'circle'; D: number; Ds: number };

/** จุดบนเส้นกำลังที่ยอมให้ — M (kg·cm), P (kg) */
export interface PMPoint {
  M: number;
  P: number;
}

export interface InteractionCurve {
  /** เส้นกำลังยอมให้หลังคูณ R แล้ว เรียงจาก (0, Mo) ถึง (Pmax, 0) */
  points: PMPoint[];
  /** R·Pa */
  Pmax: number;
  /** ตัวคูณลดกำลังเสายาว */
  R: number;
  /** ค่าต่อไปนี้ยังไม่คูณ R — ใช้แสดงขั้นตอนคำนวณ */
  Pa: number;
  /** หน่วยแรงยอมให้ของเหล็กยืนในสูตรแรงอัดตามแนวแกน (ksc) */
  fsa: number;
  Fa: number;
  Fb: number;
  /** โมดูลัสหน้าตัดแปลงไม่แตกร้าว (ซม.³) */
  S: number;
  eb: number;
  Nb: number;
  Mb: number;
  Mo: number;
}

/** สูตรเสารับแรงตามแนวแกน: ปลอกเดี่ยว 0.85Ag(0.25f′c + fs·ρg), ปลอกเกลียว Ag(0.25f′c + fs·ρg) */
export function axialCapacity(Ag: number, Ast: number, fc: number, fy: number, spiral: boolean) {
  const fsa = Math.min(K.axialSteelRatio * fy, K.axialSteelMax);
  const Pa = (spiral ? 1 : K.tiedFactor) * (K.axialConcreteRatio * fc * Ag + fsa * Ast);
  return { fsa, Pa };
}

export function interactionCurve(
  shape: InteractionShape,
  bars: FiberBar[],
  fc: number,
  fy: number,
  spiral: boolean,
  R = 1,
): InteractionCurve {
  const t = shape.kind === 'rect' ? shape.depth : shape.D;
  const Ag = shape.kind === 'rect' ? shape.width * shape.depth : (Math.PI * shape.D ** 2) / 4;
  const Ast = bars.reduce((s, b) => s + b.area, 0);
  const rho = Ast / Ag;
  const m = fy / (0.85 * fc);
  const Fa = K.FaCoef * (1 + rho * m) * fc;
  const Fb = C.fcRatio * fc;

  const n = C.Es / (C.EcCoef * Math.sqrt(fc));
  const Ic = shape.kind === 'rect' ? (shape.width * shape.depth ** 3) / 12 : (Math.PI * shape.D ** 4) / 64;
  const I = Ic + (K.creepModularFactor * n - 1) * bars.reduce((s, b) => s + b.area * b.y * b.y, 0);
  const S = I / (t / 2);

  let eb: number;
  let Mo: number;
  if (shape.kind === 'circle') {
    eb = K.ebSpiralA * rho * m * shape.Ds + K.ebSpiralB * t;
    Mo = K.MoSpiral * Ast * fy * shape.Ds;
  } else {
    // เหล็กแถวนอกสุดด้านรับแรงดึง (ฝั่ง y ลบ) และด้านรับแรงอัด
    const yt = Math.max(0, ...bars.map((b) => -b.y));
    const yc = Math.max(0, ...bars.map((b) => b.y));
    const As = bars.filter((b) => -b.y >= yt - 0.5).reduce((s, b) => s + b.area, 0);
    eb = (K.ebTiedA * rho * m + K.ebTiedB) * (t / 2 + yt);
    Mo = K.MoTied * As * fy * (yt + yc);
  }

  const Nb = 1 / (1 / (Ag * Fa) + eb / (S * Fb));
  const Mb = Nb * eb;
  const { fsa, Pa } = axialCapacity(Ag, Ast, fc, fy, spiral);
  const Mcomp = (P: number) => Math.max(0, S * Fb * (1 - P / (Ag * Fa)));

  const raw: PMPoint[] = [{ P: 0, M: Mo }];
  if (Nb < Pa) raw.push({ P: Nb, M: Mb }, { P: Pa, M: Mcomp(Pa) });
  else raw.push({ P: Pa, M: Mo + ((Mb - Mo) * Pa) / Nb });
  raw.push({ P: Pa, M: 0 });

  return {
    points: raw.map((p) => ({ P: p.P * R, M: p.M * R })),
    Pmax: Pa * R,
    R, Pa, fsa, Fa, Fb, S, eb, Nb, Mb, Mo,
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
