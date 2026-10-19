/**
 * แปลงฐานรากเสาเข็ม → รูปตัด 1 รูป + แปลน 1 รูป ตามแบบมาตรฐาน (หน่วย ซม. ตามจริง, SVG y ชี้ลง)
 * รูปตัด X-X ผ่านศูนย์เสา: ตอม่อถึงระดับที่กำหนด เหล็กเสริม คอนกรีตหยาบ ทรายรองพื้น เสาเข็ม
 * ป้ายชี้อยู่ด้านขวา ระยะความหนาอยู่ด้านซ้าย ระยะเข็มและความกว้างอยู่ด้านล่าง
 * แปลน: เหล็กเสริม ตอม่อแรเงา เสาเข็มเส้นประ ระยะด้านซ้าย ชื่อรูปและมาตราส่วนใต้แปลน
 * ตัวเลขบอกระยะแต่ละช่วงผูกกับค่าที่แก้ได้ (DimPick) — แตะที่รูปแล้วแก้ระยะ
 * ตัวอักษรขนาดคงที่บนกระดาษ เลือกมาตราส่วนมาตรฐานที่ใหญ่ที่สุดที่พอดีกรอบ (เหมือนฐานรากแผ่)
 */
import type { Pt } from '@/engine/concrete/footing/polygon';
import type { BarDir } from '@/engine/concrete/footing/types';
import { cmToM, fmt } from '@/engine/concrete/format';
import { cageTieText, type PileCapAnalysis } from '@/engine/concrete/pilecap/analyzePileCap';
import type { PileCapInput } from '@/engine/concrete/pilecap/types';
import { textWidth } from '../drawing/drawingModel';
import {
  ASCENT,
  DESCENT,
  Extent,
  FOOTING_SCALES,
  TEXT_MM,
  addDimExtent,
  dimLine,
  sizeMm,
  textRect,
  zigzag,
  type Box,
  type DimLine,
  type DimSeg,
  type NoteText,
  type Rect,
  type TextSizes,
} from '../footing/footingDrawingModel';

/** กรอบรูปบนหน้ารายงาน (มม.) — รูปตัดวางซ้าย แปลนวางขวา */
export const SECTION_BOX = { w: 108, h: 84 };
export const PLAN_BOX = { w: 58, h: 84 };

/** ระยะที่แก้ได้จากรูป */
export type DimKey = 'B' | 'L' | 't' | 'embed' | 'lean' | 'sand' | 'edgeX' | 'edgeY' | 'spacingX' | 'spacingY' | 'ex' | 'ey';

export interface DimPick {
  kind: 'dim';
  key: DimKey;
  /** ค่าที่แสดงอยู่ (ซม.) */
  value: number;
  /** ช่วงระหว่างเข็ม = ratio·s (ระยะห่างเข็ม) */
  ratio?: number;
}

export type PileCapPick = { kind: 'bars'; dir: BarDir } | { kind: 'cage' } | DimPick;

export const PILE_LENGTH_NOTE = 'ความยาวเสาเข็มขึ้นอยู่กับผลทดสอบดิน';

const meters = (cm: number) => fmt(cm / 100, 2);
const num = (v: number) => fmt(v, Number.isInteger(v) ? 0 : 1);
const uniqueSorted = (values: number[]) => [...values].sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 0.5);

export function barSetText(a: PileCapAnalysis, dir: BarDir): string {
  const r = a[dir];
  return `${r.count}-${r.size} @${cmToM(Math.floor(r.pitch * 2) / 2)}`;
}

export const layerText = (a: PileCapAnalysis, dir: BarDir) =>
  `${a.basket ? 'ตะกร้อ ' : ''}${a[dir].isBottom ? 'ชั้นล่าง' : 'ชั้นที่ 2'}`;

/** สรุปเหล็กเสริม: เข็มต้นเดียว "8-DB16, 2ป RB9 @0.10" / เข็มกลุ่ม "X …, Y …" */
export function reinforcementText(a: PileCapAnalysis): string {
  if (a.cage) return `เหล็กยืน ${a.cage.count}-${a.cage.size}, ปลอก ${cageTieText(a.cage)}`;
  return `X ${barSetText(a, 'x')} · Y ${barSetText(a, 'y')}`;
}

export function pileText(input: PileCapInput): string {
  const size = cmToM(input.pileSize);
  return input.pileShape === 'circle' ? `เสาเข็มกลม Ø${size} ม.` : `เสาเข็ม □${size}×${size} ม.`;
}

