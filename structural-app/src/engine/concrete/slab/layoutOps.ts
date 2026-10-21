import { ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import type { BarDir } from '../footing/types';
import type { Face } from '../types';
import type { BarRun, SlabLayout } from './types';

const roundInput = (s: number) => Math.round(s / K.spacingInputStep) * K.spacingInputStep;

/**
 * ระยะเรียงที่แก้เอง: ปัดทีละ 0.5 ซม. (กรอก @0.165 ตามแบบได้) และไม่ถี่กว่าที่เทคอนกรีตได้
 * ปุ่มเพิ่ม/ลดใช้ stepSpacing ซึ่งเลื่อนไปตามโมดูลก่อสร้าง 2.5 ซม.
 */
export const clampSpacing = (s: number) => Math.min(K.maxSpacing, Math.max(K.minSpacing, roundInput(s)));

/** แบบ S1: เหล็กเสริมพิเศษห่างได้ถึง 90 ซม. เพราะวางสลับกับคอม้าที่งอขึ้น */
export const clampExtraSpacing = (s: number) => Math.min(K.extraMaxSpacing, Math.max(K.minSpacing, roundInput(s)));

/** เลื่อนระยะเรียงไปค่าถัดไปบนโมดูล 2.5 ซม. — ค่าที่กรอกเองนอกโมดูล (16.5) ไปที่ 17.5 หรือ 15 */
export function stepSpacing(s: number, up: boolean): number {
  const k = s / K.spacingStep;
  return (up ? Math.floor(k + 1e-9) + 1 : Math.ceil(k - 1e-9) - 1) * K.spacingStep;
}

export function setRun(layout: SlabLayout, face: Face, dir: BarDir, patch: Partial<BarRun>): SlabLayout {
  const current = layout[face][dir];
  if (!current) return layout;
  const next = { ...current, ...patch };
  return { ...layout, [face]: { ...layout[face], [dir]: { ...next, spacing: clampSpacing(next.spacing) } } };
}

/** เพิ่มหรือเอาเหล็กชุดหนึ่งออก — ใช้กับเหล็กผิวบนที่ใส่เฉพาะขอบต่อเนื่อง */
export function toggleRun(layout: SlabLayout, face: Face, dir: BarDir, fallback: BarRun): SlabLayout {
  const current = layout[face][dir];
  return { ...layout, [face]: { ...layout[face], [dir]: current ? null : { ...fallback } } };
}

/** สลับว่าทิศใดวางชิดผิวคอนกรีต (ได้ความลึกประสิทธิผลมากกว่า) */
export function setOuterLayer(layout: SlabLayout, face: Face, dir: BarDir): SlabLayout {
  return { ...layout, outerLayer: { ...layout.outerLayer, [face]: dir } };
}

/** พื้นวางบนดิน: แก้ตะแกรงทั้งสองทิศพร้อมกัน ให้ขนาดและระยะเรียงเท่ากัน (# ตามแบบขยายพื้น GS) */
export function setMesh(layout: SlabLayout, patch: Partial<BarRun>): SlabLayout {
  const base = layout.bottom.x ?? layout.bottom.y;
  if (!base) return layout;
  const next = { ...base, ...patch };
  const run = { ...next, spacing: clampSpacing(next.spacing) };
  return { ...layout, bottom: { x: { ...run }, y: { ...run } } };
}

/**
 * แบบ S1: แก้เหล็กเสริมพิเศษ — พื้นสองทางใช้ชุดเดียวกันทั้งสองทิศ (dirs = ทิศที่มีคอม้า) จึงแก้พร้อมกัน
 * fallback ใช้เมื่อยังไม่มีเหล็กเสริมพิเศษ (เพิ่มกลับเข้ามา)
 */
export function setExtra(layout: SlabLayout, dirs: BarDir[], patch: Partial<BarRun>, fallback?: BarRun): SlabLayout {
  const base = dirs.map((d) => layout.top[d]).find((r) => r !== null) ?? fallback;
  if (!base) return layout;
  const next = { ...base, ...patch };
  const run = { ...next, spacing: clampExtraSpacing(next.spacing) };
  const top = { ...layout.top };
  for (const d of dirs) top[d] = { ...run };
  return { ...layout, top };
}
