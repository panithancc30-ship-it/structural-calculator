import { ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import type { BarDir } from '../footing/types';
import { spanOf } from './geometry';
import type { SlabLoads } from './loads';
import type { SlabInput } from './types';

/**
 * พื้นวางบนดินตามแบบขยายพื้น GS — แผ่นพื้นแยกจากคานด้วยร่องยาแนว (ห้ามฝังเหล็กเข้าคาน)
 * น้ำหนักทั้งหมดลงทรายรองพื้นโดยตรง จึงไม่มีโมเมนต์ดัดจากน้ำหนักแผ่สม่ำเสมอ สิ่งที่ต้องตรวจคือ
 * - เหล็กตะแกรงกันร้าว: แผ่นพื้นหดตัวแล้วถูกแรงเสียดทานของทรายรั้งไว้ แรงดึงสูงสุดอยู่กลางแผ่น
 *   = F·W·L/2 ต่อความกว้าง 1 ม. ให้เหล็กรับทั้งหมด → As = F·L·W/(2fs) (subgrade drag)
 * - การรับน้ำหนัก: แรงดันใต้พื้น q = น้ำหนักคงที่ + จร ≤ qa
 */
export interface GroundSlab {
  /** สัมประสิทธิ์ความเสียดทานกับทรายรองพื้น */
  F: number;
  /** น้ำหนักคงที่ที่กดลงทรายรองพื้น = ตัวพื้น + ปูผิว (กก./ตร.ม.) */
  W: number;
  /** หน่วยแรงดึงที่ยอมให้ของเหล็ก (ksc) */
  fs: number;
  /** ความยาวแผ่นระหว่างรอยต่อ/คานที่เหล็กแต่ละทิศพาด (ซม.) */
  L: Record<BarDir, number>;
  /** As ที่ต้องการต่อความกว้าง 1 ม. (ซม.²/ม.) */
  AsReq: Record<BarDir, number>;
  /** แรงดันใต้พื้น (t/m²) */
  q: number;
  qa: number;
  /** น้ำหนักจรที่ดินยังรับได้ = qa − น้ำหนักคงที่ (กก./ตร.ม.) */
  liveCapacity: number;
}

/** ระยะเรียงสูงสุดของตะแกรง: 5h ≤ 45 ซม. และไม่ห่างกว่าแบบขยายพื้น GS */
export const groundMeshMaxSpacing = (t: number) =>
  Math.min(K.tempSpacingFactor * t, K.maxSpacing, K.groundMeshMaxSpacing);

/** As ต่อความกว้าง 1 ม. (ซม.²/ม.) — L เป็น ซม., W กก./ตร.ม., fs ksc */
export const subgradeDragAs = (F: number, L: number, W: number, fs: number) => (F * (L / 100) * W) / (2 * fs);

export function groundSlab(input: SlabInput, loads: SlabLoads, fs: number): GroundSlab {
  const F = K.subgradeFriction;
  const W = loads.wDead;
  const L = { x: spanOf(input, 'x'), y: spanOf(input, 'y') };
  return {
    F, W, fs, L,
    AsReq: { x: subgradeDragAs(F, L.x, W, fs), y: subgradeDragAs(F, L.y, W, fs) },
    q: loads.w / 1000,
    qa: input.qa,
    liveCapacity: input.qa * 1000 - loads.wDead,
  };
}
