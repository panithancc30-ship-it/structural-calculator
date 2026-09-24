/**
 * แปลงฐานราก → องค์ประกอบรูปแปลนและรูปตัด (หน่วย ซม. ตามจริง, พิกัด SVG y ชี้ลง) + เลือกมาตราส่วนให้พอดีกรอบกระดาษ
 * ขนาดตัวอักษรคงที่บนกระดาษเหมือนแบบก่อสร้าง — มาตราส่วนเลือกให้รูปใหญ่ที่สุดที่พอดีกรอบ ตัวอักษรจึงได้สัดส่วนกับรูป
 */
import type { FootingAnalysis } from '@/engine/concrete/footing/analyzeFooting';
import { otherDir, spanOf } from '@/engine/concrete/footing/geometry';
import { clipHalfPlane, rectPolygon } from '@/engine/concrete/footing/polygon';
import { pressureAt } from '@/engine/concrete/footing/pressure';
import type { BarDir, FootingInput } from '@/engine/concrete/footing/types';
import { cmToM, fmt } from '@/engine/concrete/format';
import { textWidth } from '../drawing/drawingModel';

export const FOOTING_SCALES = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300] as const;

/** กรอบรูปบนใบ A4 (มม.) */
export const PLAN_BOX = { w: 90, h: 96 };
export const SECTION_BOX = { w: 90, h: 46 };

/** ความสูงตัวอักษรบนกระดาษ (มม.) */
export const TEXT_MM = { label: 2.3, dim: 2.2, small: 2.0, title: 3.6, sub: 2.2, sectionTitle: 3.2, sectionSub: 2.0 };
export const ASCENT = 0.78;
export const DESCENT = 0.22;

export type FootingPick = { kind: 'bars'; dir: BarDir };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DimSeg {
  a: number;
  b: number;
  text: string;
}

/** ตัวเลขบอกขนาด: center ตามแนวเส้น, side −1 = เหนือเส้น (แนวตั้ง: ซ้าย), +1 = ใต้เส้น (แนวตั้ง: ขวา) */
export interface DimText {
  center: number;
  side: -1 | 1;
  text: string;
}

export interface DimLine {
  vertical: boolean;
  /** ตำแหน่งเส้น (แนวนอน = y, แนวตั้ง = x) */
  row: number;
  ticks: number[];
  texts: DimText[];
  /** เส้นบอกขนาดแบบกำหนดเอง (เช่น มีเครื่องหมายตัดย่อ) */
  path?: string;
}

export interface Leader {
  key: string;
  dir: BarDir;
  points: string;
  text: string;
  tx: number;
  ty: number;
  anchor: 'start' | 'end';
  sub?: { text: string; x: number; y: number };
}

export interface NoteText {
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
}

export interface TitleBlock {
  title: string;
  titleW: number;
  titleY: number;
  titleSize: number;
  subText: string;
  subY: number;
  subSize: number;
}

export interface TextSizes {
  label: number;
  dim: number;
  small: number;
}

export const sizeMm = (view: Box, denom: number) => ({ w: (view.w * 10) / denom, h: (view.h * 10) / denom });
const meters = (cm: number) => fmt(cm / 100, 2);

export function barSetText(a: FootingAnalysis, dir: BarDir): string {
  const r = a[dir];
  return `${r.count}-${r.size} @${cmToM(Math.floor(r.pitch * 2) / 2)}`;
}

export const layerText = (a: FootingAnalysis, dir: BarDir) => (a[dir].isBottom ? 'ชั้นล่าง' : 'ชั้นที่ 2');

// ---------------------------------------------------------------- เครื่องมือจัดวางข้อความ

export class Extent {
  x1 = Infinity;
  y1 = Infinity;
  x2 = -Infinity;
  y2 = -Infinity;
  add(r: Rect) {
    this.x1 = Math.min(this.x1, r.x1);
    this.y1 = Math.min(this.y1, r.y1);
    this.x2 = Math.max(this.x2, r.x2);
    this.y2 = Math.max(this.y2, r.y2);
  }
  box(pad: number): Box {
    return { x: this.x1 - pad, y: this.y1 - pad, w: this.x2 - this.x1 + 2 * pad, h: this.y2 - this.y1 + 2 * pad };
  }
}

