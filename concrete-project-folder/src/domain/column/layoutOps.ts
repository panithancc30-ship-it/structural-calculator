/** การแก้ไขเหล็กเสา (pure functions) */
import { newId } from '../layoutOps';
import type { BarName } from '../rebar';
import type { Bar } from '../types';
import type { ColumnFace, ColumnLayout, RectFace, TransverseSpec } from './types';

const RECT_FACES: RectFace[] = ['top', 'bottom', 'left', 'right'];
const OPPOSITE: Record<RectFace, RectFace> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

export interface BarLocation {
  face: ColumnFace;
  index: number;
  bar: Bar;
}

export function findColumnBar(layout: ColumnLayout, id: string): BarLocation | null {
  if (layout.kind === 'circle') {
    const index = layout.bars.findIndex((b) => b.id === id);
    return index < 0 ? null : { face: 'ring', index, bar: layout.bars[index] };
  }
  const ci = layout.corners.findIndex((b) => b.id === id);
  if (ci >= 0) return { face: 'corner', index: ci, bar: layout.corners[ci] };
  for (const face of RECT_FACES) {
    const index = layout[face].findIndex((b) => b.id === id);
    if (index >= 0) return { face, index, bar: layout[face][index] };
  }
  return null;
}

const resize = (list: Bar[], id: string, size: BarName, all: boolean) =>
  list.map((b) => (all || b.id === id ? { ...b, size } : b));

export function setColumnBarSize(layout: ColumnLayout, id: string, size: BarName, all = false): ColumnLayout {
  if (layout.kind === 'circle') return { ...layout, bars: resize(layout.bars, id, size, all) };
  return {
    ...layout,
    corners: resize(layout.corners, id, size, all),
    top: resize(layout.top, id, size, all),
    bottom: resize(layout.bottom, id, size, all),
    left: resize(layout.left, id, size, all),
    right: resize(layout.right, id, size, all),
  };
}

/** เพิ่มเหล็ก 1 เส้นที่ด้านนั้น (mirror = เพิ่มด้านตรงข้ามด้วย เพื่อให้สมมาตร) */
export function addColumnBar(layout: ColumnLayout, face: RectFace | 'ring', size: BarName, mirror = true): ColumnLayout {
  const bar = (): Bar => ({ id: newId('c'), size });
  if (layout.kind === 'circle') return { ...layout, bars: [...layout.bars, bar()] };
  if (face === 'ring') return layout;
  const insert = (list: Bar[]) => {
    const next = [...list];
    next.splice(Math.ceil(next.length / 2), 0, bar());
    return next;
  };
  const next = { ...layout, [face]: insert(layout[face]) };
  if (mirror) next[OPPOSITE[face]] = insert(layout[OPPOSITE[face]]);
  return next;
}

/** ลบเหล็ก (เหล็กมุมลบไม่ได้) — mirror = ลบเส้นตำแหน่งเดียวกันด้านตรงข้ามด้วย */
export function removeColumnBar(layout: ColumnLayout, id: string, mirror = true): ColumnLayout {
  if (layout.kind === 'circle') return { ...layout, bars: layout.bars.filter((b) => b.id !== id) };
  const loc = findColumnBar(layout, id);
  if (!loc || loc.face === 'corner' || loc.face === 'ring') return layout;
  const face = loc.face;
  const next = { ...layout, [face]: layout[face].filter((b) => b.id !== id) };
  if (mirror) {
    const opp = layout[OPPOSITE[face]];
    const target = opp[Math.min(loc.index, opp.length - 1)];
    if (target) next[OPPOSITE[face]] = opp.filter((b) => b.id !== target.id);
  }
  return next;
}

export function setColumnTie(layout: ColumnLayout, patch: Partial<TransverseSpec>): ColumnLayout {
  return { ...layout, tie: { ...layout.tie, ...patch } };
}
