import { ACI318_WSD_PILECAP as K } from '../codes/aci318Wsd';
import type { Pt } from '../footing/polygon';
import type { PileArrangement, PileCapDims, PileCapInput } from './types';

const H = Math.sqrt(3) / 2;

/** รูปแบบเสาเข็มมาตรฐาน (หน่วย = ระยะห่างเข็ม s) — ทุกต้นห่างกันไม่น้อยกว่า s */
const PATTERNS: Pt[][] = [
  [],
  [{ x: 0, y: 0 }],
  [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }],
  [{ x: -0.5, y: -H / 2 }, { x: 0.5, y: -H / 2 }, { x: 0, y: H / 2 }],
  [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: -0.5, y: 0.5 }, { x: 0.5, y: 0.5 }],
  [{ x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, { x: 0, y: 0 }, { x: -Math.SQRT1_2, y: Math.SQRT1_2 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 }],
  [{ x: -1, y: -0.5 }, { x: 0, y: -0.5 }, { x: 1, y: -0.5 }, { x: -1, y: 0.5 }, { x: 0, y: 0.5 }, { x: 1, y: 0.5 }],
  [{ x: -0.5, y: -H }, { x: 0.5, y: -H }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -0.5, y: H }, { x: 0.5, y: H }],
  [{ x: -1, y: -H }, { x: 0, y: -H }, { x: 1, y: -H }, { x: -0.5, y: 0 }, { x: 0.5, y: 0 }, { x: -1, y: H }, { x: 0, y: H }, { x: 1, y: H }],
  [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y }))),
];

export const PILE_COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** รูปแบบที่หมุน 90° แล้วต่างจากเดิม */
export const canRotate = (count: number) => [2, 3, 6, 8].includes(count);

type PlanInput = Pick<PileCapInput, 'spacing' | 'edge' | 'cx' | 'cy' | 'offsets' | 'ex' | 'ey'>;

export interface PileLayout {
  arrangement: PileArrangement;
  dims: Pick<PileCapDims, 'B' | 'L'>;
  /** ตำแหน่งตามแบบ (ศูนย์ฐานรากที่จุดกำเนิด) */
  nominal: Pt[];
  /** ตำแหน่งจริงหลังตอก */
  actual: Pt[];
  /** ศูนย์ถ่วงกลุ่มเข็มตามแบบ */
  groupCenter: Pt;
  /** ศูนย์เสา */
  column: Pt;
}

/** ตำแหน่งเข็มตามแบบ + ขนาดแปลนฐานราก (กรอบเข็ม + ระยะขอบ ขยายให้คลุมเสาที่เยื้องศูนย์, ปัดขึ้นทีละ 5 ซม. เท่ากันสองข้าง) */
export function pileLayout(input: PlanInput, arrangement: PileArrangement): PileLayout {
  const unit = PATTERNS[arrangement.count] ?? PATTERNS[1];
  const raw = unit.map((p) => (arrangement.rotate ? { x: -p.y * input.spacing, y: p.x * input.spacing } : { x: p.x * input.spacing, y: p.y * input.spacing }));
  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const mx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const nominal = raw.map((p) => ({ x: p.x - mx, y: p.y - my }));
  const step = K.sizeStep;
  const groupCenter = centroid(nominal);
  const column = { x: groupCenter.x + input.ex, y: groupCenter.y + input.ey };
  const span = (v: number[], c: number, size: number) =>
    Math.ceil(Math.max(Math.max(...v) - Math.min(...v) + 2 * input.edge, 2 * Math.abs(c) + size) / step - 1e-9) * step;
  return {
    arrangement,
    dims: { B: span(xs, column.x, input.cx), L: span(ys, column.y, input.cy) },
    nominal,
    actual: nominal.map((p, i) => ({ x: p.x + (input.offsets[i]?.dx ?? 0), y: p.y + (input.offsets[i]?.dy ?? 0) })),
    groupCenter,
    column,
  };
}