export const overlaps = (a: Rect, b: Rect, pad = 0) => a.x1 < b.x2 + pad && a.x2 > b.x1 - pad && a.y1 < b.y2 + pad && a.y2 > b.y1 - pad;

/** กรอบข้อความแนวนอน */
export function textRect(x: number, y: number, text: string, size: number, anchor: 'start' | 'middle' | 'end'): Rect {
  const w = textWidth(text, size);
  const x1 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x1, y1: y - ASCENT * size, x2: x1 + w, y2: y + DESCENT * size };
}

/** เส้นฐานของตัวเลขบอกขนาดเทียบกับเส้น */
export const dimBaseline = (row: number, side: -1 | 1, size: number, u: number) =>
  side < 0 ? row - 0.8 * u : row + 0.6 * u + ASCENT * size;

function dimTextRect(line: Pick<DimLine, 'vertical' | 'row'>, t: DimText, size: number, u: number): Rect {
  const w = textWidth(t.text, size);
  const base = dimBaseline(line.row, t.side, size, u);
  const across = [base - ASCENT * size, base + DESCENT * size];
  const along = [t.center - w / 2, t.center + w / 2];
  return line.vertical
    ? { x1: across[0], y1: along[0], x2: across[1], y2: along[1] }
    : { x1: along[0], y1: across[0], x2: along[1], y2: across[1] };
}

/**
 * เส้นบอกขนาดต่อเนื่อง: ตัวเลขอยู่กลางช่วงเหนือเส้น ถ้าช่วงสั้นกว่าตัวเลข → ช่วงแรกออกไปด้านหน้า, ช่วงสุดท้ายออกด้านหลัง,
 * ช่วงกลางลงใต้เส้น แล้วเลี่ยงข้อความที่วางไว้แล้ว (occupied)
 */
export function dimLine(segs: DimSeg[], row: number, vertical: boolean, size: number, u: number, occupied: Rect[]): DimLine {
  const line = { vertical, row };
  const texts: DimText[] = [];
  const pad = 0.6 * u;
  const out = 1.6 * u;
  segs.forEach((s, i) => {
    const w = textWidth(s.text, size);
    const mid = (s.a + s.b) / 2;
    const fits = w + 2 * pad <= s.b - s.a;
    const before: DimText = { center: s.a - out - w / 2, side: -1, text: s.text };
    const after: DimText = { center: s.b + out + w / 2, side: -1, text: s.text };
    const above: DimText = { center: mid, side: -1, text: s.text };
    const below: DimText = { center: mid, side: 1, text: s.text };
    const preferred = fits
      ? [above]
      : segs.length === 1
        ? [after, before]
        : i === 0
          ? [before, below]
          : i === segs.length - 1
            ? [after, below]
            : [below, above];
    const candidates = [...preferred, below, after, before, above];
    const free = (c: DimText) => {
      const r = dimTextRect(line, c, size, u);
      return !occupied.some((o) => overlaps(r, o, 0.3 * u));
    };
    const chosen = candidates.find(free) ?? preferred[0];
    texts.push(chosen);
    occupied.push(dimTextRect(line, chosen, size, u));
  });
  const ticks = segs.length ? [segs[0].a, ...segs.map((s) => s.b)] : [];
  return { vertical, row, ticks, texts };
}

export function addDimExtent(ext: Extent, line: DimLine, size: number, u: number) {
  if (line.ticks.length === 0) return;
  const lo = line.ticks[0] - 1.2 * u;
  const hi = line.ticks[line.ticks.length - 1] + 1.2 * u;
  ext.add(line.vertical ? { x1: line.row - u, y1: lo, x2: line.row + u, y2: hi } : { x1: lo, y1: line.row - u, x2: hi, y2: line.row + u });
  for (const t of line.texts) ext.add(dimTextRect(line, t, size, u));
}

