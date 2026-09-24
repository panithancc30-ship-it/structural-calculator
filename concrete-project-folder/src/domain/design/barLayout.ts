import { ACI318_WSD as C } from '../codes/aci318Wsd';
import { REBARS, type BarName } from '../rebar';
import type { BarLayer, BeamInput, Face, SectionLayout, StirrupSpec } from '../types';

/** พิกัดทั้งหมดหน่วย ซม. จากมุมซ้ายบนของหน้าตัด (y ชี้ลง) */
export interface PlacedBar {
  id: string;
  size: BarName;
  dia: number;
  area: number;
  x: number;
  y: number;
  face: Face | 'side';
  /** index ชั้น (เหล็กข้าง = index แถว) */
  layer: number;
  layerId: string;
}

/** เส้นศูนย์กลางของเหล็กปลอก */
export interface StirrupGeom {
  x: number;
  y: number;
  w: number;
  h: number;
  /** รัศมีมุม (ศูนย์กลางปลอก) */
  r: number;
  ds: number;
}

export interface LayerSpacing {
  face: Face;
  layer: number;
  layerId: string;
  minClear: number;
  required: number;
  ok: boolean;
}

export interface SectionGeometry {
  bars: PlacedBar[];
  outer: StirrupGeom;
  inner: StirrupGeom | null;
  spacing: LayerSpacing[];
  /** โหมด 2 ปลอก: ชั้นแรกบนและล่างมี ≥ 4 เส้นให้ปลอกในยึด */
  innerAnchorsOk: boolean;
}

export interface GeoBase {
  b: number;
  h: number;
  ds: number;
  refDia: number;
  inX0: number;
  inX1: number;
  inY0: number;
  inY1: number;
  outer: StirrupGeom;
  inner: StirrupGeom | null;
  /** ตำแหน่ง x ของเหล็กมุมปลอกใน (โหมด 2 ปลอก) */
  anchors: [number, number] | null;
}

export function geoBase(input: BeamInput, stirrup: StirrupSpec, refDia: number): GeoBase {
  const { b, h, cover } = input;
  const ds = REBARS[stirrup.size].dia;
  const inX0 = cover + ds;
  const inX1 = b - cover - ds;
  const inY0 = cover + ds;
  const inY1 = h - cover - ds;
  const r = refDia / 2 + ds / 2;
  const outer: StirrupGeom = { x: cover + ds / 2, y: cover + ds / 2, w: b - 2 * cover - ds, h: h - 2 * cover - ds, r, ds };

  let anchors: [number, number] | null = null;
  let inner: StirrupGeom | null = null;
  if (stirrup.count === 2) {
    // ปลอกในคร่อมเหล็กเส้นที่ 2 และ n−1 ของการเรียง 4 เส้นเท่ากัน
    const left = inX0 + refDia / 2;
    const right = inX1 - refDia / 2;
    const span = right - left;
    anchors = [left + span / 3, right - span / 3];
    const ix0 = anchors[0] - refDia / 2 - ds / 2;
    const ix1 = anchors[1] + refDia / 2 + ds / 2;
    inner = { x: ix0, y: outer.y, w: ix1 - ix0, h: outer.h, r, ds };
  }
  return { b, h, ds, refDia, inX0, inX1, inY0, inY1, outer, inner, anchors };
}

/** ตำแหน่ง x ของเหล็กในชั้น — ปกติเรียงเท่ากัน; โหมด 2 ปลอก ชั้นแรกล็อกเหล็กที่มุมปลอกใน */
export function layerXs(g: GeoBase, dias: number[], layerIndex: number): number[] {
  const n = dias.length;
  if (n === 0) return [];
  if (n === 1) return [g.b / 2];
  const left = g.inX0 + dias[0] / 2;
  const right = g.inX1 - dias[n - 1] / 2;
  if (!g.anchors || layerIndex !== 0 || n < 4) {
    return dias.map((_, i) => left + ((right - left) * i) / (n - 1));
  }

  const [aL, aR] = g.anchors;
  const extra = n - 4;
  // กระจายเหล็กส่วนเกินลงช่องกลาง/ช่องริมให้ระยะห่างน้อยสุดมากที่สุด (สมมาตร)
  let bestMid = extra % 2;
  let bestScore = -Infinity;
  for (let m = extra % 2; m <= extra; m += 2) {
    const o = (extra - m) / 2;
    const score = Math.min((aL - left) / (o + 1), (aR - aL) / (m + 1));
    if (score > bestScore + 1e-9) {
      bestScore = score;
      bestMid = m;
    }
  }
  const o = (extra - bestMid) / 2;
  const xs = [left];
  for (let k = 1; k <= o; k++) xs.push(left + ((aL - left) * k) / (o + 1));
  xs.push(aL);
  for (let k = 1; k <= bestMid; k++) xs.push(aL + ((aR - aL) * k) / (bestMid + 1));
  xs.push(aR);
  for (let k = 1; k <= o; k++) xs.push(aR + ((right - aR) * k) / (o + 1));
  xs.push(right);
  return xs;
}

