/** การแก้ไขรูปแบบเหล็กเสริม (pure functions — คืนค่า layout ใหม่เสมอ) */
import { REBARS, type BarName } from './rebar';
import type { BarLayer, Face, SectionLayout, StirrupSpec } from './types';

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

export function makeLayer(count: number, size: BarName): BarLayer {
  return { id: newId('L'), bars: Array.from({ length: count }, () => ({ id: newId('b'), size })) };
}

function mapLayer(layout: SectionLayout, face: Face, layerId: string, fn: (layer: BarLayer) => BarLayer): SectionLayout {
  const layers = layout[face].map((layer) => (layer.id === layerId ? fn(layer) : layer)).filter((layer) => layer.bars.length > 0);
  return { ...layout, [face]: layers };
}

export function setBarSize(
  layout: SectionLayout,
  face: Face,
  layerId: string,
  barId: string,
  size: BarName,
  wholeLayer = false,
): SectionLayout {
  return mapLayer(layout, face, layerId, (layer) => ({
    ...layer,
    bars: layer.bars.map((bar) => (wholeLayer || bar.id === barId ? { ...bar, size } : bar)),
  }));
}

export function removeBar(layout: SectionLayout, face: Face, layerId: string, barId: string): SectionLayout {
  return mapLayer(layout, face, layerId, (layer) => ({ ...layer, bars: layer.bars.filter((bar) => bar.id !== barId) }));
}

export function addBar(layout: SectionLayout, face: Face, layerId: string, size?: BarName): SectionLayout {
  return mapLayer(layout, face, layerId, (layer) => {
    const barSize = size ?? layer.bars[layer.bars.length - 1]?.size ?? 'DB16';
    const bars = [...layer.bars];
    // แทรกตรงกลางเพื่อให้การเรียงสมมาตร
    bars.splice(Math.ceil(bars.length / 2), 0, { id: newId('b'), size: barSize });
    return { ...layer, bars };
  });
}

export function addLayer(layout: SectionLayout, face: Face, size: BarName, count = 2): SectionLayout {
  return { ...layout, [face]: [...layout[face], makeLayer(count, size)] };
}

export function setSideRowSize(layout: SectionLayout, rowId: string, size: BarName, allRows = false): SectionLayout {
  return { ...layout, side: layout.side.map((row) => (allRows || row.id === rowId ? { ...row, size } : row)) };
}

export function addSideRow(layout: SectionLayout, size: BarName): SectionLayout {
  return { ...layout, side: [...layout.side, { id: newId('S'), size }] };
}

export function removeSideRow(layout: SectionLayout, rowId: string): SectionLayout {
  return { ...layout, side: layout.side.filter((row) => row.id !== rowId) };
}

export function setStirrup(layout: SectionLayout, patch: Partial<StirrupSpec>): SectionLayout {
  return { ...layout, stirrup: { ...layout.stirrup, ...patch } };
}

/** โหมด 2 ปลอก: เติมเหล็กชั้นแรกบน/ล่างให้ครบ 4 เส้น เพื่อเป็นเหล็กมุมของปลอกใน */
export function ensureInnerAnchors(layout: SectionLayout, fallback: BarName): SectionLayout {
  const fix = (face: Face): BarLayer[] => {
    const layers = layout[face];
    if (layers.length === 0) return [makeLayer(4, fallback)];
    const [first, ...rest] = layers;
    if (first.bars.length >= 4) return layers;
    const size = first.bars[first.bars.length - 1]?.size ?? fallback;
    const bars = [...first.bars];
    while (bars.length < 4) bars.splice(Math.ceil(bars.length / 2), 0, { id: newId('b'), size });
    return [{ ...first, bars }, ...rest];
  };
  return { ...layout, top: fix('top'), bottom: fix('bottom') };
}

export function faceArea(layout: SectionLayout, face: Face): number {
  return layout[face].reduce((sum, layer) => sum + layer.bars.reduce((s, bar) => s + REBARS[bar.size].area, 0), 0);
}

/** ลายเซ็นของ layout (ไม่รวม id) ใช้เปรียบเทียบว่าการออกแบบลู่เข้าแล้ว */
export function layoutSignature(layout: SectionLayout): string {
  const faces = (['top', 'bottom'] as const).map((f) => layout[f].map((l) => l.bars.map((b) => b.size).join(',')).join('|'));
  const side = layout.side.map((r) => r.size).join(',');
  const s = layout.stirrup;
  return `${faces.join('/')}/${side}/${s.size}x${s.count}@${s.spacing}`;
}