/** ป้ายเสาเข็มตามแบบ เช่น "(เข็ม □-22 รับ นน.ปลอดภัย 20 ตัน/ต้น)" */
export function pileCallout(input: PileCapInput, n: number): string[] {
  const spec = input.pileShape === 'circle' ? `เข็มกลม Ø-${num(input.pileSize)}` : `เข็ม □-${num(input.pileSize)}`;
  return [`เสาเข็มจำนวน ${n} ต้น`, `(${spec} รับ นน.ปลอดภัย ${num(input.pileCapacity)} ตัน/ต้น)`];
}

export const planTitle = (input: PileCapInput) => input.capName || 'F1';

/** ระยะหัวเข็มฝังในฐานที่ใช้จริง */
export const embedOf = (input: PileCapInput, a: PileCapAnalysis) => (a.cage ? input.embedSingle : input.embed);

/** ช่วงต่อเนื่องระหว่างจุด (ตัดช่วงสั้นกว่า 0.5 ซม.) */
function segments(points: number[]): DimSeg[] {
  const segs: DimSeg[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    if (points[i + 1] - points[i] > 0.5) segs.push({ a: points[i], b: points[i + 1], text: meters(points[i + 1] - points[i]) });
  }
  return segs;
}

/** ช่วงขอบ → เข็ม → … → ขอบ: ช่วงริมแก้ระยะขอบ (ขนาดฐาน), ช่วงในแก้ระยะห่างเข็มตามสัดส่วน */
function chainPicks(segs: DimSeg[], edge: DimKey, spacing: DimKey, s: number): DimPick[] {
  return segs.map((seg, i) => {
    const value = seg.b - seg.a;
    return i === 0 || i === segs.length - 1 ? { kind: 'dim', key: edge, value } : { kind: 'dim', key: spacing, value, ratio: value / s };
  });
}

/** หัวลูกศรปิด ปลายที่ tip ชี้จากทิศ from */
function arrowHead(tip: Pt, from: Pt, u: number): string {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const l = 1.1 * u;
  const w = 0.36 * u;
  const bx = tip.x - ux * l;
  const by = tip.y - uy * l;
  return `M${tip.x},${tip.y} L${bx - uy * w},${by + ux * w} L${bx + uy * w},${by - ux * w} Z`;
}

/** ตัวเลขบอกระยะแนวนอนที่แตะแก้ได้ (ชั้นบางใต้ฐานราก) */
export interface DimLabel extends NoteText {
  pick: DimPick;
}

/** ป้ายชี้: เส้นจากเป้าหมาย (หัวลูกศร) ถึงหน้าข้อความ, ข้อความหลายบรรทัด */
export interface Callout {
  key: string;
  pick: PileCapPick | null;
  points: string;
  arrows: string;
  lines: NoteText[];
}

// ---------------------------------------------------------------- รูปตัด

export interface SectionPile {
  x: number;
  /** อยู่ในแนวตัด (เส้นทึบ) หรืออยู่หลังแนวตัด (เส้นประ) */
  onCut: boolean;
}