/** ช่วงบอกขนาดระหว่างขอบฐานรากและผิวเสา (ตัดช่วงสั้นกว่า 0.5 ซม.) */
function chain(lo: number, hi: number, f1: number, f2: number): DimSeg[] {
  const pts = [lo, f1, f2, hi].map((v) => Math.min(hi, Math.max(lo, v)));
  const segs: DimSeg[] = [];
  for (let i = 0; i < 3; i++) {
    if (pts[i + 1] - pts[i] > 0.5) segs.push({ a: pts[i], b: pts[i + 1], text: meters(pts[i + 1] - pts[i]) });
  }
  return segs;
}

/** เลือกเหล็กเส้นใกล้ตำแหน่งสัดส่วน frac ที่ไม่อยู่ในช่วงเสา (ป้ายไม่ทับเสา) */
function pickBar(positions: number[], frac: number, avoidLo: number, avoidHi: number): number {
  const target = frac * (positions.length - 1);
  const order = positions.map((_, i) => i).sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
  return order.find((i) => positions[i] < avoidLo || positions[i] > avoidHi) ?? order[0];
}

export function titleBlock(title: string, subText: string, titleY: number, titleSize: number, subSize: number, gap: number): TitleBlock {
  return { title, titleW: textWidth(title, titleSize), titleY, titleSize, subText, subY: titleY + gap, subSize };
}

export function addTitleExtent(ext: Extent, t: TitleBlock, u: number) {
  ext.add(textRect(0, t.titleY, t.title, t.titleSize, 'middle'));
  ext.add({ x1: -t.titleW / 2, y1: t.titleY, x2: t.titleW / 2, y2: t.titleY + 1.8 * u });
  ext.add(textRect(0, t.subY, t.subText, t.subSize, 'middle'));
}

// ---------------------------------------------------------------- แปลน

