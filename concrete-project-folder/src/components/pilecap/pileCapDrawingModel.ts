/**
 * แปลงฐานรากเสาเข็ม → องค์ประกอบแปลนและรูปตัด (หน่วย ซม. ตามจริง, SVG y ชี้ลง)
 * ใช้หลักเดียวกับฐานรากแผ่: ตัวอักษรขนาดคงที่บนกระดาษ, เลือกมาตราส่วนมาตรฐานที่ใหญ่ที่สุดที่พอดีกรอบ,
 * ตัวเลขบอกขนาดหลบกันอัตโนมัติ และส่วนที่ไม่ใช่รูปจริง (เข็มใต้ฐาน, ตอม่อ) ย่อด้วยเส้นตัดขนาดคงที่บนกระดาษ
 */
import type { Pt } from '../../domain/footing/polygon';
import type { BarDir } from '../../domain/footing/types';
import { cmToM, fmt } from '../../domain/format';
import type { PileCapAnalysis } from '../../domain/pilecap/analyzePileCap';
import type { PileCapInput } from '../../domain/pilecap/types';
import { textWidth } from '../drawing/drawingModel';
import {
  ASCENT,
  Extent,
  FOOTING_SCALES,
  TEXT_MM,
  addDimExtent,
  addTitleExtent,
  dimLine,
  sizeMm,
  textRect,
  titleBlock,
  zigzag,
  type Box,
  type DimLine,
  type DimSeg,
  type Leader,
  type NoteText,
  type Rect,
  type TextSizes,
  type TitleBlock,
} from '../footing/footingDrawingModel';

/** กรอบรูปบนใบ A4 (มม.) */
export const PLAN_BOX = { w: 90, h: 78 };
export const SECTION_BOX = { w: 90, h: 38 };

export type PileCapPick = { kind: 'bars'; dir: BarDir };

export const LENGTH_NOTE_SHORT = 'ขึ้นอยู่กับผลทดสอบดิน';
export const PILE_LENGTH_NOTE = `L = ความยาวเสาเข็ม ${LENGTH_NOTE_SHORT}`;

const meters = (cm: number) => fmt(cm / 100, 2);
const uniqueSorted = (values: number[]) => [...values].sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 0.5);

export function barSetText(a: PileCapAnalysis, dir: BarDir): string {
  const r = a[dir];
  return `${r.count}-${r.size} @${cmToM(Math.floor(r.pitch * 2) / 2)}`;
}

export const layerText = (a: PileCapAnalysis, dir: BarDir) => (a[dir].isBottom ? 'ชั้นล่าง' : 'ชั้นที่ 2');

export function pileText(input: PileCapInput): string {
  const size = cmToM(input.pileSize);
  return input.pileShape === 'circle' ? `เสาเข็มกลม Ø${size} ม.` : `เสาเข็ม □${size}×${size} ม.`;
}

export const planTitle = (input: PileCapInput) => `PLAN ${input.capName || 'F1'}`;
export const sectionTitle = (dir: BarDir) => (dir === 'x' ? 'SECTION X-X' : 'SECTION Y-Y');

/** ช่วงต่อเนื่องระหว่างจุด (ตัดช่วงสั้นกว่า 0.5 ซม.) */
function segments(points: number[]): DimSeg[] {
  const segs: DimSeg[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    if (points[i + 1] - points[i] > 0.5) segs.push({ a: points[i], b: points[i + 1], text: meters(points[i + 1] - points[i]) });
  }
  return segs;
}

/** เลือกเหล็กเส้นใกล้ตำแหน่งสัดส่วน frac ที่ไม่อยู่ในช่วงเสา */
function pickBar(positions: number[], frac: number, avoidLo: number, avoidHi: number): number {
  const target = frac * (positions.length - 1);
  const order = positions.map((_, i) => i).sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  return order.find((i) => positions[i] < avoidLo || positions[i] > avoidHi) ?? order[0];
}

// ---------------------------------------------------------------- แปลน

