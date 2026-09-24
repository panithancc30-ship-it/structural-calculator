import { ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';
import { REBARS, type BarName } from '../rebar';
import type { Bar } from '../types';
import type { ColumnFace, ColumnInput, ColumnLayout, RectFace } from './types';

/** พิกัดจากจุดศูนย์ถ่วงหน้าตัด (ซม.) — x ไปขวา, y ขึ้นบน */
export interface ColumnBar {
  id: string;
  size: BarName;
  dia: number;
  area: number;
  x: number;
  y: number;
  face: ColumnFace;
}

export interface FaceSpacing {
  face: ColumnFace;
  minClear: number;
  required: number;
  ok: boolean;
}

/** เหล็กถ่าง: vertical = เส้นตั้งที่ x = pos, horizontal = เส้นนอนที่ y = pos */
export interface CrossTie {
  dir: 'vertical' | 'horizontal';
  pos: number;
}

export interface ColumnGeometry {
  shape: 'rect' | 'circle';
  bars: ColumnBar[];
  ds: number;
  /** ครึ่งความกว้าง/สูงของเส้นศูนย์กลางปลอก และรัศมีมุม */
  tieRect: { hx: number; hy: number; r: number } | null;
  /** รัศมีเส้นศูนย์กลางปลอกเกลียว */
  spiralR: number | null;
  crossTies: CrossTie[];
  spacing: FaceSpacing[];
  Ag: number;
  Ast: number;
  /** โมเมนต์อินเนอร์เชียรอบแกน x และ y */
  Ig: { x: number; y: number };
  /** ขนาดหน้าตัดในทิศ y (ใช้กับ Mx) และทิศ x (ใช้กับ My) */
  depth: { x: number; y: number };
}

const spec = (bar: Bar) => REBARS[bar.size];

function requiredClear(d1: number, d2: number): number {
  return Math.max(K.clearSpacingFactor * Math.max(d1, d2), K.clearSpacingMin);
}

function faceSpacing(face: ColumnFace, coords: number[], dias: number[]): FaceSpacing | null {
  if (coords.length < 2) return null;
  let minClear = Infinity;
  let required = 0;
  for (let i = 1; i < coords.length; i++) {
    minClear = Math.min(minClear, Math.abs(coords[i] - coords[i - 1]) - (dias[i] + dias[i - 1]) / 2);
    required = Math.max(required, requiredClear(dias[i], dias[i - 1]));
  }
  return { face, minClear, required, ok: minClear + 1e-6 >= required };
}

/**
 * index เหล็กกลางด้านที่ต้องมีเหล็กถ่างยึด (ACI 7.10.5.3):
 * เหล็กที่ไม่ยึดต้องมีช่องว่างถึงเหล็กที่ยึดแล้ว ≤ 15 ซม. และห้ามเว้นติดกันเกิน 1 เส้น
 */
export function supportedInterior(coords: number[], dias: number[]): number[] {
  const n = coords.length;
  const clear = (i: number, j: number) => Math.abs(coords[j] - coords[i]) - (dias[i] + dias[j]) / 2;
  const out: number[] = [];
  let s = 0;
  while (s < n - 1) {
    const canSkip = s + 2 <= n - 1 && (clear(s, s + 1) <= K.crossTieClearMax || clear(s + 1, s + 2) <= K.crossTieClearMax);
    s += canSkip ? 2 : 1;
    if (s < n - 1) out.push(s);
  }
  return out;
}

function mergePositions(values: number[], tol = 1): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (!out.length || Math.abs(v - out[out.length - 1]) > tol) out.push(v);
  return out;
}