export interface PlanModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  B: number;
  L: number;
  column: Box;
  lines: Record<BarDir, { x1: number; y1: number; x2: number; y2: number }[]>;
  leaders: Leader[];
  dims: DimLine[];
  /** เส้นช่วยบอกขนาด */
  extensions: string;
  noContact: string | null;
  zeroLine: { x1: number; y1: number; x2: number; y2: number } | null;
  corners: NoteText[];
  notes: NoteText[];
  titleBlock: TitleBlock;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildPlanModel(input: FootingInput, a: FootingAnalysis, denom: number, title: string): PlanModel {
  const { B, L } = a.dims;
  const { loc, pressure } = a.loads;
  const u = denom / 10;
  const sizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const cover = input.cover;
  const ext = new Extent();
  ext.add({ x1: -B / 2, y1: -L / 2, x2: B / 2, y2: L / 2 });
  const occupied: Rect[] = [];

  const lines: PlanModel['lines'] = {
    x: a.geom.positions.x.map((y) => ({ x1: -B / 2 + cover, y1: -y, x2: B / 2 - cover, y2: -y })),
    y: a.geom.positions.y.map((x) => ({ x1: x, y1: -(-L / 2 + cover), x2: x, y2: -(L / 2 - cover) })),
  };
  const column = { x: loc.xc - input.cx / 2, y: -(loc.yc + input.cy / 2), w: input.cx, h: input.cy };

  // ---- ป้ายเหล็ก: ข้อความบนบ่าเส้นชี้ บรรทัดสองบอกชั้น
  const leaders: Leader[] = [];
  const px = a.geom.positions.x;
  if (px.length > 0) {
    const y = -px[pickBar(px, 0.72, loc.faces.bottom - 1.5 * u, loc.faces.top + 1.5 * u)];
    const x0 = B / 2 + 2.5 * u;
    const text = barSetText(a, 'x');
    const sub = layerText(a, 'x');
    const w = Math.max(textWidth(text, sizes.label), textWidth(sub, sizes.small));
    const leader: Leader = {
      key: 'x', dir: 'x', text, anchor: 'start',
      points: `${B / 2 - cover},${y} ${x0 + w + 0.3 * u},${y}`,
      tx: x0, ty: y - 0.6 * u,
      sub: { text: sub, x: x0, y: y + ASCENT * sizes.small + 0.6 * u },
    };
    leaders.push(leader);
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

  // ---- แรงดันดินที่มุม: เขียนในรูปเมื่อมีที่ว่าง ไม่เช่นนั้นเขียนเป็นหมายเหตุใต้ชื่อรูป
  const corners: NoteText[] = [];
  const notes: NoteText[] = [];
  const cornerName = ['ล่างซ้าย', 'ล่างขวา', 'บนขวา', 'บนซ้าย'];
  if (pressure.stable) {
    const inset = 1.2 * u;
    const candidates = pressure.corners.map((c) => ({
      x: c.x < 0 ? c.x + inset : c.x - inset,
      y: c.y < 0 ? -c.y - inset : -c.y + inset + ASCENT * sizes.small,
      anchor: (c.x < 0 ? 'start' : 'end') as 'start' | 'end',
      text: `q ${fmt(c.q * 10, 2)}`,
    }));
    const colRect = { x1: column.x, y1: column.y, x2: column.x + column.w, y2: column.y + column.h };
    const rects = candidates.map((c) => textRect(c.x, c.y, c.text, sizes.small, c.anchor));
    const fit = rects.every(
      (r, i) => !overlaps(r, colRect, 0.6 * u) && rects.every((o, j) => i === j || !overlaps(r, o, 0.8 * u)),
    );
    if (fit) corners.push(...candidates);
  }

  // ---- เส้นบอกขนาด: ต่อเนื่อง (ใกล้รูป) และรวม (ไกล)
  const dims: DimLine[] = [];
  const chainX = chain(-B / 2, B / 2, loc.faces.left, loc.faces.right);
  const chainY = chain(-L / 2, L / 2, loc.faces.bottom, loc.faces.top);
  const svgChainY = chainY.map((s) => ({ a: -s.b, b: -s.a, text: s.text })).reverse();

  let rowOverall = L / 2 + 5 * u;
  let rowChain: number | null = null;
  if (chainX.length > 1) {
    rowChain = rowOverall;
    const d = dimLine(chainX, rowChain, false, sizes.dim, u, occupied);
    dims.push(d);
    rowOverall = rowChain + (d.texts.some((t) => t.side > 0) ? 6.5 * u : 5 * u);
  }
  dims.push(dimLine([{ a: -B / 2, b: B / 2, text: meters(B) }], rowOverall, false, sizes.dim, u, occupied));

  let colOverall = -B / 2 - 5 * u;
  let colChain: number | null = null;
  if (svgChainY.length > 1) {
    colChain = colOverall;
    dims.push(dimLine(svgChainY, colChain, true, sizes.dim, u, occupied));
    colOverall = colChain - 5 * u;
  }
  dims.push(dimLine([{ a: -L / 2, b: L / 2, text: meters(L) }], colOverall, true, sizes.dim, u, occupied));
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  const extParts: string[] = [];
  for (const x of [-B / 2, B / 2]) extParts.push(`M${x},${L / 2 + 0.8 * u} V${rowOverall + 1.2 * u}`);
  if (rowChain !== null) {
    for (const x of [loc.faces.left, loc.faces.right]) {
      if (x > -B / 2 + 0.5 && x < B / 2 - 0.5) extParts.push(`M${x},${L / 2 + 0.8 * u} V${rowChain + 1.2 * u}`);
    }
  }
  for (const y of [-L / 2, L / 2]) extParts.push(`M${-B / 2 - 0.8 * u},${y} H${colOverall - 1.2 * u}`);
  if (colChain !== null) {
    for (const y of [-loc.faces.top, -loc.faces.bottom]) {
      if (y > -L / 2 + 0.5 && y < L / 2 - 0.5) extParts.push(`M${-B / 2 - 0.8 * u},${y} H${colChain - 1.2 * u}`);
    }
  }

  // ---- ส่วนที่ดินไม่รับแรงดัน
  let noContact: string | null = null;
  let zeroLine: PlanModel['zeroLine'] = null;
  if (pressure.stable && !pressure.full) {
    const poly = clipHalfPlane(rectPolygon(-B / 2, B / 2, -L / 2, L / 2), -pressure.q0, -pressure.gx, -pressure.gy);
    if (poly.length >= 3) noContact = poly.map((p) => `${p.x},${-p.y}`).join(' ');
    const onLine = poly.filter((p) => Math.abs(pressure.q0 + pressure.gx * p.x + pressure.gy * p.y) < 1e-6 * Math.max(1, pressure.qmax));
    if (onLine.length >= 2) zeroLine = { x1: onLine[0].x, y1: -onLine[0].y, x2: onLine[1].x, y2: -onLine[1].y };
  }

  // ---- ชื่อรูป + หมายเหตุแรงดันดิน
  const titleY = Math.max(ext.y2, rowOverall + 1.2 * u) + 3.2 * u + ASCENT * TEXT_MM.title * u;
  const tb = titleBlock(title, `แปลนฐานราก   SCALE 1:${denom}`, titleY, TEXT_MM.title * u, TEXT_MM.sub * u, 4 * u);
  addTitleExtent(ext, tb, u);
  if (pressure.stable && corners.length === 0) {
    const q = pressure.corners.map((c, i) => `${cornerName[i]} ${fmt(c.q * 10, 2)}`);
    const y1 = tb.subY + 3.2 * u;
    notes.push(
      { x: 0, y: y1, text: `แรงดันดินที่มุม (t/m²): ${q[3]} · ${q[2]}`, anchor: 'middle' },
      { x: 0, y: y1 + 2.8 * u, text: `${q[0]} · ${q[1]}`, anchor: 'middle' },
    );
  } else if (pressure.stable) {
    notes.push({ x: 0, y: tb.subY + 3.2 * u, text: 'q = แรงดันดินที่มุม (t/m²)', anchor: 'middle' });
  }
  for (const n of notes) ext.add(textRect(n.x, n.y, n.text, sizes.small, n.anchor));

  const view = ext.box(1.2 * u);
  return {
    denom, u, sizes, B, L, column, lines, leaders, dims, extensions: extParts.join(' '),
    noContact, zeroLine, corners, notes, titleBlock: tb, view, sizeMm: sizeMm(view, denom),
  };
}

// ---------------------------------------------------------------- รูปตัด

export interface SectionModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  dir: BarDir;
  span: number;
  t: number;
  column: Box;
  /** ระดับผิวดินที่วาด (อาจย่อด้วยเส้นตัดเมื่อดินลึก) */
  groundZ: number | null;
  groundPath: string;
  groundHatch: Box[];
  groundLabel: NoteText | null;
  /** ระดับเส้นตัดย่อความลึก (null = วาดตามจริง) */
  breakZ: number | null;
  pedestalPath: string;
  breakPath: string;
  alongPath: string;
  alongWidth: number;
  dots: { x: number; y: number; r: number }[];
  leaders: Leader[];
  pressure: { outline: string; hatch: string; texts: NoteText[] } | null;
  dims: DimLine[];
  extensions: string;
  titleBlock: TitleBlock;
  view: Box;
  sizeMm: { w: number; h: number };
}

