import { ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import type { BarDir } from '../footing/types';
import type { SupportCondition } from '../types';
import { spanOf, supportConditionOf } from './geometry';
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
  /** น้ำหนักที่แถบแต่ละทิศรับไว้ (กก./ตร.ม.) */
  share: Record<BarDir, number>;
  /** ทิศช่วงสั้น — null เมื่อไม่ใช่พื้นสองทาง */
  shortDir: BarDir | null;
  /** สัมประสิทธิ์ที่ใช้แบ่งน้ำหนัก (พื้นสองทางเท่านั้น) */
  splitRatio: number | null;
}

/**
 * แบ่งน้ำหนักพื้นสองทางด้วยวิธี Rankine–Grashof
 *
 * ให้การโก่งตัวกลางแผ่นของแถบสองทิศเท่ากัน: wx·lx⁴ = wy·ly⁴ และ wx + wy = w
 * จึงได้ wx = w·ly⁴/(lx⁴+ly⁴) — เมื่อ ly > lx จะได้ wx > wy คือแถบด้านสั้นรับน้ำหนักมากกว่า
 *
 * เป็นค่าประมาณที่ตั้งอยู่บนสมมติฐานว่าสองแถบมี EI และสภาพรองรับเหมือนกัน
 * เมื่อขอบทั้งสี่มีความต่อเนื่องไม่เท่ากัน ผลที่ได้จะคลาดเคลื่อน — ระบุไว้ในหมายเหตุของรายการคำนวณ
 */
export function rankineGrashof(lx: number, ly: number): number {
  const a = lx ** 4;
  const b = ly ** 4;
  return a + b > 0 ? b / (a + b) : 0.5;
}

export function slabLoads(input: SlabInput, t: number): SlabLoads {
  const wSelf = selfWeight(t);
  const wDead = wSelf + input.finishDL;
  const wLive = input.LL;
  const w = wDead + wLive;

  if (input.slabType === 'twoWay') {
    const ratio = rankineGrashof(input.lx, input.ly);
    return {
      wSelf, wDead, wLive, w,
      share: { x: w * ratio, y: w * (1 - ratio) },
      shortDir: input.lx <= input.ly ? 'x' : 'y',
      splitRatio: ratio,
    };
  }

  // ทางเดียว / พื้นยื่น / พื้นวางบนดิน — แถบทิศ x รับน้ำหนักทั้งหมด ทิศ y เป็นเหล็กกันร้าว
  return { wSelf, wDead, wLive, w, share: { x: w, y: 0 }, shortDir: null, splitRatio: null };
}

export interface StripMoments {
  /** โมเมนต์บวกกลางช่วง (kg·cm ต่อแถบกว้าง 1 ม.) */
  pos: number;
  /** โมเมนต์ลบที่ที่รองรับริม */
  negEnd: number;
  /** โมเมนต์ลบที่ที่รองรับภายใน */
  negInt: number;
  /** ตัวหารที่ใช้จริง เก็บไว้พิมพ์ลงขั้นตอนคำนวณ */
  divisors: { pos: number | null; negEnd: number | null; negInt: number | null };
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
  return { pos: at(divisors.pos), negEnd: at(divisors.negEnd), negInt: at(divisors.negInt), divisors };
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
  return (loads.share[dir] * spanOf(dims, dir)) / 100 / 2;
}

export const supportOf = supportConditionOf;