export function centroid(pts: Pt[]): Pt {
  const n = Math.max(1, pts.length);
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

/** แรงกระทำแนวดิ่ง (kg) ที่ตำแหน่ง (x, y) */
export interface PointLoad {
  F: number;
  x: number;
  y: number;
}

export interface PileReactions {
  /** แรงในเข็มแต่ละต้น (kg) บวก = อัด */
  R: number[];
  N: number;
  /** ศูนย์ถ่วงกลุ่มเข็มจริง */
  xg: number;
  yg: number;
  /** โมเมนต์รอบศูนย์ถ่วงกลุ่มเข็มจริง (kg·cm): My ทำให้แรงเปลี่ยนตาม x, Mx ตาม y */
  MyG: number;
  MxG: number;
  /** ระยะเยื้องของแรงลัพธ์จากศูนย์ถ่วงกลุ่มเข็ม (ซม.) */
  exG: number;
  eyG: number;
  Ixx: number;
  Iyy: number;
  Ixy: number;
  /** ขนาดโมเมนต์ที่กลุ่มเข็มรับไม่ได้ (เข็มต้นเดียว / แถวเดียว) (kg·cm) */
  unresisted: number;
}

/**
 * ฐานรากแข็ง: R = N/n + a·x′ + b·y′ โดย [Σx′² Σx′y′; Σx′y′ Σy′²]·[a; b] = [My; Mx] (รองรับกลุ่มเข็มไม่สมมาตรจากการเยื้อง)
 * เข็มแถวเดียว: รับได้เฉพาะโมเมนต์ตามแนวแถว ส่วนตั้งฉากรายงานเป็น unresisted
 */
export function pileReactions(piles: Pt[], loads: PointLoad[], Mx: number, My: number): PileReactions {
  const n = piles.length;
  const { x: xg, y: yg } = centroid(piles);
  const N = loads.reduce((s, l) => s + l.F, 0);
  const MyG = My + loads.reduce((s, l) => s + l.F * (l.x - xg), 0);
  const MxG = Mx + loads.reduce((s, l) => s + l.F * (l.y - yg), 0);
  const dx = piles.map((p) => p.x - xg);
  const dy = piles.map((p) => p.y - yg);
  const Ixx = dx.reduce((s, v) => s + v * v, 0);
  const Iyy = dy.reduce((s, v) => s + v * v, 0);
  const Ixy = dx.reduce((s, v, i) => s + v * dy[i], 0);
  const scale = Ixx + Iyy;
  const det = Ixx * Iyy - Ixy * Ixy;

  let a = 0;
  let b = 0;
  let unresisted = 0;
  if (scale < 1e-6) {
    unresisted = Math.hypot(MxG, MyG);
  } else if (det < 1e-9 * scale * scale) {
    // เข็มอยู่ในแนวเส้นตรง: ทิศแนวเส้น u (ค่าเฉพาะของเมทริกซ์ความเฉื่อย)
    const theta = 0.5 * Math.atan2(2 * Ixy, Ixx - Iyy);
    const ux = Math.cos(theta);
    const uy = Math.sin(theta);
    const along = MyG * ux + MxG * uy;
    const I = scale;
    a = (along * ux) / I;
    b = (along * uy) / I;
    unresisted = Math.abs(-MyG * uy + MxG * ux);
  } else {
    a = (MyG * Iyy - MxG * Ixy) / det;
    b = (MxG * Ixx - MyG * Ixy) / det;
  }
  return {
    R: dx.map((x, i) => N / n + a * x + b * dy[i]),
    N, xg, yg, MyG, MxG,
    exG: N !== 0 ? MyG / N : 0,
    eyG: N !== 0 ? MxG / N : 0,
    Ixx, Iyy, Ixy, unresisted,
  };
}

/** ระยะจากเส้นขอบรูปสี่เหลี่ยมถึงศูนย์เข็ม: บวก = อยู่นอกกรอบ, ลบ = อยู่ในกรอบ */
export function outsideDistance(p: Pt, x1: number, x2: number, y1: number, y2: number): number {
  return Math.max(x1 - p.x, p.x - x2, y1 - p.y, p.y - y2);
}

/** สัดส่วนแรงเข็มที่คิดว่าอยู่นอกหน้าตัดวิกฤต (ACI 15.5.4) */
export function outsideShare(distance: number, pileSize: number): number {
  return Math.min(1, Math.max(0, distance / pileSize + K.pileShareHalfWidth));
}