export function columnGeometry(input: ColumnInput, layout: ColumnLayout): ColumnGeometry {
  const ds = REBARS[layout.tie.size].dia;
  const bars: ColumnBar[] = [];
  const spacing: FaceSpacing[] = [];

  if (layout.kind === 'circle') {
    const R = input.D / 2;
    const n = layout.bars.length;
    layout.bars.forEach((bar, i) => {
      const s = spec(bar);
      const rb = R - input.cover - ds - s.dia / 2;
      const t = Math.PI / 2 - (2 * Math.PI * i) / n;
      bars.push({ id: bar.id, size: bar.size, dia: s.dia, area: s.area, x: rb * Math.cos(t), y: rb * Math.sin(t), face: 'ring' });
    });
    if (n >= 2) {
      let minClear = Infinity;
      let required = 0;
      for (let i = 0; i < n; i++) {
        const a = bars[i];
        const b = bars[(i + 1) % n];
        minClear = Math.min(minClear, Math.hypot(a.x - b.x, a.y - b.y) - (a.dia + b.dia) / 2);
        required = Math.max(required, requiredClear(a.dia, b.dia));
      }
      spacing.push({ face: 'ring', minClear, required, ok: minClear + 1e-6 >= required });
    }
    const Ig = (Math.PI * input.D ** 4) / 64;
    return {
      shape: 'circle', bars, ds, tieRect: null, spiralR: R - input.cover - ds / 2, crossTies: [], spacing,
      Ag: Math.PI * R * R, Ast: bars.reduce((s, b) => s + b.area, 0), Ig: { x: Ig, y: Ig }, depth: { x: input.D, y: input.D },
    };
  }

  const { b, h, cover } = input;
  const ix = b / 2 - cover - ds;
  const iy = h / 2 - cover - ds;
  const [tl, tr, br, bl] = layout.corners;
  const cornerPos: [number, number, Bar | undefined][] = [
    [-1, 1, tl],
    [1, 1, tr],
    [1, -1, br],
    [-1, -1, bl],
  ];
  const corner = cornerPos.map(([sx, sy, bar]) => {
    const d = bar ? spec(bar).dia : 0;
    return { x: sx * (ix - d / 2), y: sy * (iy - d / 2), d };
  });
  cornerPos.forEach(([, , bar], i) => {
    if (bar) bars.push({ id: bar.id, size: bar.size, dia: spec(bar).dia, area: spec(bar).area, x: corner[i].x, y: corner[i].y, face: 'corner' });
  });

  const faceDefs: Record<RectFace, { from: number; to: number; along: 'x' | 'y'; fixed: (d: number) => number }> = {
    top: { from: 0, to: 1, along: 'x', fixed: (d) => iy - d / 2 },
    bottom: { from: 3, to: 2, along: 'x', fixed: (d) => -iy + d / 2 },
    left: { from: 0, to: 3, along: 'y', fixed: (d) => -ix + d / 2 },
    right: { from: 1, to: 2, along: 'y', fixed: (d) => ix - d / 2 },
  };
  const supported: Record<RectFace, number[]> = { top: [], bottom: [], left: [], right: [] };

  for (const face of ['top', 'bottom', 'left', 'right'] as RectFace[]) {
    const def = faceDefs[face];
    const list = layout[face];
    const a = corner[def.from];
    const z = corner[def.to];
    const start = def.along === 'x' ? a.x : a.y;
    const end = def.along === 'x' ? z.x : z.y;
    const coords = [start];
    const dias = [a.d];
    list.forEach((bar, k) => {
      const s = spec(bar);
      const c = start + ((end - start) * (k + 1)) / (list.length + 1);
      coords.push(c);
      dias.push(s.dia);
      const f = def.fixed(s.dia);
      bars.push({ id: bar.id, size: bar.size, dia: s.dia, area: s.area, x: def.along === 'x' ? c : f, y: def.along === 'x' ? f : c, face });
    });
    coords.push(end);
    dias.push(z.d);
    const sp = faceSpacing(face, coords, dias);
    if (sp) spacing.push(sp);
    supported[face] = supportedInterior(coords, dias).map((i) => coords[i]);
  }

  const crossTies: CrossTie[] = [
    ...mergePositions([...supported.top, ...supported.bottom]).map((pos) => ({ dir: 'vertical' as const, pos })),
    ...mergePositions([...supported.left, ...supported.right]).map((pos) => ({ dir: 'horizontal' as const, pos })),
  ];

  const refDia = Math.max(0, ...corner.map((c) => c.d));
  return {
    shape: 'rect', bars, ds,
    tieRect: { hx: b / 2 - cover - ds / 2, hy: h / 2 - cover - ds / 2, r: refDia / 2 + ds / 2 },
    spiralR: null, crossTies, spacing,
    Ag: b * h, Ast: bars.reduce((s, bar) => s + bar.area, 0),
    Ig: { x: (b * h ** 3) / 12, y: (h * b ** 3) / 12 },
    depth: { x: b, y: h },
  };
}