export const zigzag = (x1: number, x2: number, y: number, a: number) => {
  const xm = (x1 + x2) / 2;
  return `M${x1},${y} H${xm - a} L${xm - a / 2},${y - a} L${xm + a / 2},${y + a} L${xm + a},${y} H${x2}`;
};

export function buildSectionModel(input: FootingInput, a: FootingAnalysis, dir: BarDir, denom: number, title: string): SectionModel {
  const { dims: fd, geom } = a;
  const { loc, pressure } = a.loads;
  const u = denom / 10;
  const sizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const span = spanOf(fd, dir);
  const t = fd.t;
  const other = otherDir(dir);
  const c = dir === 'x' ? loc.xc : loc.yc;
  const cw = dir === 'x' ? input.cx : input.cy;
  const cover = input.cover;
  const ext = new Extent();
  const occupied: Rect[] = [];

  // ---- ป้ายเหล็กอยู่ด้านที่ยื่นยาวกว่า เส้นบอกขนาดความหนา/Df อยู่อีกด้าน
  const negLen = c - cw / 2 + span / 2;
  const posLen = span / 2 - (c + cw / 2);
  const side = negLen >= posLen ? -1 : 1;
  const dimSide = -side;

  // ---- ความลึกดิน: ย่อด้วยเส้นตัดเมื่อลึกกว่า max(15 ซม., 0.2·ช่วง)
  const soilDepth = input.Df * 100 - t;
  const hasGround = soilDepth > 1;
  const cap = Math.max(15, 0.2 * span);
  const broken = hasGround && soilDepth > cap * 1.001;
  const groundZ = hasGround ? t + Math.min(soilDepth, cap) : null;
  const breakZ = broken && groundZ !== null ? (t + groundZ) / 2 : null;
  const zTop = (groundZ ?? t) + Math.max(10, 3 * u);
  const cx1 = c - cw / 2;
  const cx2 = c + cw / 2;
  ext.add({ x1: -span / 2, y1: -zTop - u, x2: span / 2, y2: 0 });

  const gap = 0.45 * u;
  const pedestalPath =
    breakZ === null
      ? `M${cx1},${-t} V${-zTop} M${cx2},${-t} V${-zTop}`
      : `M${cx1},${-t} V${-(breakZ - gap)} M${cx1},${-(breakZ + gap)} V${-zTop} M${cx2},${-t} V${-(breakZ - gap)} M${cx2},${-(breakZ + gap)} V${-zTop}`;
  const zig = Math.min(0.9 * u, cw / 4);
  let breakPath = zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -zTop, zig);
  if (breakZ !== null) {
    breakPath += ` ${zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -(breakZ - gap), zig)} ${zigzag(cx1 - 0.8 * u, cx2 + 0.8 * u, -(breakZ + gap), zig)}`;
  }

  // ---- เหล็ก: งอขอขึ้นเมื่อระยะฝังตรงไม่พอ
  const db = geom.db[dir];
  const z = geom.z[dir];
  const hook = a[dir].anchorage?.hook ? Math.max(0, Math.min(12 * db, t - z - cover)) : 0;
  const bx1 = -span / 2 + cover + db / 2;
  const bx2 = span / 2 - cover - db / 2;
  const alongPath = hook > 0 ? `M${bx1},${-(z + hook)} V${-z} H${bx2} V${-(z + hook)}` : `M${bx1},${-z} H${bx2}`;
  const dotR = Math.max(geom.db[other] / 2, 0.3 * u);
  const dots = geom.positions[other].map((s) => ({ x: s, y: -geom.z[other], r: dotR }));

  // ---- ป้ายเหล็กออกนอกฐานราก
  const sideLen = Math.max(negLen, posLen);
  const ax = side < 0 ? -span / 2 + sideLen * 0.3 : span / 2 - sideLen * 0.3;
  const edgeX = side * (span / 2 + 2 * u);
  const anchor = side < 0 ? 'end' : 'start';
  const labelY1 = -(t + 2.2 * u);
  const labelY2 = labelY1 - sizes.label * 1.35;
  const leaderTo = (x: number, y: number, ly: number) => `${x},${y} ${x},${ly} ${edgeX},${ly}`;
  // จุดเหล็กตั้งฉากที่อยู่ด้านในของเส้นชี้แรก — เส้นชี้ไม่ตัดกัน
  const inner = dots.filter((d) => (side < 0 ? d.x > ax + 0.5 * u : d.x < ax - 0.5 * u));
  const pool = inner.length > 0 ? inner : dots;
  const nearestDot = pool.length > 0 ? pool.reduce((best, d) => (Math.abs(d.x - ax) < Math.abs(best.x - ax) ? d : best)) : null;
  const leaders: Leader[] = [
    {
      key: dir, dir, anchor, text: `${barSetText(a, dir)} (${layerText(a, dir)})`,
      points: leaderTo(ax, -z, labelY1), tx: edgeX + side * 0.6 * u, ty: labelY1 + 0.35 * sizes.label,
    },
  ];
  if (nearestDot) {
    leaders.push({
      key: other, dir: other, anchor, text: `${barSetText(a, other)} (${layerText(a, other)})`,
      points: leaderTo(nearestDot.x, nearestDot.y, labelY2), tx: edgeX + side * 0.6 * u, ty: labelY2 + 0.35 * sizes.label,
    });
  }
  for (const l of leaders) {
    const r = textRect(l.tx, l.ty, l.text, sizes.label, l.anchor);
    occupied.push(r);
    ext.add(r);
  }

  // ---- เส้นบอกขนาดความหนาและ Df
  const dims: DimLine[] = [];
  const dimT = dimSide * (span / 2 + 4 * u);
  dims.push(dimLine([{ a: -t, b: 0, text: meters(t) }], dimT, true, sizes.dim, u, occupied));
  const extParts = [`M${dimSide * (span / 2 + 0.8 * u)},0 H${dimT + dimSide * 1.2 * u}`, `M${dimSide * (span / 2 + 0.8 * u)},${-t} H${dimT + dimSide * 1.2 * u}`];

  let groundPath = '';
  const groundHatch: Box[] = [];
  let groundLabel: NoteText | null = null;
  if (groundZ !== null) {
    const dfX = dimSide * (span / 2 + 9 * u);
    const dfDim = dimLine([{ a: -groundZ, b: 0, text: `Df ${fmt(input.Df, 2)}` }], dfX, true, sizes.dim, u, occupied);
    dims.push(dfDim);
    const dfLine =
      breakZ === null
        ? `M${dfX},${1.2 * u} V${-groundZ - 1.2 * u}`
        : `M${dfX},${1.2 * u} V${-(breakZ - gap)} L${dfX + 0.8 * u},${-(breakZ - gap / 3)} L${dfX - 0.8 * u},${-(breakZ + gap / 3)} L${dfX},${-(breakZ + gap)} V${-groundZ - 1.2 * u}`;
    dfDim.path = dfLine;
    extParts.push(`M${dimSide * (Math.abs(dimT) + 0.8 * u)},0 H${dfX + dimSide * 1.2 * u}`);

    const labelText = 'ผิวดิน';
    const lw = textWidth(labelText, sizes.small);
    const labelEnd = dfX + dimSide * (1.2 * u + lw + 0.4 * u);
    const nearEnd = side * (span / 2 + 1 * u);
    const [gx1, gx2] = dimSide > 0 ? [nearEnd, labelEnd] : [labelEnd, nearEnd];
    groundPath = `M${gx1},${-groundZ} H${cx1} M${cx2},${-groundZ} H${gx2}`;
    groundHatch.push({ x: gx1, y: -groundZ, w: Math.max(0, cx1 - gx1), h: 0.9 * u }, { x: cx2, y: -groundZ, w: Math.max(0, gx2 - cx2), h: 0.9 * u });
    groundLabel = { x: dfX + dimSide * 1.2 * u, y: -groundZ - 0.6 * u, text: labelText, anchor: dimSide > 0 ? 'start' : 'end' };
    ext.add(textRect(groundLabel.x, groundLabel.y, labelText, sizes.small, groundLabel.anchor));
    ext.add({ x1: Math.min(gx1, gx2), y1: -groundZ, x2: Math.max(gx1, gx2), y2: -groundZ });
  }

  // ---- แผนภาพแรงดันดินตามแนวตัดผ่านศูนย์เสา
  let pressureModel: SectionModel['pressure'] = null;
  const y0 = 2 * u;
  const H = Math.max(4 * u, 0.15 * span);
  let belowY = y0;
  if (pressure.stable && pressure.qmax > 0) {
    const qAt = (s: number) => (dir === 'x' ? pressureAt(pressure, s, loc.yc) : pressureAt(pressure, loc.xc, s));
    const slope = dir === 'x' ? pressure.gx : pressure.gy;
    const base = dir === 'x' ? pressure.q0 + pressure.gy * loc.yc : pressure.q0 + pressure.gx * loc.xc;
    const ss = [-span / 2, span / 2];
    if (Math.abs(slope) > 1e-12) {
      const s0 = -base / slope;
      if (s0 > -span / 2 && s0 < span / 2) ss.splice(1, 0, s0);
    }
    const h = (s: number) => y0 + (qAt(s) / pressure.qmax) * H;
    const outline = [`${-span / 2},${y0}`, ...ss.map((s) => `${s},${h(s)}`), `${span / 2},${y0}`].join(' ');
    const n = Math.max(6, Math.min(24, Math.round(span / (2 * u))));
    let hatch = '';
    for (let i = 1; i < n; i++) {
      const s = -span / 2 + (i * span) / n;
      if (qAt(s) > 1e-9) hatch += `M${s},${y0} V${h(s)} `;
    }
    const qL = fmt(qAt(-span / 2) * 10, 2);
    const qR = fmt(qAt(span / 2) * 10, 2);
    const ty = y0 + H + 0.6 * u + ASCENT * sizes.small;
    const texts: NoteText[] = [];
    if (qL === qR) {
      texts.push({ x: 0, y: ty, text: `q = ${qL} t/m²`, anchor: 'middle' });
    } else {
      const left: NoteText = { x: -span / 2, y: ty, text: qL, anchor: 'start' };
      const right: NoteText = { x: span / 2, y: ty, text: `${qR} t/m²`, anchor: 'end' };
      if (overlaps(textRect(left.x, left.y, left.text, sizes.small, 'start'), textRect(right.x, right.y, right.text, sizes.small, 'end'), u)) {
        right.y += sizes.small * 1.25;
      }
      texts.push(left, right);
    }
    for (const tx of texts) ext.add(textRect(tx.x, tx.y, tx.text, sizes.small, tx.anchor));
    belowY = Math.max(...texts.map((tx) => tx.y + DESCENT * sizes.small));
    pressureModel = { outline, hatch, texts };
    ext.add({ x1: -span / 2, y1: 0, x2: span / 2, y2: y0 + H });
  }

  // ---- ความกว้างฐานราก
  const rowSpan = belowY + 3.2 * u;
  const spanDim = dimLine([{ a: -span / 2, b: span / 2, text: meters(span) }], rowSpan, false, sizes.dim, u, occupied);
  dims.push(spanDim);
  extParts.push(`M${-span / 2},${0.8 * u} V${rowSpan + 1.2 * u}`, `M${span / 2},${0.8 * u} V${rowSpan + 1.2 * u}`);
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  const titleY = Math.max(ext.y2, rowSpan + 1.2 * u) + 2.6 * u + ASCENT * TEXT_MM.sectionTitle * u;
  const tb = titleBlock(title, `รูปตัดฐานราก   SCALE 1:${denom}`, titleY, TEXT_MM.sectionTitle * u, TEXT_MM.sectionSub * u, 3.6 * u);
  addTitleExtent(ext, tb, u);

  const view = ext.box(1.2 * u);
  return {
    denom, u, sizes, dir, span, t,
    column: { x: cx1, y: -zTop, w: cw, h: zTop - t },
    groundZ, groundPath, groundHatch, groundLabel, breakZ, pedestalPath, breakPath,
    alongPath, alongWidth: Math.max(db, 0.35 * u), dots, leaders, pressure: pressureModel,
    dims, extensions: extParts.join(' '), titleBlock: tb, view, sizeMm: sizeMm(view, denom),
  };
}