export interface SectionModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  B: number;
  t: number;
  pileSize: number;
  /** ระดับหัวเข็ม (SVG y) และปลายเข็มที่ตัดย่อ */
  pileTop: number;
  pileBottom: number;
  piles: SectionPile[];
  pileBreaks: string;
  /** แถบคอนกรีตหยาบและทราย (เว้นช่องเสาเข็มในแนวตัด) */
  lean: Box[];
  sand: Box[];
  pedestalPath: string;
  pedestalBars: string;
  breakPath: string;
  levelPath: string | null;
  levelLabel: NoteText | null;
  centerLine: string;
  /** เข็มต้นเดียว: เหล็กยืนรูปตัว U งอฉากที่ผิวบน + ปลอก (เส้นประ) */
  cagePath: string | null;
  cageWidth: number;
  ties: { x1: number; x2: number; y: number }[];
  tieWidth: number;
  /** เข็มกลุ่ม: เหล็กตามแนวตัด + จุดเหล็กตั้งฉาก */
  alongPath: string | null;
  alongWidth: number;
  dots: { x: number; y: number; r: number }[];
  callouts: Callout[];
  layerLabels: DimLabel[];
  dims: DimLine[];
  /** แตะตัวเลขบอกระยะ — ขนานกับ dims[i].texts */
  dimPicks: (DimPick | null)[][];
  extensions: string;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildSectionModel(input: PileCapInput, a: PileCapAnalysis, denom: number): SectionModel {
  const { geom, cage } = a;
  const { loc } = a.loads;
  const { nominal, actual } = a.loads.piles;
  const u = denom / 10;
  const sizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const { B, t } = a.dims;
  const cover = input.cover;
  const D = input.pileSize;
  const embed = embedOf(input, a);
  const lean = Math.max(0, input.lean);
  const sand = Math.max(0, input.sand);
  const below = lean + sand;
  const ext = new Extent();
  const occupied: Rect[] = [];
  ext.add({ x1: -B / 2, y1: -t, x2: B / 2, y2: 0 });

  // ---- ตอม่อ: สูงถึงระดับที่กำหนด (ผิวดิน Df) ดินลึกเกิน 10 มม. บนกระดาษตัดย่อ แล้วยื่นเหนือระดับเล็กน้อย
  const xc = loc.xc;
  const cx1 = xc - input.cx / 2;
  const cx2 = xc + input.cx / 2;
  const soilDepth = input.Df * 100 - t;
  const hasLevel = soilDepth > 1;
  const shown = hasLevel ? Math.min(soilDepth, 10 * u) : 0;
  const broken = hasLevel && soilDepth > shown + 0.5;
  const levelZ = t + shown;
  const zTop = levelZ + (hasLevel ? 3 * u : 5 * u);
  const breakZ = broken ? t + shown / 2 : null;
  const gap = 0.35 * u;
  const zig = Math.min(0.8 * u, input.cx / 4);
  const vertical = (x: number, z1: number, z2: number) =>
    breakZ === null || breakZ < z1 || breakZ > z2
      ? `M${x},${-z1} V${-z2}`
      : `M${x},${-z1} V${-(breakZ - gap)} M${x},${-(breakZ + gap)} V${-z2}`;
  const pedestalPath = `${vertical(cx1, t, zTop)} ${vertical(cx2, t, zTop)}`;
  let breakPath = zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -zTop, zig);
  if (breakZ !== null) {
    breakPath += ` ${zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -(breakZ - gap), zig * 0.7)} ${zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -(breakZ + gap), zig * 0.7)}`;
  }
  ext.add({ x1: cx1 - 0.8 * u, y1: -zTop - zig, x2: cx2 + 0.8 * u, y2: -t });

  // เหล็กตอม่อ: ลงถึงเหนือหัวเข็ม (ต้นเดียว) หรือวางบนเหล็กล่าง (เข็มกลุ่ม) แล้วงอฉากออกด้านนอก
  const pc = Math.min(4, input.cx / 5);
  const hook = pc + Math.max(4, 0.25 * input.cx);
  const barEnd = cage ? embed + 1.5 : cover + geom.db.x + geom.db.y + 1;
  const barDown = (x: number, hookTo: number) =>
    breakZ === null
      ? `M${x},${-zTop} V${-barEnd} H${hookTo}`
      : `M${x},${-zTop} V${-(breakZ + gap)} M${x},${-(breakZ - gap)} V${-barEnd} H${hookTo}`;
  const pedestalBars = `${barDown(cx1 + pc, cx1 + pc - hook)} ${barDown(cx2 - pc, cx2 - pc + hook)}`;

  // ---- คอนกรีตหยาบ ทราย และเสาเข็ม
  const layerExt = 2.5 * u;
  const lx1 = -B / 2 - layerExt;
  const lx2 = B / 2 + layerExt;
  const cutAt = loc.yc;
  const piles: SectionPile[] = actual.map((p) => ({ x: p.x, onCut: Math.abs(p.y - cutAt) <= D / 2 + 1e-6 }));
  const holes = uniqueSorted(piles.filter((p) => p.onCut).map((p) => p.x)).map((x) => [x - D / 2, x + D / 2] as const);
  const strips = (y: number, h: number): Box[] => {
    if (h <= 0.01) return [];
    const out: Box[] = [];
    let x = lx1;
    for (const [h1, h2] of holes) {
      if (h1 > x) out.push({ x, y, w: h1 - x, h });
      x = Math.max(x, h2);
    }
    if (lx2 > x) out.push({ x, y, w: lx2 - x, h });
    return out;
  };
  const leanBoxes = strips(0, lean);
  const sandBoxes = strips(lean, sand);
  if (below > 0.01) ext.add({ x1: lx1, y1: 0, x2: lx2, y2: below });

  const pileTop = -embed;
  const stub = 6 * u;
  const pileBottom = below + stub;
  const pileXs = uniqueSorted(piles.map((p) => p.x));
  const pileZig = Math.min(0.7 * u, D / 4);
  const pileBreaks = pileXs.map((x) => zigzag(x - D / 2 - 0.5 * u, x + D / 2 + 0.5 * u, pileBottom, pileZig)).join(' ');
  ext.add({ x1: pileXs[0] - D / 2 - 0.5 * u, y1: 0, x2: pileXs[pileXs.length - 1] + D / 2 + 0.5 * u, y2: pileBottom + pileZig });

  const centerLine = cage
    ? `M${xc},${-zTop - 1.5 * u} V${pileBottom + 1.5 * u}`
    : `M${xc},${-zTop - 1.5 * u} V${1.5 * u}`;

  // ---- เหล็กเสริม
  let cagePath: string | null = null;
  let ties: SectionModel['ties'] = [];
  let alongPath: string | null = null;
  let dots: SectionModel['dots'] = [];
  const cageWidth = cage ? Math.max(cage.db, 0.35 * u) : 0;
  const tieWidth = cage ? Math.max(cage.dt, 0.2 * u) : 0;
  let cageLeg = 0;
  if (cage) {
    cageLeg = B / 2 - cage.inset;
    const zb = cover + cage.db / 2;
    const zt = t - cover - cage.db / 2;
    const topHook = Math.min(12 * cage.db, (2 * cageLeg) / 4);
    cagePath = `M${-cageLeg + topHook},${-zt} H${-cageLeg} V${-zb} H${cageLeg} V${-zt} H${cageLeg - topHook}`;
    const tx = B / 2 - cover - cage.dt / 2;
    ties = cage.tieZ.map((z) => ({ x1: -tx, x2: tx, y: -z }));
  } else {
    const db = geom.db.x;
    const z = geom.z.x;
    const hookUp = a.x.anchorage?.hook ? Math.max(0, Math.min(12 * db, t - z - cover)) : 0;
    const bx1 = -B / 2 + cover + db / 2;
    const bx2 = B / 2 - cover - db / 2;
    alongPath = a.basket
      ? `M${bx1},${-z} H${bx2} V${-(t - z)} H${bx1} Z`
      : hookUp > 0 ? `M${bx1},${-(z + hookUp)} V${-z} H${bx2} V${-(z + hookUp)}` : `M${bx1},${-z} H${bx2}`;
    const r = Math.max(geom.db.y / 2, 0.3 * u);
    dots = geom.positions.y.map((s) => ({ x: s, y: -geom.z.y, r }));
    // ตะกร้อ: ขาบนของเหล็กอีกทิศเป็นจุดใต้ผิวบน — เพิ่มท้ายรายการ ป้ายเหล็กยังชี้จุดชั้นล่าง
    if (a.basket) dots = [...dots, ...geom.positions.y.map((s) => ({ x: s, y: -(t - geom.z.y), r }))];
  }

  // ---- เส้นบอกขนาดด้านซ้าย: ใกล้ = หัวเข็มฝัง คอนกรีตหยาบ ทราย, ไกล = ความหนา t
  // ชั้นคอนกรีตหยาบ/ทรายบาง: เขียนตัวเลขแนวนอนในช่วง (ตามแบบ) เมื่อช่วงสูงพอ ไม่เช่นนั้นเขียนความหนาในป้ายชี้แทน
  const dims: DimLine[] = [];
  const dimPicks: (DimPick | null)[][] = [];
  const extParts: string[] = [];
  const addDim = (d: DimLine, picks: (DimPick | null)[]) => {
    dims.push(d);
    dimPicks.push(picks);
  };
  const fitsLayer = (h: number) => h <= 0.5 || h >= 0.8 * sizes.small;
  const layersLeft = below > 0.5 && fitsLayer(lean) && fitsLayer(sand);
  const nearX = lx1 - 2.6 * u;
  const layerLabels: DimLabel[] = [];
  if (layersLeft) {
    if (lean > 0.5) layerLabels.push({ x: nearX - 0.7 * u, y: lean / 2 + 0.35 * sizes.small, text: meters(lean), anchor: 'end', pick: { kind: 'dim', key: 'lean', value: lean } });
    if (sand > 0.5) layerLabels.push({ x: nearX - 0.7 * u, y: lean + sand / 2 + 0.35 * sizes.small, text: meters(sand), anchor: 'end', pick: { kind: 'dim', key: 'sand', value: sand } });
    for (const l of layerLabels) {
      const r = textRect(l.x, l.y, l.text, sizes.small, 'end');
      occupied.push(r);
      ext.add(r);
    }
  }
  const nearTicks = [...(embed > 0.5 ? [-embed] : []), 0, ...(layersLeft && lean > 0.5 ? [lean] : []), ...(layersLeft && sand > 0.5 ? [below] : [])];
  if (nearTicks.length > 1) {
    const near = embed > 0.5 ? dimLine([{ a: -embed, b: 0, text: meters(embed) }], nearX, true, sizes.dim, u, occupied) : { vertical: true, row: nearX, ticks: [], texts: [] };
    addDim({ ...near, ticks: nearTicks }, embed > 0.5 ? [{ kind: 'dim', key: 'embed', value: embed }] : []);
    if (embed > 0.5) extParts.push(`M${-B / 2 - 0.8 * u},${-embed} H${nearX - 1.2 * u}`);
    extParts.push(`M${-B / 2 - 0.8 * u},0 H${nearX - 1.2 * u}`);
    if (layersLeft && lean > 0.5) extParts.push(`M${lx1 - 0.8 * u},${lean} H${nearX - 1.2 * u}`);
    if (layersLeft && sand > 0.5) extParts.push(`M${lx1 - 0.8 * u},${below} H${nearX - 1.2 * u}`);
  }
  const labelW = Math.max(0, ...layerLabels.map((l) => textWidth(l.text, sizes.small)));
  const farX = nearX - Math.max(5 * u, labelW + 2.4 * u);
  addDim(dimLine([{ a: -t, b: 0, text: meters(t) }], farX, true, sizes.dim, u, occupied), [{ kind: 'dim', key: 't', value: t }]);
  extParts.push(`M${-B / 2 - 0.8 * u},${-t} H${farX - 1.2 * u}`, `M${-B / 2 - 0.8 * u},0 H${farX - 1.2 * u}`);

  // ---- เส้นบอกขนาดด้านล่าง: ขอบ → เข็ม → ขอบ แล้วความกว้างรวม
  let row = pileBottom + pileZig + 3.4 * u;
  const ticks = uniqueSorted(nominal.map((p) => p.x));
  const chain = segments([-B / 2, ...ticks, B / 2]);
  if (chain.length > 1) {
    const d = dimLine(chain, row, false, sizes.dim, u, occupied);
    addDim(d, chainPicks(chain, 'edgeX', 'spacingX', input.spacing));
    for (const x of ticks) extParts.push(`M${x},${pileBottom + pileZig + 0.6 * u} V${row + 1.2 * u}`);
    row += d.texts.some((tx) => tx.side > 0) ? 5.8 * u : 4.4 * u;
  }
  addDim(dimLine([{ a: -B / 2, b: B / 2, text: meters(B) }], row, false, sizes.dim, u, occupied), [{ kind: 'dim', key: 'B', value: B }]);
  extParts.push(`M${-B / 2},${0.8 * u} V${row + 1.2 * u}`, `M${B / 2},${0.8 * u} V${row + 1.2 * u}`);
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  // ---- ป้ายชี้ด้านขวา เรียงจากบนลงล่าง ไม่ทับกัน
  const xText = lx2 + 4.5 * u;
  const xKnee = lx2 + 1.6 * u;
  const lineH = 1.3 * sizes.label;
  type Spec = { key: string; pick: PileCapPick | null; y: number; lines: string[]; route: (y: number) => { pts: Pt[]; tips: { tip: Pt; from: Pt }[] } };
  const viaKnee = (target: Pt) => (y: number) => {
    const pts = [target, { x: xKnee, y: target.y }, { x: xKnee + 1.2 * u, y }, { x: xText - 0.5 * u, y }];
    return { pts, tips: [{ tip: target, from: pts[1] }] };
  };
  // เส้นเฉียงตรงจากเป้าหมายถึงบ่า — ใช้กับเหล็กสองชั้นที่อยู่ชิดกัน เส้นชี้จึงไม่ซ้อนกัน
  const direct = (target: Pt) => (y: number) => {
    const pts = [target, { x: xKnee + 1.2 * u, y }, { x: xText - 0.5 * u, y }];
    return { pts, tips: [{ tip: target, from: pts[1] }] };
  };
  const specs: Spec[] = [];
  const pedTop = hasLevel ? levelZ : zTop - zig;
  specs.push({ key: 'pedestal', pick: null, y: -(t + (pedTop - t) * 0.55), lines: ['ตอม่อ ดูขยายเสา'], route: viaKnee({ x: cx2, y: -(t + (pedTop - t) * 0.55) }) });
  if (cage) {
    // ปลอก: ลูกศรชี้ลงที่ปลอกชั้นที่สองจากบน — เหล็กยืน: เส้นผ่านขาทั้งสองข้าง หัวลูกศรที่ขาเหล็ก
    const tie = ties[Math.max(0, ties.length - 2)];
    const tieX = cageLeg - Math.min(0.35 * cageLeg, 4 * u);
    specs.push({
      key: 'tie', pick: { kind: 'cage' }, y: tie.y - 2.4 * u, lines: [cageTieText(cage)],
      route: (y) => {
        if (y > tie.y - 0.8 * u) return viaKnee({ x: tieX, y: tie.y })(y);
        const pts = [{ x: tieX, y: tie.y }, { x: tieX, y }, { x: xText - 0.5 * u, y }];
        return { pts, tips: [{ tip: pts[0], from: pts[1] }] };
      },
    });
    const between = ties.length > 2 ? (ties[Math.floor(ties.length / 2)].y + ties[Math.floor(ties.length / 2) - 1].y) / 2 : -t / 2;
    specs.push({
      key: 'vertical', pick: { kind: 'cage' }, y: between, lines: [`${cage.count}-${cage.size}`],
      route: (y) => {
        const left = { x: -cageLeg, y: between };
        const right = { x: cageLeg, y: between };
        const pts = [left, right, { x: xKnee, y: between }, { x: xKnee + 1.2 * u, y }, { x: xText - 0.5 * u, y }];
        return { pts, tips: [{ tip: left, from: { x: 0, y: between } }, { tip: right, from: { x: 0, y: between } }] };
      },
    });
  } else {
    const sideLen = B / 2 - (xc + input.cx / 2);
    const ax = B / 2 - Math.min(Math.max(sideLen, 0) * 0.45, cover + 4 * u);
    const pool = dots.slice(0, geom.positions.y.length).filter((d) => d.x < ax - 0.5 * u);
    const dot = (pool.length > 0 ? pool : dots).reduce<(typeof dots)[number] | null>(
      (best, d) => (!best || Math.abs(d.x - (ax - 2 * u)) < Math.abs(best.x - (ax - 2 * u)) ? d : best),
      null,
    );
    const zAlong = geom.z.x;
    // เหล็กตามแนวตัด (อยู่ด้านนอก) ไปป้ายล่าง, จุดเหล็กตั้งฉาก (อยู่ด้านใน) ไปป้ายบน — เส้นชี้ไม่ตัดกัน
    specs.push({
      key: 'x', pick: { kind: 'bars', dir: 'x' }, y: -0.3 * t, lines: [`${barSetText(a, 'x')} (${layerText(a, 'x')})`],
      route: direct({ x: ax, y: -zAlong }),
    });
    if (dot) {
      specs.push({
        key: 'y', pick: { kind: 'bars', dir: 'y' }, y: -0.62 * t, lines: [`${barSetText(a, 'y')} (${layerText(a, 'y')})`],
        route: direct({ x: dot.x, y: dot.y }),
      });
    }
  }
  const thick = (h: number) => (layersLeft ? '' : ` หนา ${meters(h)}`);
  const layerPick = (key: DimKey, h: number): DimPick | null => (layersLeft ? null : { kind: 'dim', key, value: h });
  if (lean > 0.5) {
    specs.push({ key: 'lean', pick: layerPick('lean', lean), y: lean / 2, lines: [`คอนกรีต 1:3:5${thick(lean)}`], route: viaKnee({ x: B / 2 + layerExt * 0.6, y: lean / 2 }) });
  }
  if (sand > 0.5) {
    specs.push({
      key: 'sand', pick: layerPick('sand', sand), y: lean + sand / 2, lines: [`ทรายราดน้ำอัดแน่น${thick(sand)}`],
      route: viaKnee({ x: B / 2 + layerExt * 0.6, y: lean + sand / 2 }),
    });
  }
  const cutPiles = piles.filter((p) => p.onCut);
  const pileX = Math.max(...(cutPiles.length > 0 ? cutPiles : piles).map((p) => p.x)) + D / 2;
  const pileY = below + stub * 0.45;
  specs.push({ key: 'pile', pick: null, y: pileY, lines: pileCallout(input, nominal.length), route: viaKnee({ x: pileX, y: pileY }) });

  // ระดับที่กำหนด: เส้นศูนย์กลาง (ขีดจุด) ตัดตอม่อ ข้อความอยู่เหนือเส้นแนวเดียวกับป้ายชี้
  let levelPath: string | null = null;
  let levelLabel: NoteText | null = null;
  let floor = -Infinity;
  if (hasLevel) {
    const label = 'ระดับที่กำหนด';
    levelLabel = { x: xText, y: -levelZ - 0.6 * u, text: label, anchor: 'start' };
    levelPath = `M${-B / 2 - 1.5 * u},${-levelZ} H${xText + textWidth(label, sizes.label)}`;
    ext.add(textRect(levelLabel.x, levelLabel.y, label, sizes.label, 'start'));
    floor = -levelZ + 0.7 * sizes.label;
  }

  const callouts: Callout[] = [];
  for (const spec of [...specs].sort((p, q) => p.y - q.y)) {
    const y = Math.max(spec.y, floor);
    floor = y + (spec.lines.length - 1) * lineH + 1.3 * sizes.label;
    const { pts, tips } = spec.route(y);
    const lines = spec.lines.map((text, i) => ({ x: xText, y: y + 0.35 * sizes.label + i * lineH, text, anchor: 'start' as const }));
    for (const l of lines) ext.add(textRect(l.x, l.y, l.text, sizes.label, 'start'));
    for (const p of pts) ext.add({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    callouts.push({
      key: spec.key,
      pick: spec.pick,
      points: pts.map((p) => `${p.x},${p.y}`).join(' '),
      arrows: tips.map((tp) => arrowHead(tp.tip, tp.from, u)).join(' '),
      lines,
    });
  }

  const view = ext.box(1.2 * u);
  return {
    denom, u, sizes, B, t, pileSize: D, pileTop, pileBottom, piles, pileBreaks,
    lean: leanBoxes, sand: sandBoxes, pedestalPath, pedestalBars, breakPath, levelPath, levelLabel, centerLine,
    cagePath, cageWidth, ties, tieWidth, alongPath, alongWidth: Math.max(geom.db.x, 0.35 * u), dots,
    callouts, layerLabels, dims, dimPicks, extensions: extParts.join(' '), view, sizeMm: sizeMm(view, denom),
  };
}

// ---------------------------------------------------------------- แปลน

export interface PileMark {
  x: number;
  y: number;
  /** ตำแหน่งตามแบบ เมื่อเข็มเยื้อง */
  nominal: Pt | null;
  number: NoteText | null;
  over: boolean;
}

export interface PlanTitle {
  text: string;
  y: number;
  size: number;
  scaleText: string;
  scaleY: number;
  scaleSize: number;
}

export interface PlanModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  B: number;
  L: number;
  column: Box;
  /** เครื่องหมาย + ที่ศูนย์เสา */
  cross: string;
  /** เข็มกลุ่ม: เหล็กตะแกรงสองทิศ */
  lines: Record<BarDir, { x1: number; y1: number; x2: number; y2: number }[]>;
  /** เข็มต้นเดียว: ปลอกรอบนอก ปลอกข้าวหลามตัด และเหล็กยืน 8 เส้น */
  tie: { x: number; y: number; w: number; h: number; r: number; width: number } | null;
  diamond: string | null;
  bars: { x: number; y: number; r: number }[];
  piles: PileMark[];
  dims: DimLine[];
  dimPicks: (DimPick | null)[][];
  extensions: string;
  title: PlanTitle;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildPlanModel(input: PileCapInput, a: PileCapAnalysis, denom: number): PlanModel {
  const { B, L } = a.dims;
  const { nominal, actual, groupCenter: gc, column } = a.loads.piles;
  const { cage } = a;
  const u = denom / 10;
  const sizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const cover = input.cover;
  const ext = new Extent();
  ext.add({ x1: -B / 2, y1: -L / 2, x2: B / 2, y2: L / 2 });
  const occupied: Rect[] = [];

  const columnBox = { x: column.x - input.cx / 2, y: -column.y - input.cy / 2, w: input.cx, h: input.cy };
  const arm = 0.42 * Math.min(input.cx, input.cy);
  const cross = `M${column.x - arm},${-column.y} H${column.x + arm} M${column.x},${-column.y - arm} V${-column.y + arm}`;

  let lines: PlanModel['lines'] = { x: [], y: [] };
  let tie: PlanModel['tie'] = null;
  let diamond: string | null = null;
  let bars: PlanModel['bars'] = [];
  if (cage) {
    const hx = B / 2 - cover - cage.dt / 2;
    const hy = L / 2 - cover - cage.dt / 2;
    tie = { x: -hx, y: -hy, w: 2 * hx, h: 2 * hy, r: cage.dt + cage.db / 2, width: Math.max(cage.dt, 0.2 * u) };
    diamond = `M0,${-hy} L${hx},0 L0,${hy} L${-hx},0 Z`;
    const r = Math.max(cage.db / 2, 0.35 * u);
    bars = cage.bars.map((p) => ({ x: p.x, y: -p.y, r }));
  } else {
    lines = {
      x: a.geom.positions.x.map((y) => ({ x1: -B / 2 + cover, y1: -y, x2: B / 2 - cover, y2: -y })),
      y: a.geom.positions.y.map((x) => ({ x1: x, y1: L / 2 - cover, x2: x, y2: -L / 2 + cover })),
    };
  }

  const R = a.loads.service.R;
  const piles: PileMark[] = actual.map((p, i) => {
    const n = nominal[i];
    return {
      x: p.x,
      y: -p.y,
      nominal: Math.hypot(p.x - n.x, p.y - n.y) > 0.05 ? { x: n.x, y: -n.y } : null,
      number: nominal.length > 1 ? { x: p.x, y: -p.y + 0.36 * sizes.small, text: String(i + 1), anchor: 'middle' } : null,
      over: R[i] > a.pile.Pa * (1 + 1e-6) || R[i] < -a.pile.Ta - 1e-6,
    };
  });

  // ---- เส้นบอกขนาด: ด้านซ้าย (แกน y) ใกล้รูป: เยื้องศูนย์ → ระยะเข็ม → รวม, ด้านล่างเฉพาะเยื้องศูนย์ ex
  const dims: DimLine[] = [];
  const dimPicks: (DimPick | null)[][] = [];
  const extParts: string[] = [];
  const ex = column.x - gc.x;
  const ey = column.y - gc.y;
  if (Math.abs(ex) > 0.5) {
    const row = L / 2 + 5 * u;
    dims.push(dimLine([{ a: Math.min(gc.x, column.x), b: Math.max(gc.x, column.x), text: `e ${meters(Math.abs(ex))}` }], row, false, sizes.dim, u, occupied));
    dimPicks.push([{ kind: 'dim', key: 'ex', value: Math.abs(ex) }]);
    extParts.push(`M${column.x},${L / 2 + 0.8 * u} V${row + 1.2 * u}`, `M${gc.x},${L / 2 + 1.6 * u} V${row + 1.2 * u}`);
  }
  let col = -B / 2 - 5 * u;
  if (Math.abs(ey) > 0.5) {
    dims.push(dimLine([{ a: Math.min(-gc.y, -column.y), b: Math.max(-gc.y, -column.y), text: `e ${meters(Math.abs(ey))}` }], col, true, sizes.dim, u, occupied));
    dimPicks.push([{ kind: 'dim', key: 'ey', value: Math.abs(ey) }]);
    extParts.push(`M${-B / 2 - 0.8 * u},${-column.y} H${col - 1.2 * u}`, `M${-B / 2 - 1.6 * u},${-gc.y} H${col - 1.2 * u}`);
    col -= 5 * u;
  }
  const ys = uniqueSorted(nominal.map((p) => -p.y));
  const chainY = segments([-L / 2, ...ys, L / 2]);
  // เข็มต้นเดียวมีแค่ระยะขอบถึงศูนย์ (ตามแบบมาตรฐาน) — เข็มกลุ่มเพิ่มความยาวรวม
  const overall = chainY.length <= 1 || nominal.length > 1;
  if (chainY.length > 1) {
    dims.push(dimLine(chainY, col, true, sizes.dim, u, occupied));
    dimPicks.push(chainPicks(chainY, 'edgeY', 'spacingY', input.spacing));
    for (const y of ys) extParts.push(`M${-B / 2 - 0.8 * u},${y} H${col - 1.2 * u}`);
    if (overall) col -= 5 * u;
  }
  if (overall) {
    dims.push(dimLine([{ a: -L / 2, b: L / 2, text: meters(L) }], col, true, sizes.dim, u, occupied));
    dimPicks.push([{ kind: 'dim', key: 'L', value: L }]);
  }
  for (const y of [-L / 2, L / 2]) extParts.push(`M${-B / 2 - 0.8 * u},${y} H${col - 1.2 * u}`);
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  // ---- ชื่อรูป + มาตราส่วนใต้แปลน
  const size = TEXT_MM.title * 1.15 * u;
  const titleY = ext.y2 + 3.2 * u + ASCENT * size;
  const title: PlanTitle = {
    text: planTitle(input),
    y: titleY,
    size,
    scaleText: `มาตราส่วน 1:${denom}`,
    scaleY: titleY + DESCENT * size + 0.8 * u + ASCENT * TEXT_MM.sub * u,
    scaleSize: TEXT_MM.sub * u,
  };
  ext.add(textRect(0, title.y, title.text, size, 'middle'));
  ext.add(textRect(0, title.scaleY, title.scaleText, title.scaleSize, 'middle'));

  const view = ext.box(1.2 * u);
  return {
    denom, u, sizes, B, L, column: columnBox, cross, lines, tie, diamond, bars, piles, dims, dimPicks,
    extensions: extParts.join(' '), title, view, sizeMm: sizeMm(view, denom),
  };
}

const fits = (size: { w: number; h: number }, box: { w: number; h: number }) => size.w <= box.w && size.h <= box.h;

/** มาตราส่วนเดียวทั้งรูปตัดและแปลน — มาตราส่วนมาตรฐานที่ใหญ่ที่สุดที่ทั้งสองรูปพอดีกรอบ */
export function pickDrawingScale(input: PileCapInput, a: PileCapAnalysis, planBox = PLAN_BOX, sectionBox = SECTION_BOX): number {
  return (
    FOOTING_SCALES.find((d) => fits(buildPlanModel(input, a, d).sizeMm, planBox) && fits(buildSectionModel(input, a, d).sizeMm, sectionBox)) ??
    FOOTING_SCALES[FOOTING_SCALES.length - 1]
  );
}
