import { ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import type { BarDir } from '../footing/types';
import type { Face } from '../types';
import type { BarRun, SlabLayout } from './types';

/** ปัดระยะเรียงให้เป็นพหุคูณของโมดูลก่อสร้าง และไม่ถี่กว่าที่เทคอนกรีตได้ */
export const clampSpacing = (s: number) =>
  Math.min(K.maxSpacing, Math.max(K.minSpacing, Math.round(s / K.spacingStep) * K.spacingStep));

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