export const POSITION_TH: Record<FootingInput['position'], string> = {
  center: 'เสาศูนย์กลาง',
  offset: 'เสาเยื้องศูนย์',
  edge: 'ตีนเป็ดชิดขอบ',
  corner: 'ตีนเป็ดชิดมุม',
};

export const sectionTitle = (dir: BarDir) => (dir === 'x' ? 'SECTION X-X' : 'SECTION Y-Y');
export const planTitle = (input: FootingInput) => `PLAN ${input.footingName || 'F1'}`;

const fits = (size: { w: number; h: number }, box: { w: number; h: number }) => size.w <= box.w && size.h <= box.h;

/** มาตราส่วนมาตรฐานที่ใหญ่ที่สุดที่แปลนพอดีกรอบ (มม.) */
export function pickPlanScale(input: FootingInput, a: FootingAnalysis, box = PLAN_BOX): number {
  return FOOTING_SCALES.find((d) => fits(buildPlanModel(input, a, d, planTitle(input)).sizeMm, box)) ?? FOOTING_SCALES[FOOTING_SCALES.length - 1];
}

/** มาตราส่วนเดียวกันทั้งรูปตัด X-X และ Y-Y */
export function pickSectionScale(input: FootingInput, a: FootingAnalysis, box = SECTION_BOX): number {
  return (
    FOOTING_SCALES.find((d) => (['x', 'y'] as const).every((dir) => fits(buildSectionModel(input, a, dir, d, sectionTitle(dir)).sizeMm, box))) ??
    FOOTING_SCALES[FOOTING_SCALES.length - 1]
  );
}