export interface PileMark {
  x: number;
  y: number;
  /** ตำแหน่งตามแบบ เมื่อเข็มเยื้อง */
  nominal: Pt | null;
  number: NoteText;
  reaction: NoteText;
  over: boolean;
}

export interface PlanModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  B: number;
  L: number;
  column: Box;
  center: Pt;
  lines: Record<BarDir, { x1: number; y1: number; x2: number; y2: number }[]>;
  piles: PileMark[];
  leaders: Leader[];
  dims: DimLine[];
  extensions: string;
  notes: NoteText[];
  titleBlock: TitleBlock;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildPlanModel(input: PileCapInput, a: PileCapAnalysis, denom: number): PlanModel {
  const { B, L } = a.dims;
  const { nominal, actual, groupCenter: gc, column } = a.loads.piles;
  const { loc } = a.loads;
  const u = denom / 10;
  const sizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const cover = input.cover;
  const D = input.pileSize;
  const ext = new Extent();
  ext.add({ x1: -B / 2, y1: -L / 2, x2: B / 2, y2: L / 2 });
  const occupied: Rect[] = [];

  const lines: PlanModel['lines'] = {
    x: a.geom.positions.x.map((y) => ({ x1: -B / 2 + cover, y1: -y, x2: B / 2 - cover, y2: -y })),
    y: a.geom.positions.y.map((x) => ({ x1: x, y1: L / 2 - cover, x2: x, y2: -L / 2 + cover })),
  };
  const columnBox = { x: column.x - input.cx / 2, y: -column.y - input.cy / 2, w: input.cx, h: input.cy };

  // ---- เสาเข็ม: หมายเลขกลางเข็ม แรงในเข็มใต้เข็ม
  const R = a.loads.service.R;
  const piles: PileMark[] = actual.map((p, i) => {
    const n = nominal[i];
    const reaction: NoteText = { x: p.x, y: -p.y + D / 2 + 0.7 * u + ASCENT * sizes.small, text: `R ${fmt(R[i] / 1000, 2)}`, anchor: 'middle' };
    ext.add(textRect(reaction.x, reaction.y, reaction.text, sizes.small, 'middle'));
    return {
      x: p.x,
      y: -p.y,
      nominal: Math.hypot(p.x - n.x, p.y - n.y) > 0.05 ? { x: n.x, y: -n.y } : null,
      number: { x: p.x, y: -p.y + 0.36 * sizes.small, text: String(i + 1), anchor: 'middle' },
      reaction,
      over: R[i] > a.pile.Pa * (1 + 1e-6) || R[i] < -a.pile.Ta - 1e-6,
    };
  });

  // ---- ป้ายเหล็ก (เหมือนฐานรากแผ่): X ออกขวา, Y ขึ้นบน
  const leaders: Leader[] = [];
  const px = a.geom.positions.x;
  if (px.length > 0) {
    const y = -px[pickBar(px, 0.72, loc.faces.bottom - 1.5 * u, loc.faces.top + 1.5 * u)];
    const x0 = B / 2 + 2.5 * u;
    const text = barSetText(a, 'x');
    const sub = layerText(a, 'x');
    const w = Math.max(textWidth(text, sizes.label), textWidth(sub, sizes.small));
    leaders.push({
      key: 'x', dir: 'x', text, anchor: 'start',
      points: `${B / 2 - cover},${y} ${x0 + w + 0.3 * u},${y}`,
      tx: x0, ty: y - 0.6 * u,
      sub: { text: sub, x: x0, y: y + ASCENT * sizes.small + 0.6 * u },
    });
  }
  const py = a.geom.positions.y;
  if (py.length > 0) {
    const x = py[pickBar(py, 0.3, loc.faces.left - 1.5 * u, loc.faces.right + 1.5 * u)];
    const ys = -L / 2 - 3.4 * u;
    const text = barSetText(a, 'y');
    const sub = layerText(a, 'y');
    const w = Math.max(textWidth(text, sizes.label), textWidth(sub, sizes.small));
    leaders.push({
      key: 'y', dir: 'y', text, anchor: 'start',
      points: `${x},${-(L / 2 - cover)} ${x},${ys} ${x + 0.8 * u + w + 0.3 * u},${ys}`,
      tx: x + 0.8 * u, ty: ys - 0.6 * u,
      sub: { text: sub, x: x + 0.8 * u, y: ys + ASCENT * sizes.small + 0.6 * u },
    });
  }
  for (const l of leaders) {
    const r1 = textRect(l.tx, l.ty, l.text, sizes.label, 'start');
    occupied.push(r1);
    ext.add(r1);
    if (l.sub) {
      const r2 = textRect(l.sub.x, l.sub.y, l.sub.text, sizes.small, 'start');
      occupied.push(r2);
      ext.add(r2);
    }
  }

  // ---- เส้นบอกขนาด: ด้านล่าง (แกน x) และด้านซ้าย (แกน y) เรียงจากใกล้รูป: เยื้องศูนย์ → ระยะเข็ม → รวม
  const dims: DimLine[] = [];
  const extParts: string[] = [];
  const ex = column.x - gc.x;
  const ey = column.y - gc.y;

  let row = L / 2 + 5 * u;
  if (Math.abs(ex) > 0.5) {
    const d = dimLine([{ a: Math.min(gc.x, column.x), b: Math.max(gc.x, column.x), text: `e ${meters(Math.abs(ex))}` }], row, false, sizes.dim, u, occupied);
    dims.push(d);
    extParts.push(`M${column.x},${L / 2 + 0.8 * u} V${row + 1.2 * u}`, `M${gc.x},${L / 2 + 1.6 * u} V${row + 1.2 * u}`);
    row += d.texts.some((t) => t.side > 0) ? 6.5 * u : 5 * u;
  }
  const xs = uniqueSorted(nominal.map((p) => p.x));
  const chainX = segments([-B / 2, ...xs, B / 2]);
  if (chainX.length > 1) {
    const d = dimLine(chainX, row, false, sizes.dim, u, occupied);
    dims.push(d);
    for (const x of xs) extParts.push(`M${x},${L / 2 + 0.8 * u} V${row + 1.2 * u}`);
    row += d.texts.some((t) => t.side > 0) ? 6.5 * u : 5 * u;
  }
  dims.push(dimLine([{ a: -B / 2, b: B / 2, text: meters(B) }], row, false, sizes.dim, u, occupied));
  for (const x of [-B / 2, B / 2]) extParts.push(`M${x},${L / 2 + 0.8 * u} V${row + 1.2 * u}`);

  let col = -B / 2 - 5 * u;
  if (Math.abs(ey) > 0.5) {
    dims.push(dimLine([{ a: Math.min(-gc.y, -column.y), b: Math.max(-gc.y, -column.y), text: `e ${meters(Math.abs(ey))}` }], col, true, sizes.dim, u, occupied));
    extParts.push(`M${-B / 2 - 0.8 * u},${-column.y} H${col - 1.2 * u}`, `M${-B / 2 - 1.6 * u},${-gc.y} H${col - 1.2 * u}`);
    col -= 5 * u;
  }
  const ys = uniqueSorted(nominal.map((p) => -p.y));
  const chainY = segments([-L / 2, ...ys, L / 2]);
  if (chainY.length > 1) {
    dims.push(dimLine(chainY, col, true, sizes.dim, u, occupied));
    for (const y of ys) extParts.push(`M${-B / 2 - 0.8 * u},${y} H${col - 1.2 * u}`);
    col -= 5 * u;
  }
  dims.push(dimLine([{ a: -L / 2, b: L / 2, text: meters(L) }], col, true, sizes.dim, u, occupied));
  for (const y of [-L / 2, L / 2]) extParts.push(`M${-B / 2 - 0.8 * u},${y} H${col - 1.2 * u}`);
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  // ---- ชื่อรูป + หมายเหตุเสาเข็ม
  const titleY = Math.max(ext.y2, row + 1.2 * u) + 3.2 * u + ASCENT * TEXT_MM.title * u;
  const tb = titleBlock(planTitle(input), `แปลนฐานรากเสาเข็ม   SCALE 1:${denom}`, titleY, TEXT_MM.title * u, TEXT_MM.sub * u, 4 * u);
  addTitleExtent(ext, tb, u);
  const notes: NoteText[] = [
    { x: 0, y: tb.subY + 3.2 * u, text: `${pileText(input)} จำนวน ${nominal.length} ต้น ยาว L (ขึ้นอยู่กับผลทดสอบดิน)`, anchor: 'middle' },
    { x: 0, y: tb.subY + 6 * u, text: `R = แรงในเสาเข็ม (ตัน) — รับน้ำหนักปลอดภัย ${fmt(input.pileCapacity, 1)} ตัน/ต้น`, anchor: 'middle' },
  ];
  for (const n of notes) ext.add(textRect(n.x, n.y, n.text, sizes.small, n.anchor));

  const view = ext.box(1.2 * u);
  return {
    denom, u, sizes, B, L, column: columnBox, center: { x: gc.x, y: -gc.y }, lines, piles, leaders, dims,
    extensions: extParts.join(' '), notes, titleBlock: tb, view, sizeMm: sizeMm(view, denom),
  };
}