/** ระยะช่องว่างน้อยสุดในชั้น (หักขาปลอกในที่คั่นอยู่) */
export function layerMinClear(g: GeoBase, dias: number[], xs: number[]): { minClear: number; required: number } {
  let minClear = Infinity;
  let required: number = C.minClearSpacing;
  const legs = g.inner ? [g.inner.x, g.inner.x + g.inner.w] : [];
  for (let i = 1; i < xs.length; i++) {
    let gap = xs[i] - dias[i] / 2 - (xs[i - 1] + dias[i - 1] / 2);
    for (const leg of legs) if (leg > xs[i - 1] && leg < xs[i]) gap -= g.ds;
    minClear = Math.min(minClear, gap);
    required = Math.max(required, dias[i], dias[i - 1]);
  }
  return { minClear, required };
}

/** จำนวนเหล็กสูงสุดต่อชั้นที่ระยะช่องว่างยังผ่าน */
export function layerCapacity(g: GeoBase, dia: number, layerIndex: number): number {
  const minCount = g.anchors && layerIndex === 0 ? 4 : 2;
  let best = minCount;
  for (let n = 2; n <= 40; n++) {
    const dias = new Array<number>(n).fill(dia);
    const { minClear, required } = layerMinClear(g, dias, layerXs(g, dias, layerIndex));
    if (minClear + 1e-9 >= required) best = Math.max(best, n);
    else if (n >= minCount) break;
  }
  return best;
}

/** แบ่งจำนวนเหล็กลงชั้น (สูงสุด 3 ชั้น) หลีกเลี่ยงชั้นบนที่มีเหล็กเส้นเดียว */
export function splitIntoLayers(n: number, cap0: number, capN: number, minFirst: number): number[] {
  const counts: number[] = [];
  let rem = n;
  const first = Math.min(rem, cap0);
  counts.push(first);
  rem -= first;
  while (rem > 0 && counts.length < 3) {
    const c = Math.min(rem, capN);
    counts.push(c);
    rem -= c;
  }
  if (rem > 0) counts[counts.length - 1] += rem;
  for (let i = counts.length - 1; i > 0; i--) {
    const floor = i - 1 === 0 ? minFirst : 2;
    if (counts[i] === 1 && counts[i - 1] > floor) {
      counts[i - 1]--;
      counts[i]++;
    }
  }
  return counts;
}

function maxDia(layer: BarLayer | undefined): number {
  return layer ? layer.bars.reduce((m, bar) => Math.max(m, REBARS[bar.size].dia), 0) : 0;
}

export function referenceDia(input: BeamInput, layout: SectionLayout): number {
  const d = Math.max(maxDia(layout.top[0]), maxDia(layout.bottom[0]));
  return d > 0 ? d : REBARS[input.mainBar].dia;
}

export function computeGeometry(input: BeamInput, layout: SectionLayout): SectionGeometry {
  const g = geoBase(input, layout.stirrup, referenceDia(input, layout));
  const bars: PlacedBar[] = [];
  const spacing: LayerSpacing[] = [];

  const placeFace = (face: Face) => {
    const bottom = face === 'bottom';
    let edge = bottom ? g.inY1 : g.inY0;
    let prevMax = 0;
    layout[face].forEach((layer, li) => {
      const dias = layer.bars.map((bar) => REBARS[bar.size].dia);
      const md = Math.max(0, ...dias);
      if (li > 0) {
        const clr = Math.max(C.minClearSpacing, md, prevMax);
        edge = bottom ? edge - clr : edge + clr;
      }
      const xs = layerXs(g, dias, li);
      layer.bars.forEach((bar, i) => {
        const dia = dias[i];
        bars.push({
          id: bar.id,
          size: bar.size,
          dia,
          area: REBARS[bar.size].area,
          x: xs[i],
          y: bottom ? edge - dia / 2 : edge + dia / 2,
          face,
          layer: li,
          layerId: layer.id,
        });
      });
      const { minClear, required } = layerMinClear(g, dias, xs);
      if (layer.bars.length > 1) {
        spacing.push({ face, layer: li, layerId: layer.id, minClear, required, ok: minClear + 1e-6 >= required });
      }
      edge = bottom ? edge - md : edge + md;
      prevMax = md;
    });
  };
  placeFace('top');
  placeFace('bottom');

  if (layout.side.length > 0) {
    const centerY = (face: Face, fallback: number) => {
      const layer0 = bars.filter((bar) => bar.face === face && bar.layer === 0);
      return layer0.length ? layer0.reduce((s, bar) => s + bar.y, 0) / layer0.length : fallback;
    };
    const yTop = centerY('top', g.inY0);
    const yBot = centerY('bottom', g.inY1);
    const rows = layout.side.length;
    layout.side.forEach((row, j) => {
      const spec = REBARS[row.size];
      const y = yTop + ((yBot - yTop) * (j + 1)) / (rows + 1);
      for (const [suffix, x] of [['L', g.inX0 + spec.dia / 2], ['R', g.inX1 - spec.dia / 2]] as const) {
        bars.push({ id: `${row.id}-${suffix}`, size: row.size, dia: spec.dia, area: spec.area, x, y, face: 'side', layer: j, layerId: row.id });
      }
    });
  }

  const innerAnchorsOk =
    layout.stirrup.count === 1 ||
    ((layout.top[0]?.bars.length ?? 0) >= 4 && (layout.bottom[0]?.bars.length ?? 0) >= 4);

  return { bars, outer: g.outer, inner: g.inner, spacing, innerAnchorsOk };
}
