/**
 * แบบขยายพื้น GS — พื้นวางบนดินใช้แบบนี้แบบเดียว แทนแปลนและรูปตัด X-X / Y-Y ของพื้นชนิดอื่น
 *
 * สองรูปคู่กันตามแบบมาตรฐาน ตัดตามด้านสั้นของแผ่น:
 * - ด้านสั้นภายนอก: ขอบพื้นหนาลงอีก 0.10 ม. ทั้งสองข้าง ตะแกรงงอลงไปในขอบ
 * - ด้านสั้นภายใน: พื้นอยู่ระหว่างคาน แยกจากคานด้วยร่องยาแนว 2 ซม. และห้ามฝังเหล็กเข้าคาน
 *
 * ความหนาและเหล็กตะแกรงมาจากผลออกแบบ ส่วนความยาวแผ่นที่วาด ขนาดคาน และขอบหนาเป็นค่าเขียนแบบ
 * (รูปขยายไม่ได้วาดเต็มช่วงพื้น) — หน่วย ซม. ตามจริง พิกัด SVG y ชี้ลง ผิวบนพื้นอยู่ที่ y = 0
 */
import type { SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab';
import { runPositions } from '@/engine/concrete/slab/geometry';
import type { BarRun, SlabInput, SlabLayout } from '@/engine/concrete/slab/types';
import type { BarDir } from '@/engine/concrete/footing/types';
import { cmToM, fmt } from '@/engine/concrete/format';
import { REBARS } from '@/engine/concrete/rebar';
import { textWidth } from '../drawing/drawingModel';
import { Extent, sizeMm, TEXT_MM, textRect, type Box, type NoteText, type TextSizes } from '../footing/footingDrawingModel';
import { arrowHead } from '../pilecap/pileCapDrawingModel';

export type GroundDetailKind = 'outer' | 'inner';
export const GROUND_DETAILS: GroundDetailKind[] = ['outer', 'inner'];

/** คำกำกับต่อท้ายชื่อรูป ตามแบบมาตรฐาน */
export const GROUND_DETAIL_SUFFIX: Record<GroundDetailKind, string> = {
  outer: '(ด้านสั้นภายนอก)',
  inner: '(ด้านสั้นภายใน)',
};

export const GROOVE_NOTE = 'เซาะร่องกว้าง 2 CM. (ยาแนวด้วยวัสดุกันซึมและยืดหยุ่น)';
export const NO_EMBED_NOTE = '(ห้ามฝังเหล็กเข้าคานโดยเด็ดขาด)';
export const SAND_NOTE = 'ทรายอัดแน่น หนา 5-10 cm.';

/** ค่าเขียนแบบ (ซม.) — ไม่ได้ใช้ในการคำนวณ */
const DRAW = {
  /** ขอบพื้นด้านสั้นภายนอกหนาลงใต้ท้องพื้น (0.10 ตามแบบ) */
  edgeDrop: 10,
  /** ความกว้างท้องขอบหนา ต่อจากนั้นลาด 45° ขึ้นไปท้องพื้น */
  edgeFlat: 10,
  /** ระยะหุ้มเหล็กที่งอลงในขอบหนา */
  edgeCover: 5,
  /** ความยาวแผ่นที่วาด — ด้านสั้นภายนอกวัดขอบถึงขอบ ด้านสั้นภายในวัดผิวคานถึงผิวคาน */
  outerLength: 120,
  innerLength: 140,
  beamWidth: 20,
  /** ร่องยาแนวกว้าง 2 ซม. ตามแบบ (ลึกเท่ากันเพื่อให้เห็นในรูป) */
  groove: 2,
  /** ระยะปลายเหล็กถึงผิวคาน — ตะแกรงหยุดในพื้น ไม่ฝังเข้าคาน */
  innerEndGap: 3,
  /** ทรายอัดแน่น 5–10 ซม. วาดที่ค่ากลาง และแถบดินเดิมใต้ทราย */
  sand: 7.5,
  groundBand: 4,
};

/** ความลึกคานที่วาด — อยู่ในช่วงคานคอดินทั่วไป */
const beamDepth = (t: number) => Math.max(30, 2.5 * t);

/** "RB6" → "RB 6" ตามที่เขียนในแบบ */
const barName = (run: BarRun) => run.size.replace(/^([A-Z]+)(\d+)$/, '$1 $2');
const runText = (run: BarRun) => `${barName(run)} @ ${cmToM(run.spacing)}m.`;

const sameRun = (a: BarRun | null, b: BarRun | null) => !!a && !!b && a.size === b.size && a.spacing === b.spacing;

/** ป้ายเหล็กตะแกรง เช่น "RB 6 @ 0.25m.#" — สองทิศไม่เท่ากัน (แก้เองทีละทิศจากไฟล์เก่า) แยกเขียนทีละทิศ */
export function meshText(layout: SlabLayout): string {
  const { x, y } = layout.bottom;
  if (sameRun(x, y)) return `${runText(x!)}#`;
  return [x && `${runText(x)} (X)`, y && `${runText(y)} (Y)`].filter(Boolean).join(', ') || '—';
}

/** ข้อความสั้นในการ์ดสรุปและรูปเล่ม เช่น "RB6 @0.25 #" */
export function meshSummary(layout: SlabLayout): string {
  const { x, y } = layout.bottom;
  const short = (r: BarRun) => `${r.size} @${cmToM(r.spacing)}`;
  if (sameRun(x, y)) return `${short(x!)} #`;
  return [x && `X ${short(x)}`, y && `Y ${short(y)}`].filter(Boolean).join(' · ') || '—';
}

export const groundTitle = (input: SlabInput) => `แบบขยายพื้น ${input.slabName || 'GS'}`;

export interface GroundCallout {
  key: 'mesh' | 'groove' | 'sand';
  /** เส้นชี้ — หนึ่งเส้นต่อหนึ่งหัวลูกศร */
  lines: string[];
  arrows: string;
  text: NoteText;
}

export interface GroundTitle {
  title: NoteText;
  titleSize: number;
  underline: string;
  scaleLabel: NoteText;
  scaleValue: NoteText;
  suffix: NoteText;
}

export interface GroundDetailModel {
  kind: GroundDetailKind;
  denom: number;
  u: number;
  sizes: TextSizes;
  t: number;
  /** หน้าตัดคอนกรีตพื้น (เส้นปิด) */
  slabPath: string;
  beams: Box[];
  grooves: Box[];
  /** ทรายอัดแน่น (เส้นปิด) และแถบดินเดิมใต้ทราย */
  sandPath: string;
  groundBand: Box;
  /** ทิศของเหล็กที่เห็นเป็นเส้นในรูป — อีกทิศเห็นเป็นจุด */
  lineDir: BarDir;
  bar: { path: string; width: number } | null;
  dots: { x: number; y: number; r: number }[];
  callouts: GroundCallout[];
  /** เส้นบอกความหนาด้านซ้าย ตัวเลขเขียนแนวนอนตามแบบ */
  dim: { path: string; ticks: string; labels: NoteText[] };
  title: GroundTitle;
  view: Box;
  sizeMm: { w: number; h: number };
}

export function buildGroundDetail(
  input: SlabInput,
  a: SlabAnalysis,
  layout: SlabLayout,
  kind: GroundDetailKind,
  denom: number,
): GroundDetailModel {
  const u = denom / 10;
  const sizes: TextSizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const { t } = a.dims;
  const outer = kind === 'outer';
  const half = (outer ? DRAW.outerLength : DRAW.innerLength) / 2;
  const drop = DRAW.edgeDrop;
  const bw = DRAW.beamWidth;
  const bh = beamDepth(t);
  const ext = new Extent();

  // ---- คอนกรีต: ด้านสั้นภายนอกมีขอบหนาลงทั้งสองข้าง, ด้านสั้นภายในเป็นแผ่นเรียบระหว่างคาน
  const flatX = half - DRAW.edgeFlat;
  const slopeX = flatX - drop;
  const slabPath = outer
    ? `M${-half},0 H${half} V${t + drop} H${flatX} L${slopeX},${t} H${-slopeX} L${-flatX},${t + drop} H${-half} Z`
    : `M${-half},0 H${half} V${t} H${-half} Z`;
  const slabBottom = outer ? t + drop : t;
  ext.add({ x1: -half, y1: 0, x2: half, y2: slabBottom });

  const beams: Box[] = outer ? [] : [-1, 1].map((side) => ({ x: side < 0 ? -half - bw : half, y: 0, w: bw, h: bh }));
  for (const b of beams) ext.add({ x1: b.x, y1: b.y, x2: b.x + b.w, y2: b.y + b.h });
  const grooves: Box[] = outer
    ? []
    : [-1, 1].map((side) => ({ x: side < 0 ? -half : half - DRAW.groove, y: 0, w: DRAW.groove, h: DRAW.groove }));

  // ---- ทรายอัดแน่นใต้พื้น (ด้านสั้นภายนอกอยู่ระหว่างขอบหนา) และดินเดิม
  const sandBottom = outer ? t + drop : t + DRAW.sand;
  const sandPath = outer
    ? `M${-slopeX},${t} H${slopeX} L${flatX},${t + drop} H${-flatX} Z`
    : `M${-half},${t} H${half} V${sandBottom} H${-half} Z`;
  const bandX = outer ? half + 4 * u : half;
  const groundBand: Box = { x: -bandX, y: sandBottom, w: 2 * bandX, h: DRAW.groundBand };
  ext.add({ x1: -bandX, y1: sandBottom, x2: bandX, y2: sandBottom + DRAW.groundBand });

  // ---- เหล็กตะแกรง: ชั้นใน (อยู่บน) เห็นเป็นเส้น ชั้นนอก (ชิดทราย) เห็นเป็นจุดใต้เส้น ตามแบบ
  // ทิศยาวต้องการ As มากกว่าจึงอยู่ชั้นนอก (groundMeshLayout) — เส้นในรูปจึงเป็นเหล็กทิศสั้นตามชื่อรูป
  const outerDir = layout.outerLayer.bottom;
  const innerDir: BarDir = outerDir === 'x' ? 'y' : 'x';
  const lineDir: BarDir = layout.bottom[innerDir] ? innerDir : outerDir;
  const dotDir: BarDir | null = lineDir === innerDir && layout.bottom[outerDir] ? outerDir : null;
  const lineRun = layout.bottom[lineDir];
  let bar: GroundDetailModel['bar'] = null;
  let lineY = t / 2;
  let barEnd = half;
  /** ความหนาเส้นเหล็กที่วาด — เหล็กเส้นเล็กยังต้องเห็นชัดที่มาตราส่วนนี้ */
  const barStroke = (db: number) => Math.max(db, 0.3 * u);
  if (lineRun) {
    const db = REBARS[lineRun.size].dia;
    lineY = t - a.geom.z.bottom[lineDir];
    if (outer) {
      // งอลงไปในขอบหนาแล้วงอเข้าหาตัวพื้น
      const legX = half - DRAW.edgeCover;
      const legY = t + drop - DRAW.edgeCover;
      const hook = Math.min(Math.max(6 * db, 4), DRAW.edgeFlat - DRAW.edgeCover + drop / 2);
      barEnd = legX;
      bar = { path: `M${-legX + hook},${legY} H${-legX} V${lineY} H${legX} V${legY} H${legX - hook}`, width: barStroke(db) };
    } else {
      // ขอ 180° อยู่ในเนื้อพื้น — งอไปทางที่เนื้อคอนกรีตเหลือมากกว่า
      const D = Math.min(Math.max(6 * db, 3), Math.max(t - 2, 1) / 2);
      const down = lineY + D <= t - 1;
      const dy = down ? D : -D;
      const xe = half - DRAW.innerEndGap - D / 2;
      const ret = Math.max(4 * db, 5);
      const r = D / 2;
      barEnd = xe;
      bar = {
        path:
          `M${-xe + ret},${lineY + dy} H${-xe} A${r},${r} 0 0 ${down ? 1 : 0} ${-xe},${lineY} ` +
          `H${xe} A${r},${r} 0 0 ${down ? 1 : 0} ${xe},${lineY + dy} H${xe - ret}`,
        width: barStroke(db),
      };
    }
  }

  const dots: GroundDetailModel['dots'] = [];
  const dotRun = dotDir ? layout.bottom[dotDir] : null;
  if (dotDir && dotRun) {
    const db = REBARS[dotRun.size].dia;
    // วาดจุดใต้เส้นเหล็กพอดีตามแบบ — เหล็กเส้นเล็กขยายจุดให้เห็นชัด
    const r = Math.max(db / 2, 0.38 * u);
    const y = bar ? lineY + bar.width / 2 + r : t - a.geom.z.bottom[dotDir];
    for (const x of runPositions(2 * barEnd, 0, db, dotRun.spacing)) dots.push({ x, y, r });
  }

  // ---- ป้ายชี้: ข้อความอยู่ปลายเส้นแนวนอน ตามแบบ
  const callouts: GroundCallout[] = [];
  const lineH = 1.6 * sizes.label;
  const textAt = (x: number, y: number, text: string): NoteText => {
    const note: NoteText = { x, y: y + 0.35 * sizes.label, text, anchor: 'start' };
    ext.add(textRect(note.x, note.y, text, sizes.label, 'start'));
    return note;
  };
  /** เส้นชี้จากปลายลูกศรขึ้น/ลงตรงถึงระดับข้อความ แล้วหักไปหน้าข้อความ */
  const elbow = (tipX: number, tipY: number, level: number, textX: number) => ({
    line: `M${tipX},${tipY} V${level} H${textX - 0.6 * u}`,
    arrow: arrowHead({ x: tipX, y: tipY }, { x: tipX, y: level }, u),
  });

  const mesh = meshText(layout);
  const nearestDot = (x: number) =>
    dots.reduce<(typeof dots)[number] | null>((best, d) => (!best || Math.abs(d.x - x) < Math.abs(best.x - x) ? d : best), null);

  if (outer) {
    const level = -5 * u;
    const tipX = -0.4 * half;
    const textX = tipX + 4 * u;
    const e = elbow(tipX, lineY - (bar ? bar.width / 2 : 0), level, textX);
    callouts.push({ key: 'mesh', lines: [e.line], arrows: e.arrow, text: textAt(textX, level, mesh) });
  } else {
    // สองบรรทัดเหนือพื้น: ร่องยาแนว (บน) ชี้ลงที่ร่องข้างคานซ้าย, ตะแกรง (ล่าง) ชี้ลงที่เส้นเหล็กและจุดเหล็ก
    const meshLevel = -4.5 * u;
    const grooveLevel = meshLevel - lineH;
    const textX = -0.3 * half;
    const gx = -half + DRAW.groove / 2;
    const g = elbow(gx, 0, grooveLevel, textX);
    callouts.push({ key: 'groove', lines: [g.line], arrows: g.arrow, text: textAt(textX, grooveLevel, GROOVE_NOTE) });

    // ลูกศรคู่ตามแบบ: หนึ่งชี้เส้นเหล็ก อีกหนึ่งชี้จุดเหล็กทิศตั้งฉาก (ตะแกรง #)
    const dot = nearestDot(-0.45 * half);
    const twin = dot && dot.x < textX - 2 * u ? dot : null;
    const lineTipX = twin ? twin.x - 3 * u : -0.55 * half;
    const m1 = elbow(lineTipX, lineY - (bar ? bar.width / 2 : 0), meshLevel, textX);
    const lines = [m1.line];
    let arrows = m1.arrow;
    if (twin) {
      const tipY = lineY - (bar ? bar.width / 2 : 0);
      lines.push(`M${twin.x},${tipY} V${meshLevel}`);
      arrows += ` ${arrowHead({ x: twin.x, y: tipY }, { x: twin.x, y: meshLevel }, u)}`;
    }
    callouts.push({ key: 'mesh', lines, arrows, text: textAt(textX, meshLevel, `${mesh} ${NO_EMBED_NOTE}`) });
  }

  {
    const tipX = outer ? -0.6 * half : -0.46 * half;
    const tipY = outer ? t + drop / 2 : t + DRAW.sand / 2;
    const level = sandBottom + DRAW.groundBand + 5 * u;
    const textX = tipX + 4 * u;
    const e = elbow(tipX, tipY, level, textX);
    callouts.push({ key: 'sand', lines: [e.line], arrows: e.arrow, text: textAt(textX, level, SAND_NOTE) });
  }

  // ---- ความหนาด้านซ้าย: ตัวเลขแนวนอนอยู่ซ้ายเส้น (ด้านสั้นภายนอกบอกความหนาขอบด้วย)
  const face = outer ? -half : -half - bw;
  const dimX = face - 5 * u;
  const ticks = outer ? [0, t, t + drop] : [0, t];
  const labels: NoteText[] = [];
  for (let i = 0; i < ticks.length - 1; i++) {
    const text = fmt((ticks[i + 1] - ticks[i]) / 100, 2);
    const note: NoteText = { x: dimX - 0.8 * u, y: (ticks[i] + ticks[i + 1]) / 2 + 0.35 * sizes.dim, text, anchor: 'end' };
    labels.push(note);
    ext.add(textRect(note.x, note.y, text, sizes.dim, 'end'));
  }
  const top = ticks[0] - 1.2 * u;
  const bottom = ticks[ticks.length - 1] + 1.2 * u;
  const extLines = [`M${face - 0.8 * u},0 H${dimX - 1.2 * u}`];
  if (outer) extLines.push(`M${face - 0.8 * u},${t + drop} H${dimX - 1.2 * u}`);
  else extLines.push(`M${dimX + 1.2 * u},${t} H${dimX - 1.2 * u}`);
  const dim = {
    path: [`M${dimX},${top} V${bottom}`, ...extLines].join(' '),
    ticks: ticks.map((y) => `M${dimX - 0.9 * u},${y - 0.9 * u} L${dimX + 0.9 * u},${y + 0.9 * u}`).join(' '),
    labels,
  };
  ext.add({ x1: dimX - 1.2 * u, y1: top, x2: dimX + 1.2 * u, y2: bottom });

  // ---- ชื่อรูป: "แบบขยายพื้น GS" ขีดเส้นใต้ "Scale ... 1:20" ใต้เส้น และคำกำกับด้านขวา
  const titleText = groundTitle(input);
  const titleSize = TEXT_MM.title * 1.15 * u;
  const lineW = textWidth(titleText, titleSize) + 6 * u;
  const suffixText = GROUND_DETAIL_SUFFIX[kind];
  const total = lineW + 1.5 * u + textWidth(suffixText, sizes.label);
  const x0 = -total / 2;
  const ty = ext.y2 + 7 * u;
  const subY = ty + 0.9 * u + sizes.small;
  const title: GroundTitle = {
    title: { x: x0, y: ty, text: titleText, anchor: 'start' },
    titleSize,
    underline: `M${x0},${ty + 0.9 * u} h${lineW}`,
    scaleLabel: { x: x0, y: subY, text: 'Scale', anchor: 'start' },
    scaleValue: { x: x0 + lineW, y: subY, text: `1:${denom}`, anchor: 'end' },
    suffix: { x: x0 + lineW + 1.5 * u, y: ty, text: suffixText, anchor: 'start' },
  };
  ext.add(textRect(x0, ty, titleText, titleSize, 'start'));
  ext.add(textRect(x0, subY, 'Scale', sizes.small, 'start'));
  ext.add(textRect(title.suffix.x, ty, suffixText, sizes.label, 'start'));

  const view = ext.box(2 * u);
  return {
    kind, denom, u, sizes, t, slabPath, beams, grooves, sandPath, groundBand, lineDir, bar, dots, callouts, dim, title,
    view, sizeMm: sizeMm(view, denom),
  };
}

/** มาตราส่วนของแบบขยาย — ตามแบบใช้ 1:20 ย่อลงเมื่อกรอบไม่พอ */
export const GROUND_SCALES = [20, 25, 30, 40, 50] as const;
/** กรอบรูปหนึ่งรูปบนหน้าจอ (มม.) */
export const GROUND_DETAIL_BOX = { w: 120, h: 70 };

const fits = (s: { w: number; h: number }, box: { w: number; h: number }) => s.w <= box.w && s.h <= box.h;

/** สองรูปใช้มาตราส่วนเดียวกัน — เลือกมาตราส่วนใหญ่ที่สุดที่ทั้งคู่พอดีกรอบ */
export function pickGroundScale(input: SlabInput, a: SlabAnalysis, layout: SlabLayout, box = GROUND_DETAIL_BOX): number {
  return (
    GROUND_SCALES.find((d) => GROUND_DETAILS.every((kind) => fits(buildGroundDetail(input, a, layout, kind, d).sizeMm, box))) ??
    GROUND_SCALES[GROUND_SCALES.length - 1]
  );
}