// ---------------------------------------------------------------- รูปตัด

export interface SectionPile {
  x: number;
  /** อยู่ในแนวตัด (เส้นทึบ) หรืออยู่หลังแนวตัด (เส้นประ) */
  onCut: boolean;
}

/** ชื่อรูปบรรทัดเดียว: ชื่อ (ขีดเส้นใต้คู่) ตามด้วยมาตราส่วนตัวเล็ก */
export interface InlineTitle {
  text: string;
  x: number;
  y: number;
  size: number;
  width: number;
  scaleText: string;
  scaleX: number;
  scaleSize: number;
}

export interface SectionModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  dir: BarDir;
  span: number;
  t: number;
  embed: number;
  pileSize: number;
  /** ความยาวเข็มที่วาดใต้ท้องฐาน (ย่อด้วยเส้นตัด) */
  pileStub: number;
  piles: SectionPile[];
  pileBreaks: string;
  groundPath: string;
  groundHatch: Box[];
  pedestalPath: string;
  breakPath: string;
  alongPath: string;
  alongWidth: number;
  dots: { x: number; y: number; r: number }[];
  leaders: Leader[];
  dims: DimLine[];
  extensions: string;
  /** หัวลูกศรปลายเส้นบอกความยาวเข็ม L (ยาวต่อลงไป) */
  arrow: string;
  /** "L" ตัวหนา ตามด้วยหมายเหตุผลทดสอบดิน ข้างเส้นบอกความยาวเข็ม (ตำแหน่ง/การจัดของทั้งบรรทัด) */
  lengthLabel: NoteText;
  notes: NoteText[];
  title: InlineTitle;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildSectionModel(input: PileCapInput, a: PileCapAnalysis, dir: BarDir, denom: number): SectionModel {
  const { geom } = a;
  const { loc } = a.loads;
  const { nominal, actual } = a.loads.piles;
  const u = denom / 10;
  const sizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const span = dir === 'x' ? a.dims.B : a.dims.L;
  const t = a.dims.t;
  const other: BarDir = dir === 'x' ? 'y' : 'x';
  // แกนนอนของรูปตัด: X-X ตามแกน x, Y-Y ตามแกน y
  const along = (p: Pt) => (dir === 'x' ? p.x : p.y);
  const across = (p: Pt) => (dir === 'x' ? p.y : p.x);
  const c = dir === 'x' ? loc.xc : loc.yc;
  const cw = dir === 'x' ? input.cx : input.cy;
  const cutAt = dir === 'x' ? loc.yc : loc.xc;
  const cover = input.cover;
  const D = input.pileSize;
  const ext = new Extent();
  const occupied: Rect[] = [];

  // ป้ายเหล็กและป้ายผิวดินอยู่ด้านที่ยื่นยาวกว่า, ความหนา t และความยาวเข็ม L อยู่อีกด้าน
  const negLen = c - cw / 2 + span / 2;
  const posLen = span / 2 - (c + cw / 2);
  const side = negLen > posLen + 0.5 ? -1 : 1;
  const dimSide = -side;
  const anchorOut = (s: number) => (s < 0 ? 'end' : 'start') as 'start' | 'end';

  // ---- ดินถมและตอม่อ: ความลึกดินที่วาดไม่เกิน 3 มม. บนกระดาษ ลึกกว่านั้นตัดย่อ
  const soilDepth = input.Df * 100 - t;
  const hasGround = soilDepth > 1;
  const soilShown = Math.min(soilDepth, 3 * u);
  const broken = hasGround && soilDepth > soilShown + 0.5;
  const groundZ = hasGround ? t + soilShown : null;
  const zTop = (groundZ ?? t) + 2.6 * u;
  const cx1 = c - cw / 2;
  const cx2 = c + cw / 2;
  const zig = Math.min(0.8 * u, cw / 4);
  const breakZ = broken && groundZ !== null ? t + soilShown / 2 : null;
  const gap = 0.35 * u;
  const pedestalPath =
    breakZ === null
      ? `M${cx1},${-t} V${-zTop} M${cx2},${-t} V${-zTop}`
      : `M${cx1},${-t} V${-(breakZ - gap)} M${cx1},${-(breakZ + gap)} V${-zTop} M${cx2},${-t} V${-(breakZ - gap)} M${cx2},${-(breakZ + gap)} V${-zTop}`;
  let breakPath = zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -zTop, zig);
  if (breakZ !== null) {
    breakPath += ` ${zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -(breakZ - gap), zig * 0.7)} ${zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -(breakZ + gap), zig * 0.7)}`;
  }
  ext.add({ x1: -span / 2, y1: -zTop - zig, x2: span / 2, y2: 0 });

  const notes: NoteText[] = [];
  let groundPath = '';
  const groundHatch: Box[] = [];
  if (groundZ !== null) {
    const x1 = -span / 2 - 2 * u;
    const x2 = span / 2 + 2 * u;
    groundPath = `M${x1},${-groundZ} H${cx1} M${cx2},${-groundZ} H${x2}`;
    groundHatch.push({ x: x1, y: -groundZ, w: Math.max(0, cx1 - x1), h: 0.8 * u }, { x: cx2, y: -groundZ, w: Math.max(0, x2 - cx2), h: 0.8 * u });
    const label: NoteText = { x: side * (span / 2 + 2.6 * u), y: -groundZ + 0.35 * sizes.small, text: 'ผิวดิน', anchor: anchorOut(side) };
    notes.push(label);
    const r = textRect(label.x, label.y, label.text, sizes.small, label.anchor);
    occupied.push(r);
    ext.add(r);
  }

  // ---- เสาเข็ม: วาดใต้ท้องฐานยาวคงที่บนกระดาษ แล้วตัดย่อ
  const pileStub = 4.5 * u;
  const piles: SectionPile[] = actual.map((p) => ({ x: along(p), onCut: Math.abs(across(p) - cutAt) <= D / 2 + 1e-6 }));
  const pileXs = uniqueSorted(piles.map((p) => p.x));
  const pileZig = Math.min(0.7 * u, D / 4);
  const pileBreaks = pileXs.map((x) => zigzag(x - D / 2 - 0.5 * u, x + D / 2 + 0.5 * u, pileStub, pileZig)).join(' ');
  ext.add({ x1: pileXs[0] - D / 2 - 0.5 * u, y1: 0, x2: pileXs[pileXs.length - 1] + D / 2 + 0.5 * u, y2: pileStub + pileZig });

  // ---- เหล็ก: งอขอขึ้นเมื่อระยะฝังตรงไม่พอ
  const db = geom.db[dir];
  const z = geom.z[dir];
  const hook = a[dir].anchorage?.hook ? Math.max(0, Math.min(12 * db, t - z - cover)) : 0;
  const bx1 = -span / 2 + cover + db / 2;
  const bx2 = span / 2 - cover - db / 2;
  const alongPath = hook > 0 ? `M${bx1},${-(z + hook)} V${-z} H${bx2} V${-(z + hook)}` : `M${bx1},${-z} H${bx2}`;
  const dotR = Math.max(geom.db[other] / 2, 0.3 * u);
  const dots = geom.positions[other].map((s) => ({ x: s, y: -geom.z[other], r: dotR }));

  // ---- ป้ายเหล็กข้างฐานราก: เส้นชี้เฉียงจากเหล็กออกนอกขอบ หักเป็นเส้นระดับใต้ข้อความ
  const sideLen = Math.max(negLen, posLen);
  const ax = side < 0 ? -span / 2 + Math.min(sideLen * 0.45, cover + 4 * u) : span / 2 - Math.min(sideLen * 0.45, cover + 4 * u);
  const kneeX = side * (span / 2 + 2.2 * u);
  const shelf1 = -t + 0.9 * u + ASCENT * sizes.label;
  const shelf2 = shelf1 + sizes.label * 1.55;
  const target = ax - side * 2 * u;
  const pool = dots.filter((d) => (side < 0 ? d.x > ax + 0.5 * u : d.x < ax - 0.5 * u));
  const dotPick = (pool.length > 0 ? pool : dots).reduce<(typeof dots)[number] | null>(
    (best, d) => (!best || Math.abs(d.x - target) < Math.abs(best.x - target) ? d : best),
    null,
  );
  const makeLeader = (d: BarDir, x: number, y: number, shelf: number): Leader => {
    const text = `${barSetText(a, d)} (${layerText(a, d)})`;
    const tx = kneeX + side * 0.7 * u;
    const end = tx + side * (textWidth(text, sizes.label) + 0.3 * u);
    return { key: d, dir: d, anchor: anchorOut(side), text, points: `${x},${y} ${kneeX},${shelf} ${end},${shelf}`, tx, ty: shelf - 0.5 * u };
  };
  // เส้นชี้เหล็กตามแนว (ชั้นล่างสุด) ไปป้ายล่าง, จุดเหล็กตั้งฉาก (อยู่ด้านใน) ไปป้ายบน — ไม่ตัดกัน
  const leaders: Leader[] = [];
  if (dotPick) leaders.push(makeLeader(other, dotPick.x, dotPick.y, shelf1));
  leaders.push(makeLeader(dir, ax, -z, dotPick ? shelf2 : shelf1));
  for (const l of leaders) {
    const r = textRect(l.tx, l.ty, l.text, sizes.label, l.anchor);
    occupied.push(r);
    ext.add(r);
  }

  // ---- ความหนา t
  const dims: DimLine[] = [];
  const dimT = dimSide * (span / 2 + 3.6 * u);
  dims.push(dimLine([{ a: -t, b: 0, text: meters(t) }], dimT, true, sizes.dim, u, occupied));
  const extParts = [`M${dimSide * (span / 2 + 0.8 * u)},0 H${dimT + dimSide * 1.2 * u}`, `M${dimSide * (span / 2 + 0.8 * u)},${-t} H${dimT + dimSide * 1.2 * u}`];

  // ---- ความยาวเข็ม L: จากหัวเข็ม ลูกศรชี้ลง + "L ขึ้นอยู่กับผลทดสอบดิน" ออกด้านนอก ใต้ท้องฐาน
  const outerPile = dimSide > 0 ? pileXs[pileXs.length - 1] : pileXs[0];
  const lx = outerPile + dimSide * (D / 2 + 1.6 * u);
  const lTop = -input.embed;
  const lEnd = pileStub + pileZig + 0.6 * u;
  const lDim: DimLine = { vertical: true, row: lx, ticks: [lTop], texts: [], path: `M${lx},${lTop - 1 * u} V${lEnd}` };
  dims.push(lDim);
  extParts.push(`M${outerPile + dimSide * (D / 2 + 0.4 * u)},${lTop} H${lx + dimSide * 1 * u}`);
  const arrow = `M${lx - 0.5 * u},${lEnd - 1.5 * u} L${lx},${lEnd} L${lx + 0.5 * u},${lEnd - 1.5 * u}`;
  ext.add({ x1: lx - u, y1: lTop - u, x2: lx + u, y2: lEnd });
  // อ่านซ้ายไปขวาเสมอ: "L ขึ้นอยู่กับผลทดสอบดิน" (ด้านซ้ายจัดชิดขวาเข้าหาเส้น)
  const lengthLabel: NoteText = { x: lx + dimSide * 0.9 * u, y: 1.6 * u + ASCENT * sizes.dim * 1.15, text: 'L', anchor: anchorOut(dimSide) };
  const labelW = textWidth('L', sizes.dim * 1.15) + textWidth(` ${LENGTH_NOTE_SHORT}`, sizes.small);
  const lx1 = dimSide > 0 ? lengthLabel.x : lengthLabel.x - labelW;
  const labelRect = { x1: lx1, y1: lengthLabel.y - ASCENT * sizes.dim * 1.15, x2: lx1 + labelW, y2: lengthLabel.y + 0.3 * u };
  occupied.push(labelRect);
  ext.add(labelRect);

  // ---- ระยะเข็ม (ต่อเนื่อง) และความกว้างรวม ใต้เข็ม
  let row = pileStub + pileZig + 3.4 * u;
  const ticks = uniqueSorted(nominal.map(along));
  const chain = segments([-span / 2, ...ticks, span / 2]);
  if (chain.length > 1) {
    const d = dimLine(chain, row, false, sizes.dim, u, occupied);
    dims.push(d);
    for (const x of ticks) extParts.push(`M${x},${pileStub + pileZig + 0.6 * u} V${row + 1.2 * u}`);
    row += d.texts.some((tx) => tx.side > 0) ? 5.8 * u : 4.2 * u;
  }
  dims.push(dimLine([{ a: -span / 2, b: span / 2, text: meters(span) }], row, false, sizes.dim, u, occupied));
  extParts.push(`M${-span / 2},${0.8 * u} V${row + 1.2 * u}`, `M${span / 2},${0.8 * u} V${row + 1.2 * u}`);
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  // ---- ชื่อรูปบรรทัดเดียว
  const titleSize = TEXT_MM.sectionTitle * u;
  const scaleSize = TEXT_MM.sectionSub * u;
  const text = sectionTitle(dir);
  const scaleText = `SCALE 1:${denom}`;
  const width = textWidth(text, titleSize);
  const total = width + 2 * u + textWidth(scaleText, scaleSize);
  const titleY = Math.max(ext.y2, row + 1.2 * u) + 2.2 * u + ASCENT * titleSize;
  const title: InlineTitle = { text, x: -total / 2, y: titleY, size: titleSize, width, scaleText, scaleX: -total / 2 + width + 2 * u, scaleSize };
  ext.add({ x1: -total / 2, y1: titleY - ASCENT * titleSize, x2: total / 2, y2: titleY + 1.6 * u });

  const view = ext.box(1.2 * u);
  return {
    denom, u, sizes, dir, span, t, embed: input.embed, pileSize: D, pileStub, piles, pileBreaks,
    groundPath, groundHatch, pedestalPath, breakPath,
    alongPath, alongWidth: Math.max(db, 0.35 * u), dots, leaders, dims, extensions: extParts.join(' '), arrow,
    lengthLabel, notes, title, view, sizeMm: sizeMm(view, denom),
  };
}

const fits = (size: { w: number; h: number }, box: { w: number; h: number }) => size.w <= box.w && size.h <= box.h;

/**
 * มาตราส่วนเดียวทั้งแปลนและรูปตัด (แบบรายละเอียดชุดเดียวกัน) — มาตราส่วนมาตรฐานที่ใหญ่ที่สุดที่ทุกรูปพอดีกรอบบนใบ A4
 */
export function pickDrawingScale(input: PileCapInput, a: PileCapAnalysis): number {
  return (
    FOOTING_SCALES.find(
      (d) =>
        fits(buildPlanModel(input, a, d).sizeMm, PLAN_BOX) &&
        (['x', 'y'] as const).every((dir) => fits(buildSectionModel(input, a, dir, d).sizeMm, SECTION_BOX)),
    ) ?? FOOTING_SCALES[FOOTING_SCALES.length - 1]
  );
}
