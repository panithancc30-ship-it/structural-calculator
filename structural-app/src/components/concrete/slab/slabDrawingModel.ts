import type { SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab';
import { FACES, runPositions } from '@/engine/concrete/slab/geometry';
import type { BarRun, EdgeSupport, SlabInput, SlabLayout, SlabType } from '@/engine/concrete/slab/types';
import type { BarDir } from '@/engine/concrete/footing/types';
import { ACI318_WSD_SLAB as K } from '@/engine/concrete/codes/aci318Wsd';
import { cmToM, fmt } from '@/engine/concrete/format';
import { REBARS } from '@/engine/concrete/rebar';
import type { Face } from '@/engine/concrete/types';
import { textWidth } from '../drawing/drawingModel';
import {
  addDimExtent,
  addTitleExtent,
  dimLine,
  Extent,
  sizeMm,
  TEXT_MM,
  textRect,
  titleBlock,
  type Box,
  type DimLine,
  type DimSeg,
  type Leader,
  type NoteText,
  type Rect,
  type TextSizes,
  type TitleBlock,
} from '../footing/footingDrawingModel';

/** กรอบรูปบนหน้าจอ (มม.) — กว้างกว่ากรอบของหน้ารายงาน เพราะมีที่ให้วาดมากกว่า */
export const PLAN_BOX = { w: 110, h: 120 };
export const SECTION_BOX = { w: 118, h: 40 };

/** สิ่งที่คลิกได้ในรูปพื้น — เลือกได้ทั้งผิวและทิศ */
export interface SlabPick {
  kind: 'bars';
  face: Face;
  dir: BarDir;
}

export const pickKey = (face: Face, dir: BarDir) => `${face}-${dir}`;

export const SLAB_TYPE_TH: Record<SlabType, string> = {
  oneWay: 'พื้นทางเดียว',
  twoWay: 'พื้นสองทาง',
  cantilever: 'พื้นยื่น',
  onGround: 'พื้นวางบนดิน',
};

const FACE_TH: Record<Face, string> = { bottom: 'ล่าง', top: 'บน' };

export const EDGE_TH: Record<EdgeSupport, string> = {
  simple: 'ยึดหมุน',
  continuous: 'ต่อเนื่อง',
  free: 'อิสระ',
};

/** ข้อความกำกับเหล็กหนึ่งชุด เช่น "DB12 @0.20" */
export const runText = (run: BarRun) => `${run.size} @${cmToM(run.spacing)}`;

export const planTitle = (input: SlabInput) => `PLAN ${input.slabName || 'S1'}`;
export const sectionTitle = (dir: BarDir) => (dir === 'x' ? 'SECTION X-X' : 'SECTION Y-Y');

/** ทิศที่ต้องเขียนรูปตัด — พื้นยื่นรับน้ำหนักทิศเดียว อีกทิศมีแต่เหล็กกระจาย จึงไม่ต้องเขียน */
export const sectionDirs = (input: SlabInput): BarDir[] =>
  input.slabType === 'cantilever' ? ['x'] : ['x', 'y'];

const meters = (cm: number) => fmt(cm / 100, 2);

/** ขอบสองด้านที่ตั้งฉากกับทิศนั้น (ปลายช่วงที่เหล็กทิศนั้นพาดถึง) */
export function endEdges(input: SlabInput, dir: BarDir): [EdgeSupport, EdgeSupport] {
  return dir === 'x' ? [input.edgeX1, input.edgeX2] : [input.edgeY1, input.edgeY2];
}

export interface SlabPlanModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  lx: number;
  ly: number;
  /** ขอบพื้นทั้งสี่ พร้อมสภาพรองรับ */
  edges: { key: string; support: EdgeSupport; x1: number; y1: number; x2: number; y2: number }[];
  /** เส้นเหล็กแต่ละชุด — ผิวบนวาดเป็นเส้นประ */
  runs: {
    key: string;
    face: Face;
    dir: BarDir;
    dashed: boolean;
    lines: { x1: number; y1: number; x2: number; y2: number }[];
  }[];
  leaders: Leader[];
  dims: DimLine[];
  extensions: string;
  notes: NoteText[];
  titleBlock: TitleBlock;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildPlanModel(
  input: SlabInput,
  a: SlabAnalysis,
  layout: SlabLayout,
  denom: number,
  title: string,
): SlabPlanModel {
  const u = denom / 10;
  const sizes: TextSizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const { lx, ly } = a.dims;
  const hx = lx / 2;
  const hy = ly / 2;
  const ext = new Extent();
  ext.add({ x1: -hx, y1: -hy, x2: hx, y2: hy });

  const edges: SlabPlanModel['edges'] = [
    { key: 'x1', support: input.edgeX1, x1: -hx, y1: -hy, x2: -hx, y2: hy },
    { key: 'x2', support: input.edgeX2, x1: hx, y1: -hy, x2: hx, y2: hy },
    { key: 'y1', support: input.edgeY1, x1: -hx, y1: hy, x2: hx, y2: hy },
    { key: 'y2', support: input.edgeY2, x1: -hx, y1: -hy, x2: hx, y2: -hy },
  ];

  // เส้นเหล็ก: ทิศ x พาดตามแกน x จึงกระจายไปตามแกน y
  const runs: SlabPlanModel['runs'] = [];
  const inset = input.cover + 2;
  for (const face of ['bottom', 'top'] as Face[]) {
    for (const dir of ['x', 'y'] as BarDir[]) {
      const run = layout[face][dir];
      if (!run) continue;
      const db = REBARS[run.size].dia;
      const across = dir === 'x' ? ly : lx;
      const positions = runPositions(across, input.cover, db, run.spacing);
      const along = dir === 'x' ? lx : ly;
      const half = along / 2;
      const [e1, e2] = endEdges(input, dir);
      const reach = K.topBarExtension * along;
      const hasFree = e1 === 'free' || e2 === 'free';
      // เหล็กผิวบนต้านโมเมนต์ลบที่ขอบต่อเนื่อง จึงวาดเฉพาะช่วงใกล้ขอบตามที่ตัดเหล็กจริง
      // ยกเว้นพื้นยื่น (เหล็กบนคือเหล็กหลัก) และพื้นวางบนดิน (ตะแกรงเต็มแผ่น)
      const cutTop = face === 'top' && input.slabType !== 'onGround' && !hasFree;
      let segments: ReadonlyArray<readonly [number, number]> = [[-half, half]];
      if (cutTop) {
        const segs: Array<readonly [number, number]> = [];
        if (e1 === 'continuous') segs.push([-half, -half + reach]);
        if (e2 === 'continuous') segs.push([half - reach, half]);
        segments = segs.length > 0 ? segs : [[-half + inset, half - inset]];
      }

      const lines = positions.flatMap((p) =>
        segments.map(([s, e]) =>
          dir === 'x' ? { x1: s, y1: p, x2: e, y2: p } : { x1: p, y1: s, x2: p, y2: e },
        ),
      );
      runs.push({ key: pickKey(face, dir), face, dir, dashed: face === 'top', lines });
    }
  }

  // ป้ายกำกับเหล็ก วางกระจายรอบแผ่นเพื่อไม่ให้ทับกัน
  const occupied: Rect[] = [];
  const leaders: Leader[] = [];
  const slots: Array<{ face: Face; dir: BarDir; sx: number; sy: number; tx: number; ty: number; anchor: 'start' | 'end' }> = [
    { face: 'top', dir: 'y', sx: -hx * 0.25, sy: -hy * 0.45, tx: -hx - 3 * u, ty: -hy * 0.35, anchor: 'end' },
    { face: 'bottom', dir: 'x', sx: -hx * 0.55, sy: hy * 0.35, tx: -hx - 3 * u, ty: hy * 0.35, anchor: 'end' },
    { face: 'top', dir: 'x', sx: hx * 0.55, sy: -hy * 0.35, tx: hx + 3 * u, ty: -hy * 0.35, anchor: 'start' },
    { face: 'bottom', dir: 'y', sx: hx * 0.25, sy: hy * 0.45, tx: hx + 3 * u, ty: hy * 0.35, anchor: 'start' },
  ];

  for (const slot of slots) {
    const run = layout[slot.face][slot.dir];
    if (!run) continue;
    const text = runText(run);
    const sub = `ผิว${FACE_TH[slot.face]} ทิศ ${slot.dir.toUpperCase()}`;
    leaders.push({
      key: pickKey(slot.face, slot.dir),
      dir: slot.dir,
      points: `${slot.sx},${slot.sy} ${slot.tx},${slot.ty}`,
      text,
      tx: slot.tx,
      ty: slot.ty,
      anchor: slot.anchor,
      sub: { text: sub, x: slot.tx, y: slot.ty + sizes.small * 1.25 },
    });
    ext.add(textRect(slot.tx, slot.ty, text, sizes.label, slot.anchor));
    ext.add(textRect(slot.tx, slot.ty + sizes.small * 1.25, sub, sizes.small, slot.anchor));
  }

  // เส้นบอกขนาดช่วงพื้น
  const dims: DimLine[] = [];
  const xSegs: DimSeg[] = [{ a: -hx, b: hx, text: meters(lx) }];
  const ySegs: DimSeg[] = [{ a: -hy, b: hy, text: meters(ly) }];
  dims.push(dimLine(xSegs, hy + 4 * u, false, sizes.dim, u, occupied));
  dims.push(dimLine(ySegs, -hx - 4 * u, true, sizes.dim, u, occupied));
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  const extensions = [
    `M${-hx},${hy} V${hy + 4 * u}`,
    `M${hx},${hy} V${hy + 4 * u}`,
    `M${-hx},${-hy} H${-hx - 4 * u}`,
    `M${-hx},${hy} H${-hx - 4 * u}`,
  ].join(' ');

  const notes: NoteText[] = [];

  const tb = titleBlock(title, `แปลนพื้น   SCALE 1:${denom}`, ext.y2 + 5 * u, TEXT_MM.title * u, TEXT_MM.sub * u, 4 * u);
  addTitleExtent(ext, tb, u);

  const view = ext.box(2 * u);
  return {
    denom, u, sizes, lx, ly, edges, runs, leaders, dims, extensions, notes,
    titleBlock: tb, view, sizeMm: sizeMm(view, denom),
  };
}

/** ความกว้างคานรองรับที่ใช้วาดรูปตัด (ซม.) — ค่าสมมติสำหรับเขียนแบบ ไม่ได้ใช้ในการคำนวณ */
const BEAM_WIDTH = 20;
/** ความลึกคานใต้ท้องพื้นที่ใช้วาด (ซม.) — อยู่ในช่วงคานจริงทั่วไป ไม่โตตามความหนาพื้นไปเรื่อย ๆ */
const beamDepth = (t: number) => Math.min(60, Math.max(30, 2.5 * t));
/** ความยาวขอที่งอลงไปในคาน = 12db (ACI 7.1.2) */
const HOOK_DB = 12;

export interface SlabSectionModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  dir: BarDir;
  span: number;
  t: number;
  /** คานรองรับใต้ปลายช่วง — ขอบอิสระของพื้นยื่นและพื้นวางบนดินไม่มีคาน */
  beams: { x: number; w: number; h: number; support: EdgeSupport }[];
  /** ขอบเขตแผ่นพื้นที่วาด — เลยไปถึงผิวนอกของคานที่รองรับ */
  slab: { x1: number; x2: number };
  /** เหล็กที่ขนานกับระนาบตัด — หนึ่งเส้นทางต่อผิว รวมส่วนที่งอลงไปในคาน */
  runs: { key: string; face: Face; path: string; width: number }[];
  /** เหล็กที่ตั้งฉากกับระนาบตัด วาดเป็นจุด */
  dots: { key: string; face: Face; x: number; y: number; r: number }[];
  /** ดินใต้พื้น (เฉพาะพื้นวางบนดิน) */
  ground: { path: string; hatch: string } | null;
  leaders: Leader[];
  dims: DimLine[];
  notes: NoteText[];
  extensions: string;
  titleBlock: TitleBlock;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildSectionModel(
  input: SlabInput,
  a: SlabAnalysis,
  layout: SlabLayout,
  dir: BarDir,
  denom: number,
  title: string,
): SlabSectionModel {
  const u = denom / 10;
  const sizes: TextSizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const { t } = a.dims;
  const span = dir === 'x' ? a.dims.lx : a.dims.ly;
  const half = span / 2;
  const ext = new Extent();
  // แกน y ชี้ลง: ผิวบนพื้นอยู่ที่ y = 0 ท้องพื้นอยู่ที่ y = t
  const [e1, e2] = endEdges(input, dir);
  const onGround = input.slabType === 'onGround';
  const bw = BEAM_WIDTH;
  const bh = beamDepth(t);

  const beams: SlabSectionModel['beams'] = [];
  if (!onGround) {
    if (e1 !== 'free') beams.push({ x: -half, w: bw, h: bh, support: e1 });
    if (e2 !== 'free') beams.push({ x: half, w: bw, h: bh, support: e2 });
  }
  const beamAt = (side: -1 | 1) => beams.find((b) => (side < 0 ? b.x < 0 : b.x > 0));

  // แผ่นพื้นวาดเลยไปวางบนคาน จึงยาวกว่าช่วงที่ใช้คำนวณ
  const slab = {
    x1: beamAt(-1) ? -half - bw / 2 : -half,
    x2: beamAt(1) ? half + bw / 2 : half,
  };
  ext.add({ x1: slab.x1, y1: 0, x2: slab.x2, y2: t });
  for (const b of beams) ext.add({ x1: b.x - b.w / 2, y1: t, x2: b.x + b.w / 2, y2: t + b.h });

  const other: BarDir = dir === 'x' ? 'y' : 'x';
  const runs: SlabSectionModel['runs'] = [];
  const dots: SlabSectionModel['dots'] = [];

  for (const face of FACES) {
    // เหล็กทิศเดียวกับระนาบตัด — เห็นเป็นเส้นยาวพร้อมขอที่ปลาย
    const along = layout[face][dir];
    if (along) {
      const db = REBARS[along.size].dia;
      const z = a.geom.z[face][dir];
      const y = face === 'top' ? z : t - z;

      /**
       * ปลายเหล็กแต่ละข้าง
       * มีคานรองรับ → ยื่นเข้าไปเกือบถึงผิวนอกคาน แล้วงอลงไปฝังในคาน
       * ไม่มีคาน (ขอบอิสระ / พื้นวางบนดิน) → ร่นเข้ามาเท่าระยะหุ้ม แล้วงอกลับเข้าเนื้อพื้น
       */
      const endOf = (side: -1 | 1) => {
        const beam = beamAt(side);
        if (beam) {
          const embed = Math.min(HOOK_DB * db, beam.h - 2 * input.cover);
          return { x: beam.x + side * (beam.w / 2 - input.cover), hookTo: t + embed };
        }
        return {
          x: side * (half - input.cover),
          hookTo: face === 'top' ? t - input.cover - db / 2 : input.cover + db / 2,
        };
      };

      // เหล็กบนต้านโมเมนต์ลบที่ขอบ จึงตัดให้ยื่นจากที่รองรับเข้ามาเท่าที่ใช้ เหมือนที่วาดในแปลน
      // พื้นยื่นกับพื้นวางบนดินไม่ตัด เพราะเหล็กบนคือเหล็กหลักหรือเป็นตะแกรงเต็มแผ่น
      const hasFree = e1 === 'free' || e2 === 'free';
      const cutTop = face === 'top' && !onGround && !hasFree;
      const reach = K.topBarExtension * span;
      const left = endOf(-1);
      const right = endOf(1);
      const addRun = (path: string, x1: number, x2: number, ys: number[]) => {
        runs.push({ key: pickKey(face, dir), face, path, width: db });
        ext.add({ x1, y1: Math.min(y, ...ys), x2, y2: Math.max(y, ...ys) });
      };

      if (cutTop) {
        // หนึ่งเส้นต่อหนึ่งขอบที่ต่อเนื่อง — ปลายด้านในตัดลอย ปลายด้านนอกงอลงในคาน
        if (e1 === 'continuous') {
          addRun(`M${left.x},${left.hookTo} V${y} H${-half + reach}`, left.x, -half + reach, [left.hookTo]);
        }
        if (e2 === 'continuous') {
          addRun(`M${half - reach},${y} H${right.x} V${right.hookTo}`, half - reach, right.x, [right.hookTo]);
        }
      } else {
        addRun(
          `M${left.x},${left.hookTo} V${y} H${right.x} V${right.hookTo}`,
          left.x,
          right.x,
          [left.hookTo, right.hookTo],
        );
      }
    }

    // เหล็กทิศตั้งฉาก — เห็นเป็นจุด
    const across = layout[face][other];
    if (across) {
      const db = REBARS[across.size].dia;
      const z = a.geom.z[face][other];
      const y = face === 'top' ? z : t - z;
      for (const p of runPositions(span, input.cover, db, across.spacing)) {
        dots.push({ key: pickKey(face, other), face, x: p, y, r: db / 2 });
      }
    }
  }

  let ground: SlabSectionModel['ground'] = null;
  if (onGround) {
    const depth = Math.max(4, t * 0.5);
    ground = {
      path: `M${slab.x1 - 3 * u},${t} H${slab.x2 + 3 * u}`,
      hatch: Array.from({ length: 16 }, (_, i) => {
        const x = slab.x1 - 3 * u + (i * (slab.x2 - slab.x1 + 6 * u)) / 15;
        return `M${x},${t} l${-depth},${depth}`;
      }).join(' '),
    };
    ext.add({ x1: slab.x1 - 3 * u, y1: t, x2: slab.x2 + 3 * u, y2: t + depth });
  }

  // ป้ายกำกับเหล็ก ชี้จากกลางเส้นออกไปด้านบน/ล่าง เหมือนแบบก่อสร้าง
  const leaders: Leader[] = [];
  for (const face of FACES) {
    const run = layout[face][dir];
    if (!run) continue;
    const z = a.geom.z[face][dir];
    const y = face === 'top' ? z : t - z;
    // ป้ายของผิวบนอยู่เหนือแผ่น ส่วนผิวล่างวางในช่องว่างระหว่างคานสองต้น
    // ใช้พื้นที่ที่ว่างอยู่แล้ว รูปตัดจึงไม่สูงขึ้นและยังใช้มาตราส่วนใหญ่ได้
    const voidY = beams.length > 0 ? t + bh * 0.62 : t + (onGround ? Math.max(4, t * 0.5) + 5 * u : 6 * u);
    const sx = face === 'top' ? -half * 0.2 : half * 0.2;
    const ty = face === 'top' ? -5 * u : voidY;
    const tx = sx + (face === 'top' ? -5 * u : 5 * u);
    const anchor: 'start' | 'end' = face === 'top' ? 'end' : 'start';
    const text = runText(run);
    const sub = `ผิว${FACE_TH[face]}`;
    leaders.push({
      key: pickKey(face, dir),
      dir,
      points: `${sx},${y} ${tx},${ty}`,
      text,
      tx,
      ty,
      anchor,
      sub: { text: sub, x: tx, y: ty + sizes.small * 1.25 },
    });
    ext.add(textRect(tx, ty, text, sizes.label, anchor));
    ext.add(textRect(tx, ty + sizes.small * 1.25, sub, sizes.small, anchor));
  }

  // เส้นบอกขนาด: ความหนาอยู่ซ้ายมือ ช่วงพื้นอยู่ล่างสุด
  const occupied: Rect[] = [];
  const dims: DimLine[] = [];
  dims.push(dimLine([{ a: 0, b: t, text: meters(t) }], slab.x1 - 4 * u, true, sizes.dim, u, occupied));
  dims.push(dimLine([{ a: -half, b: half, text: meters(span) }], ext.y2 + 4 * u, false, sizes.dim, u, occupied));
  for (const d of dims) addDimExtent(ext, d, sizes.dim, u);

  // บอกว่าเป็นด้านสั้นหรือด้านยาวของแผ่น เหมือนแบบพื้นสองทางทั่วไป
  const notes: NoteText[] = [];
  if (input.slabType === 'twoWay') {
    const text = span <= Math.min(a.dims.lx, a.dims.ly) ? '(ด้านสั้น)' : '(ด้านยาว)';
    notes.push({ x: 0, y: ext.y2 + 3 * u, text, anchor: 'middle' });
    ext.add(textRect(0, ext.y2 + 3 * u, text, sizes.small, 'middle'));
  }

  const tb = titleBlock(
    title,
    `รูปตัดพื้น   SCALE 1:${denom}`,
    ext.y2 + 5 * u,
    TEXT_MM.sectionTitle * u,
    TEXT_MM.sectionSub * u,
    3.6 * u,
  );
  addTitleExtent(ext, tb, u);

  const view = ext.box(2 * u);
  return {
    denom, u, sizes, dir, span, t, beams, slab, runs, dots, ground, leaders, dims, notes,
    extensions: `M${-half},${t + bh} V${t + bh + 3 * u} M${half},${t + bh} V${t + bh + 3 * u}`,
    titleBlock: tb, view, sizeMm: sizeMm(view, denom),
  };
}

/** มาตราส่วนที่ใช้กับแบบพื้น — เลือกเฉพาะค่าที่ช่างอ่านคุ้น ไม่มี 1:150 หรือ 1:300 */
export const SLAB_SCALES = [20, 25, 50, 75, 100, 200] as const;

const fits = (s: { w: number; h: number }, box: { w: number; h: number }) => s.w <= box.w && s.h <= box.h;

/**
 * แปลนกับรูปตัดใช้คนละมาตราส่วน และเขียนกำกับไว้ใต้รูปแต่ละรูป
 *
 * ต่างจากฐานรากที่บังคับให้ใช้มาตราส่วนเดียวกันทั้งแผ่น เพราะรูปตัดพื้นเป็นแถบยาวและบางมาก
 * ถ้าบังคับให้เท่าแปลน ความหนาพื้นจะเหลือเป็นเส้นเดียวจนอ่านเหล็กไม่ออก
 */
export function pickPlanScale(input: SlabInput, a: SlabAnalysis, layout: SlabLayout, box = PLAN_BOX): number {
  return (
    SLAB_SCALES.find((d) => fits(buildPlanModel(input, a, layout, d, planTitle(input)).sizeMm, box)) ??
    SLAB_SCALES[SLAB_SCALES.length - 1]
  );
}

export function pickSectionScale(input: SlabInput, a: SlabAnalysis, layout: SlabLayout, box = SECTION_BOX): number {
  return (
    SLAB_SCALES.find((d) =>
      sectionDirs(input).every((dir) =>
        fits(buildSectionModel(input, a, layout, dir, d, sectionTitle(dir)).sizeMm, box),
      ),
    ) ?? SLAB_SCALES[SLAB_SCALES.length - 1]
  );
}

/** ข้อความสรุปเหล็กของทิศหนึ่ง ใช้ในการ์ดสรุปผล */
export function dirSummary(layout: SlabLayout, dir: BarDir): string {
  const parts = (['bottom', 'top'] as Face[])
    .map((face) => {
      const run = layout[face][dir];
      return run ? `${FACE_TH[face]} ${runText(run)}` : null;
    })
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export { textWidth };
