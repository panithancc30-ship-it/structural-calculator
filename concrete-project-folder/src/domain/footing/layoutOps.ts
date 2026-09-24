import type { BarDir, BarSet, FootingLayout } from './types';

export function setBarSet(layout: FootingLayout, dir: BarDir, patch: Partial<BarSet>): FootingLayout {
  const next = { ...layout[dir], ...patch };
  return { ...layout, [dir]: { ...next, count: Math.max(2, Math.round(next.count)) } };
}

export function setBottom(layout: FootingLayout, bottom: BarDir): FootingLayout {
  return { ...layout, bottom };
}
