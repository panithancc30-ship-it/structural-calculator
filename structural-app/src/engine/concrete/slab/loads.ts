import { ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import type { BarDir } from '../footing/types';
import type { SupportCondition } from '../types';
import { edgesOf, spanOf, supportConditionOf } from './geometry';
import type { SlabDims, SlabInput } from './types';

/** น้ำหนักตัวพื้น (กก./ตร.ม.) — t เป็น ซม. */
export const selfWeight = (t: number) => (t / 100) * K.concreteUnitWeight * 1000;

export interface SlabLoads {
  /** น้ำหนักตัวพื้น (กก./ตร.ม.) */
  wSelf: number;
  /** น้ำหนักคงที่รวม */
  wDead: number;
  wLive: number;
  /** น้ำหนักบรรทุกใช้งานรวม (กก./ตร.ม.) */
  w: number;
  /**
   * น้ำหนักที่ใช้คำนวณแถบแต่ละทิศ (กก./ตร.ม.)
   * พื้นสองทางใช้ w เต็มทั้งสองทิศ เพราะตารางวิธีที่ 2 แบ่งน้ำหนักไว้ในสัมประสิทธิ์แล้ว
   */
  share: Record<BarDir, number>;
  /** ทิศช่วงสั้น — null เมื่อไม่ใช่พื้นสองทาง */
  shortDir: BarDir | null;
  /** พื้นสองทาง วิธีที่ 2: m = S/L และกรณีตามจำนวนขอบไม่ต่อเนื่อง */
  twoWay: { m: number; caseNo: TwoWayCase } | null;
}

export type TwoWayCase = 1 | 2 | 3 | 4 | 5;

/** กรณีของแผ่นพื้นสองทาง = 1 + จำนวนขอบไม่ต่อเนื่อง */
export function twoWayCase(input: SlabInput): TwoWayCase {
  const edges = [input.edgeX1, input.edgeX2, input.edgeY1, input.edgeY2];
  return (1 + edges.filter((e) => e !== 'continuous').length) as TwoWayCase;
}

const shortOf = (d: Pick<SlabDims, 'lx' | 'ly'>) => Math.min(d.lx, d.ly);
const ratioOf = (d: Pick<SlabDims, 'lx' | 'ly'>) => shortOf(d) / Math.max(d.lx, d.ly);
const shortDirOf = (d: Pick<SlabDims, 'lx' | 'ly'>): BarDir => (d.lx <= d.ly ? 'x' : 'y');

/** เทียบค่าในตารางวิธีที่ 2 เชิงเส้นตาม m (m < 0.5 ใช้ค่าที่ 0.5) */
export function method2Interp(values: readonly number[], m: number): number {
  const ms = K.method2Ratios;
  const mm = Math.min(ms[0], Math.max(ms[ms.length - 1], m));
  for (let i = 0; i < ms.length - 1; i++) {
    if (mm >= ms[i + 1] - 1e-12) {
      const t = (ms[i] - mm) / (ms[i] - ms[i + 1]);
      return values[i] + t * (values[i + 1] - values[i]);
    }
  }
  return values[values.length - 1];
}

export function slabLoads(input: SlabInput, t: number): SlabLoads {
  const wSelf = selfWeight(t);
  const wDead = wSelf + input.finishDL;
  const wLive = input.LL;
  const w = wDead + wLive;

  if (input.slabType === 'twoWay') {
    return {
      wSelf, wDead, wLive, w,
      share: { x: w, y: w },
      shortDir: shortDirOf(input),
      twoWay: { m: ratioOf(input), caseNo: twoWayCase(input) },
    };
  }

  // ทางเดียว / พื้นยื่น / พื้นวางบนดิน — แถบทิศ x รับน้ำหนักทั้งหมด ทิศ y เป็นเหล็กกันร้าว
  return { wSelf, wDead, wLive, w, share: { x: w, y: 0 }, shortDir: null, twoWay: null };
}

export interface StripMoments {
  /** โมเมนต์บวกกลางช่วง (kg·cm ต่อแถบกว้าง 1 ม.) */
  pos: number;
  /** โมเมนต์ลบที่ที่รองรับริม */
  negEnd: number;
  /** โมเมนต์ลบที่ที่รองรับภายใน */
  negInt: number;
  /** ตัวหารที่ใช้จริง เก็บไว้พิมพ์ลงขั้นตอนคำนวณ (พื้นทางเดียว พื้นยื่น) */
  divisors: { pos: number | null; negEnd: number | null; negInt: number | null };
  /** สัมประสิทธิ์ C ของ M = C·w·S² (พื้นสองทาง วิธีที่ 2) */
  coefs: { pos: number | null; negEnd: number | null; negInt: number | null } | null;
}

/**
 * โมเมนต์ของแถบกว้าง 1 ม. จากสัมประสิทธิ์โดยประมาณ ACI 8.3.3
 * w เป็น กก./ตร.ม., span เป็น ซม. → คืนค่าเป็น kg·cm
 */
export function stripMoments(w: number, span: number, support: SupportCondition): StripMoments {
  const divisors = K.momentDivisors[support];
  // แถบกว้าง 1 ม. → น้ำหนักเส้น w กก./ม. = w/100 กก./ซม.
  const wLine = w / 100;
  const base = wLine * span * span;
  const at = (divisor: number | null) => (divisor === null ? 0 : base / divisor);
  return { pos: at(divisors.pos), negEnd: at(divisors.negEnd), negInt: at(divisors.negInt), divisors, coefs: null };
}

/**
 * โมเมนต์ของแถบกว้าง 1 ม. ของพื้นสองทาง วิธีที่ 2: M = C·w·S² (S = ช่วงสั้น ทั้งสองทิศ)
 * โมเมนต์ลบที่ขอบไม่ต่อเนื่องเก็บใน negEnd ส่วนที่ขอบต่อเนื่องเก็บใน negInt
 */
export function twoWayMoments(input: SlabInput, w: number, dir: BarDir): StripMoments {
  const m = ratioOf(input);
  const row = K.method2Coefs[twoWayCase(input)];
  const short = dir === shortDirOf(input);
  const pick = (v: readonly number[] | number | null) =>
    v === null ? null : typeof v === 'number' ? v : method2Interp(v, m);
  const c = short ? row.short : row.long;
  const edges = edgesOf(input, dir);
  const coefs = {
    pos: pick(c.pos),
    negEnd: edges.some((e) => e !== 'continuous') ? pick(c.negDisc) : null,
    negInt: edges.includes('continuous') ? pick(c.negCont) : null,
  };
  const S = shortOf(input);
  const base = (w / 100) * S * S;
  const at = (coef: number | null) => (coef === null ? 0 : coef * base);
  return {
    pos: at(coefs.pos), negEnd: at(coefs.negEnd), negInt: at(coefs.negInt),
    divisors: { pos: null, negEnd: null, negInt: null },
    coefs,
  };
}

/**
 * น้ำหนักที่พื้นสองทางถ่ายลงคาน วิธีที่ 2 (กก. ต่อความยาวคาน 1 ม.)
 * แถบทิศสั้นวิ่งไปถึงคานด้านยาว: w·S/3·(3 − m²)/2, แถบทิศยาวถึงคานด้านสั้น: w·S/3
 */
export function twoWayEdgeLoad(dims: Pick<SlabDims, 'lx' | 'ly'>, w: number, dir: BarDir): number {
  const m = ratioOf(dims);
  const base = (w * shortOf(dims)) / 100 / K.method2BeamDivisor;
  return dir === shortDirOf(dims) ? (base * (3 - m * m)) / 2 : base;
}

/** โมเมนต์และแรงเฉือนของแถบกว้าง 1 ม. ในทิศหนึ่ง — ใช้ทั้งการตรวจสอบและการออกแบบ */
export function stripDemand(input: SlabInput, loads: SlabLoads, dir: BarDir) {
  const span = spanOf(input, dir);
  const support = supportConditionOf(input, dir);
  const w = loads.share[dir];
  const active = input.slabType !== 'onGround' && w > 0;
  const moments: StripMoments = !active
    ? { pos: 0, negEnd: 0, negInt: 0, divisors: { pos: null, negEnd: null, negInt: null }, coefs: null }
    : loads.twoWay
      ? twoWayMoments(input, w, dir)
      : stripMoments(w, span, support);
  const V = !active ? 0 : loads.twoWay ? twoWayEdgeLoad(input, w, dir) : stripShear(w, span, support);
  return { span, support, w, moments, V };
}

/** แรงเฉือนที่ผิวที่รองรับของแถบกว้าง 1 ม. (kg) */
export function stripShear(w: number, span: number, support: SupportCondition): number {
  const wLine = w / 100;
  // พื้นยื่นรับแรงเฉือนเต็มช่วง ส่วนช่วงพาดรับครึ่งช่วง (ต่อเนื่องเผื่อ 15% ตาม ACI 8.3.3)
  if (support === 'cantilever') return wLine * span;
  const factor = support === 'simple' ? 0.5 : 0.575;
  return wLine * span * factor;
}

/** ปฏิกิริยาที่พื้นถ่ายลงคานรองรับ (กก./ม.) — ใช้ส่งต่อให้โมดูลคาน */
export function beamReaction(loads: SlabLoads, dims: SlabDims, dir: BarDir): number {
  if (loads.twoWay) return twoWayEdgeLoad(dims, loads.w, dir);
  return (loads.share[dir] * spanOf(dims, dir)) / 100 / 2;
}

export const supportOf = supportConditionOf;
