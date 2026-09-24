import { ACI318_WSD_SLAB as KS, ACI318_WSD_STAIR as K } from '../codes/aci318Wsd';
import type { SupportCondition } from '../types';
import { stairProfile, stairSupport } from './geometry';
import type { StairEnd, StairInput } from './types';

/** น้ำหนักแผ่หนึ่งช่วง — w กก./ตร.ม. (พื้นที่ฉายราบ) บนแถบกว้าง 1 ม., x ซม. */
export interface LoadSegment {
  x1: number;
  x2: number;
  w: number;
}

export interface SpanStatics {
  /** ปฏิกิริยาที่ปลายล่าง/ปลายบน (kg ต่อแถบกว้าง 1 ม. = กก./ม. ที่ถ่ายลงคาน) */
  Rlow: number;
  Rhigh: number;
  /** ตำแหน่งที่แรงเฉือนเป็นศูนย์ (ซม.) */
  xMax: number;
  /** โมเมนต์บวกสูงสุดของช่วงยึดหมุน (kg·cm) */
  Mmax: number;
}

/**
 * คานช่วงเดียวยึดหมุนรับน้ำหนักแผ่เป็นช่วง ๆ ต่อเนื่องกัน — สถิตศาสตร์ตรง ๆ ไม่ใช้สัมประสิทธิ์
 * segments ต้องเรียงจากปลายล่างไปปลายบน
 */
export function simpleSpan(segments: LoadSegment[], L: number): SpanStatics {
  // แถบกว้าง 1 ม. → น้ำหนักเส้น w กก./ม. = w/100 กก./ซม.
  const parts = segments
    .filter((s) => s.x2 > s.x1)
    .map((s) => ({ ...s, q: s.w / 100, W: (s.w / 100) * (s.x2 - s.x1), xc: (s.x1 + s.x2) / 2 }));
  const total = parts.reduce((acc, p) => acc + p.W, 0);
  const Rlow = L > 0 ? parts.reduce((acc, p) => acc + p.W * (L - p.xc), 0) / L : 0;

  let xMax = L;
  let V = Rlow;
  for (const p of parts) {
    if (V - p.W <= 0) {
      xMax = p.q > 0 ? p.x1 + V / p.q : p.x1;
      break;
    }
    V -= p.W;
  }

  let Mmax = Rlow * xMax;
  for (const p of parts) {
    const end = Math.min(xMax, p.x2);
    if (end <= p.x1) continue;
    const len = end - p.x1;
    Mmax -= p.q * len * (xMax - (p.x1 + len / 2));
  }

  return { Rlow, Rhigh: total - Rlow, xMax, Mmax };
}

export interface StairLoads {
  /** ท้องบันไดต่อพื้นที่ฉายราบ γ·t/cosθ */
  wWaist: number;
  /** ขั้นบันได (สามเหลี่ยม) เฉลี่ย γ·R/2 */
  wSteps: number;
  /** ตัวพื้นส่วนราบ γ·t */
  wSlab: number;
  finish: number;
  live: number;
  /** น้ำหนักใช้งานรวมของช่วงลาดและส่วนราบ (กก./ตร.ม.) */
  wFlight: number;
  wLanding: number;
  /** น้ำหนักคงที่ของช่วงลาด — ใช้ตรวจเงื่อนไข LL ≤ 3·DL */
  deadFlight: number;
  segments: LoadSegment[];
  statics: SpanStatics;
  /** น้ำหนักแผ่สม่ำเสมอเทียบเท่าที่ให้โมเมนต์ช่วงยึดหมุนเท่ากัน = 8·M/L² (กก./ตร.ม.) */
  wEq: number;
}

/**
 * น้ำหนักบรรทุกบนพื้นที่ฉายราบ แยกช่วงลาดกับส่วนราบ
 *
 * ช่วงลาดคิดตลอดความยาวราบของขั้นบันได (N−1)·T ตามที่เขียนในแบบ ส่วนที่เหลือเป็นส่วนราบ
 * ลิ่มคอนกรีตที่หัวบันได (ใต้ขั้นบนสุด) ไม่ได้รวม — น้อยกว่า 2% ของน้ำหนักทั้งช่วงในบันไดทั่วไป
 */
export function stairLoads(input: StairInput, t: number): StairLoads {
  const p = stairProfile(input);
  const gamma = KS.concreteUnitWeight * 1000;
  const wWaist = (t / 100 / p.cos) * gamma;
  const wSteps = (input.riser / 100 / 2) * gamma;
  const wSlab = (t / 100) * gamma;
  const finish = input.finishDL;
  const live = input.LL;
  const deadFlight = wWaist + wSteps + finish;
  const wFlight = deadFlight + live;
  const wLanding = wSlab + finish + live;

  const segments: LoadSegment[] = [
    { x1: 0, x2: p.xFirst, w: wLanding },
    { x1: p.xFirst, x2: p.xLast, w: wFlight },
    { x1: p.xLast, x2: p.L, w: wLanding },
  ];
  const statics = simpleSpan(segments, p.L);
  const wEq = p.L > 0 ? (800 * statics.Mmax) / (p.L * p.L) : 0;

  return { wWaist, wSteps, wSlab, finish, live, wFlight, wLanding, deadFlight, segments, statics, wEq };
}

export interface StairMoments {
  support: SupportCondition;
  /** โมเมนต์บวกกลางช่วง และโมเมนต์ลบที่ปลายทั้งสอง (kg·cm ต่อแถบกว้าง 1 ม.) */
  pos: number;
  negLow: number;
  negHigh: number;
  /** ตัวหารที่ใช้จริง เก็บไว้พิมพ์ลงขั้นตอนคำนวณ */
  divisors: { pos: number; negLow: number; negHigh: number };
}

/**
 * โมเมนต์ออกแบบ = w·L²/ตัวหาร ด้วยน้ำหนักเทียบเท่า
 *
 * M+ ใช้สัมประสิทธิ์ของพื้น (8 ช่วงยึดหมุน, 14 ต่อเนื่องปลายเดียว, 16 ต่อเนื่องสองปลาย)
 * M− ที่ปลายต่อเนื่องใช้ค่าที่รองรับภายใน ส่วนปลายไม่ต่อเนื่องใช้ w·L²/24
 */
export function stairMoments(wEq: number, L: number, endLow: StairEnd, endHigh: StairEnd): StairMoments {
  const support = stairSupport(endLow, endHigh);
  const table = KS.momentDivisors[support];
  const base = (wEq / 100) * L * L;
  const negDivisor = (end: StairEnd) =>
    end === 'continuous' ? (table.negInt ?? K.discontinuousEndDivisor) : K.discontinuousEndDivisor;
  const divisors = { pos: table.pos ?? 8, negLow: negDivisor(endLow), negHigh: negDivisor(endHigh) };
  return {
    support,
    pos: base / divisors.pos,
    negLow: base / divisors.negLow,
    negHigh: base / divisors.negHigh,
    divisors,
  };
}

/** ปฏิกิริยาที่ปลายหนึ่ง (กก./ม. ของคานรองรับ) — ปลายต่อเนื่องเผื่อ 15% */
export const endReaction = (R: number, end: StairEnd) => (end === 'continuous' ? R * K.continuousShearFactor : R);
