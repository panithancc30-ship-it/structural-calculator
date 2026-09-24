import { clampSpacing } from '../slab/layoutOps';
import type { BarRun } from '../slab/types';
import type { StairBarKey, StairLayout } from './types';

export function setStairRun(layout: StairLayout, key: StairBarKey, patch: Partial<BarRun>): StairLayout {
  const current = layout[key];
  if (!current) return layout;
  const next = { ...current, ...patch };
  return { ...layout, [key]: { ...next, spacing: clampSpacing(next.spacing) } };
}

/** เพิ่มหรือเอาเหล็กชุดหนึ่งออก — ใช้กับเหล็กขั้นบันไดซึ่งเป็นเหล็กตามแบบ */
export function toggleStairRun(layout: StairLayout, key: StairBarKey, fallback: BarRun): StairLayout {
  return { ...layout, [key]: layout[key] ? null : { ...fallback } };
}
