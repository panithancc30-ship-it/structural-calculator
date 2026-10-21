/**
 * แบบขยายพื้น S1 — พื้นทางเดียวและพื้นสองทางใช้แบบนี้แบบเดียว แทนแปลนและรูปตัด X-X / Y-Y
 *
 * รูปตัดตามช่วงสั้นระหว่างศูนย์กลางคาน ซ้ายเป็นคานขอบ ขวาเป็นคานภายใน ตามแบบมาตรฐาน:
 * - กรณีพื้นทั่วไป: หลังพื้นเสมอหลังคาน คอม้าผ่านคานภายในไปช่วงถัดไป เสริมพิเศษยื่น L/4 ทั้งสองข้างคาน
 * - กรณีพื้นลดระดับ: พื้นต่ำกว่าหลังคานและพื้นข้างเคียง เหล็กบนงอลงฝังในคานทั้งสองข้าง
 *   เหล็กของพื้นข้างเคียงวาดสีจางให้เห็นการฝังในคาน (ไม่ใช่ผลออกแบบของพื้นนี้)
 *
 * ความหนา ระยะหุ้ม และเหล็กสามชุดมาจากผลออกแบบ ส่วนช่วงที่วาด ขนาดคาน และระยะลดระดับเป็นค่าเขียนแบบ
 * ระยะ L/4, L/5 เขียนเป็นสัญลักษณ์ตามแบบ (ค่าจริงอยู่ในขั้นตอนคำนวณ) — หน่วย ซม. พิกัด SVG y ชี้ลง ผิวบนพื้นอยู่ที่ y = 0
 */
import type { SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab';
import { ACI318_WSD_SLAB as K } from '@/engine/concrete/codes/aci318Wsd';
import type { BarDir } from '@/engine/concrete/footing/types';
import { cmToM, fmt } from '@/engine/concrete/format';
import { REBARS } from '@/engine/concrete/rebar';
import type { BarRun, SlabInput, SlabLayout, SlabLevel } from '@/engine/concrete/slab/types';
import type { Face } from '@/engine/concrete/types';
import { Extent, sizeMm, TEXT_MM, textRect, type Box, type NoteText, type TextSizes } from '../footing/footingDrawingModel';
import { arrowHead } from '../pilecap/pileCapDrawingModel';
import { detailTitle, type DetailTitle } from './groundSlabDrawingModel';
import { pickKey, type SlabPick } from './slabDrawingModel';

/** เหล็กสามชุดในแบบ — แตะได้ทุกชุด */
export type DetailRole = 'extra' | 'crank' | 'cross';
export const DETAIL_ROLES: DetailRole[] = ['extra', 'crank', 'cross'];

export const LEVEL_SUFFIX: Record<SlabLevel, string> = {
  general: '(กรณีพื้นทั่วไป)',
  dropped: '(กรณีพื้นลดระดับ)',
};

export const ROLE_TH: Record<DetailRole, string> = {
  extra: 'เสริมพิเศษ',
  crank: 'คอม้าเว้นเส้น',
  cross: 'เหล็กทิศตั้งฉาก',
};

/** ค่าเขียนแบบ (ซม.) — ไม่ได้ใช้ในการคำนวณ */
const DRAW = {
  /** Short Span ที่วาด (รูปขยายไม่ได้วาดเต็มช่วงจริง) */
  span: 160,
  beamWidth: 15,
  /** คานลึกใต้ท้องพื้น */
  beamBelow: 17,
  /** พื้นช่วงถัดไปที่วาดต่อจากคานภายใน */
  adjacent: 45,
  /** พื้นลดระดับต่ำกว่าหลังคานและพื้นข้างเคียง */
  drop: 5,
};

export const detailTitleText = (input: SlabInput) => `แบบขยายพื้น ${input.slabName || 'S1'}`;

/** ผิว/ทิศของเหล็กแต่ละชุด — ใช้กับ popover และไฮไลต์ */
export function rolePick(role: DetailRole, a: SlabAnalysis): SlabPick {
  const { dir, cross } = a.detail!;
  if (role === 'extra') return { kind: 'bars', face: 'top', dir };
  return { kind: 'bars', face: 'bottom', dir: role === 'crank' ? dir : cross };
}

/** เหล็กชุดที่ผิว/ทิศนี้แทนในแบบ S1 */
export function roleOf(face: Face, dir: BarDir, a: SlabAnalysis): DetailRole {
  if (face === 'top') return 'extra';
  return dir === a.detail!.dir ? 'crank' : 'cross';
}

/** "RB9" → "RB 9 มม. @ 0.25 ม." ตามที่เขียนในแบบ */
const runText = (run: BarRun) => `${run.size.replace(/^([A-Z]+)(\d+)$/, '$1 $2')} มม. @ ${cmToM(run.spacing)} ม.`;
const sameRun = (a: BarRun | null, b: BarRun | null) => !!a && !!b && a.size === b.size && a.spacing === b.spacing;

/** ป้ายเหล็กตามแบบ เช่น "เหล็ก RB 9 มม. @ 0.25 ม. (คอม้าเว้นเส้น)" */
export function roleText(role: DetailRole, input: SlabInput, layout: SlabLayout, a: SlabAnalysis): string {
  const { dir, cross } = a.detail!;
  const twoWay = input.slabType === 'twoWay';
  if (role === 'extra') {
    const run = layout.top[dir];
    if (!run) return 'ไม่มีเหล็กเสริมพิเศษ';
    const other = layout.top[cross];
    // พื้นสองทางใช้เสริมพิเศษชุดเดียวกันสองทิศ — ไฟล์ที่แก้ไว้ไม่เท่ากันต้องบอกทิศยาวด้วย
    const longText = twoWay && other && !sameRun(run, other) ? ` · ด้านยาว ${runText(other)}` : '';
    return `เหล็ก ${runText(run)} (${ROLE_TH.extra}${longText})`;
  }
  const run = layout.bottom[role === 'crank' ? dir : cross];
  if (!run) return role === 'crank' ? 'ไม่มีเหล็กคอม้า' : 'ไม่มีเหล็กทิศตั้งฉาก';
  if (role === 'crank') return `เหล็ก ${runText(run)} (${ROLE_TH.crank})`;
  return twoWay ? `เหล็ก ${runText(run)} (ด้านยาว ${ROLE_TH.crank})` : `เหล็ก ${runText(run)}`;
}

/** ข้อความสั้นในการ์ดสรุปและรูปเล่ม */
export function detailSummary(input: SlabInput, layout: SlabLayout, a: SlabAnalysis): { label: string; text: string }[] {
  const { dir, cross } = a.detail!;
  const short = (run: BarRun | null) => (run ? `${run.size} @${cmToM(run.spacing)}` : '—');
  const twoWay = input.slabType === 'twoWay';
  return [
    { label: twoWay ? `คอม้าด้านสั้น (${dir.toUpperCase()})` : `คอม้า (${dir.toUpperCase()})`, text: short(layout.bottom[dir]) },
    { label: 'เสริมพิเศษ', text: short(layout.top[dir]) },
    {
      label: twoWay ? `คอม้าด้านยาว (${cross.toUpperCase()})` : `กันร้าว (${cross.toUpperCase()})`,
      text: short(layout.bottom[cross]),
    },
  ];
}

export interface DetailBar {
  role: DetailRole;
  key: string;
  path: string;
  width: number;
}

export interface DetailCallout {
  role: DetailRole | 'cover';
  lines: string[];
  arrows: string;
  /** วงกลมรอบจุดเหล็กที่ป้ายชี้ (เหล็กทิศตั้งฉาก) */
  ring: { x: number; y: number; r: number } | null;
  text: NoteText;
}

export interface SlabDetailModel {
  level: SlabLevel;
  denom: number;
  u: number;
  sizes: TextSizes;
  t: number;
  /** คอนกรีต: พื้น คาน และพื้นช่วงถัดไป (เส้นเปิดที่ปลายขวา) และเส้นตัดที่ปลายขวา */
  concrete: string;
  breakLine: string;
  /** เส้นศูนย์กลางคาน (เส้นประจุด) */
  centerLines: string;
  bars: DetailBar[];
  /** เหล็กของพื้นข้างเคียง (พื้นลดระดับ) — วาดจาง แตะไม่ได้ */
  context: { path: string; width: number }[];
  dots: { key: string; x: number; y: number; r: number }[];
  callouts: DetailCallout[];
  dims: {
    lines: string;
    ticks: string;
    crosses: string;
    origins: { x: number; y: number }[];
    labels: NoteText[];
  };
  title: DetailTitle;
  view: Box;
  sizeMm: { w: number; h: number };
}

/** ค่าในช่วง [lo, hi] — hi ชนะเมื่อช่วงกลับด้าน */
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** ตำแหน่ง k·s ทั้งหมดที่อยู่ในช่วง [lo, hi] — เหล็กทิศตั้งฉากเรียงจากศูนย์กลางคานซ้าย */
const along = (s: number, lo: number, hi: number) => {
  const xs: number[] = [];
  for (let k = Math.ceil(lo / s - 1e-9); k * s <= hi + 1e-9; k++) xs.push(k * s);
  return xs;
};

export function buildSlabDetail(input: SlabInput, a: SlabAnalysis, layout: SlabLayout, denom: number): SlabDetailModel {
  const u = denom / 10;
  const sizes: TextSizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const { dir, cross } = a.detail!;
  const { t } = a.dims;
  const c = input.cover;
  const level = input.level;
  const dropped = level === 'dropped';
  const S = DRAW.span;
  const cut = S / K.detailTopCutoff;
  const bend = S / K.detailBend;
  const bw = DRAW.beamWidth;
  const beamBottom = t + Math.max(DRAW.beamBelow, t);
  const drop = dropped ? DRAW.drop : 0;
  /** หลังคาน / พื้นข้างเคียง */
  const top = -drop;
  const xe = S + bw / 2 + DRAW.adjacent;
  const ext = new Extent();

  // ---- คอนกรีต
  const concrete = dropped
    ? `M${xe},${top} H${S - bw / 2} V0 H${bw / 2} V${top} H${-bw / 2} V${beamBottom} H${bw / 2} V${t} ` +
      `H${S - bw / 2} V${beamBottom} H${S + bw / 2} V${top + t} H${xe}`
    : `M${xe},0 H${-bw / 2} V${beamBottom} H${bw / 2} V${t} H${S - bw / 2} V${beamBottom} H${S + bw / 2} V${t} H${xe}`;
  ext.add({ x1: -bw / 2, y1: top, x2: xe, y2: beamBottom });
  const mid = top + t / 2;
  const breakLine =
    `M${xe},${top - 1.2 * u} V${mid - 0.9 * u} L${xe + 0.7 * u},${mid - 0.3 * u} ` +
    `L${xe - 0.7 * u},${mid + 0.3 * u} L${xe},${mid + 0.9 * u} V${top + t + 1.2 * u}`;
  ext.add({ x1: xe - 0.7 * u, y1: top - 1.2 * u, x2: xe + 0.7 * u, y2: top + t + 1.2 * u });

  // ---- ระดับเหล็ก: คอม้าและเสริมพิเศษวางระดับเดียวกันที่ผิวบน ทิศตั้งฉากเป็นจุดชิดด้านในของเหล็กเส้น
  const crank = layout.bottom[dir];
  const extra = layout.top[dir];
  const crossRun = layout.bottom[cross];
  const dia = (run: BarRun | null) => (run ? REBARS[run.size].dia : 0);
  /** ความหนาเส้นเหล็กที่วาด — เหล็กเส้นเล็กยังต้องเห็นชัดที่มาตราส่วนนี้ */
  const stroke = (db: number) => Math.max(db, 0.3 * u);
  const dbM = dia(crank) || REBARS[input.bar].dia;
  const dbTop = Math.max(dbM, dia(extra));
  const yB = t - c - dbM / 2;
  const yT = c + dbTop / 2;
  const rise = yB - yT;

  /** ขอ 180° ที่ปลายเหล็กบนในเนื้อพื้น — งอลงเท่าที่เหลือที่เหนือเหล็กล่าง */
  const hookD = (db: number) => clamp(6 * db, 1.2, Math.max(1.2, rise - (dbM + db) / 2));
  const hookRet = (db: number) => Math.max(4 * db, 3);
  /** ขาเหล็กงอลงในคาน: ลงถึงท้องคานแล้วขอ 180° กลับขึ้น */
  const legBottom = beamBottom - c - dbTop / 2;
  const legD = clamp(6 * dbTop, 1.5, bw - 2 * c - dbTop);
  const legRet = hookRet(dbTop);
  const xL = -bw / 2 + c + dbTop / 2;
  /** ขาฝั่งคานขวาของพื้นลดระดับอยู่ชิดผิวคานด้านพื้นนี้ ตามแบบ */
  const xR = S - bw / 2 + c + dbTop / 2;
  const legLeft = `M${xL + legD},${legBottom - legRet} V${legBottom} A${legD / 2},${legD / 2} 0 0 1 ${xL},${legBottom} V${yT}`;
  const legRight = `V${legBottom} A${legD / 2},${legD / 2} 0 0 0 ${xR + legD},${legBottom} V${legBottom - legRet}`;
  /** ขอ 180° งอลงที่ปลายขวา / ปลายซ้ายของเหล็กบนในเนื้อพื้น */
  const hookEnd = (x: number, db: number) =>
    `A${hookD(db) / 2},${hookD(db) / 2} 0 0 1 ${x},${yT + hookD(db)} H${x - hookRet(db)}`;
  const hookStart = (x: number, db: number) =>
    `M${x + hookRet(db)},${yT + hookD(db)} H${x} A${hookD(db) / 2},${hookD(db) / 2} 0 0 1 ${x},${yT}`;

  const bars: DetailBar[] = [];
  const keys: Record<DetailRole, string> = {
    extra: pickKey('top', dir),
    crank: pickKey('bottom', dir),
    cross: pickKey('bottom', cross),
  };
  const end = xe - 0.5 * u;

  if (crank) {
    const w = stroke(dbM);
    // คอม้า: ล่างกลางช่วง งอขึ้นที่ L/5 (ปลายล่างของเส้นเอียง 45°) แล้วเป็นเหล็กบนถึงคาน
    const left = `${legLeft} H${bend - rise} L${bend},${yB}`;
    const right = dropped
      ? `H${S - bend} L${S - bend + rise},${yT} H${xR} ${legRight}`
      : `H${S - bend} L${S - bend + rise},${yT} H${S + bend - rise} L${S + bend},${yB} H${end}`;
    bars.push({ role: 'crank', key: keys.crank, path: `${left} ${right}`, width: w });

    // เส้นที่ไม่งอ: ล่างตลอด ปลายในคานขอบงอฉากขึ้น
    const xS = xL + dbTop;
    const up = Math.min(12 * dbM, rise);
    const straightEnd = dropped
      ? (() => {
          const x = S + bw / 2 - c - dbM / 2;
          const D = clamp(6 * dbM, 1.2, rise);
          return `H${x} A${D / 2},${D / 2} 0 0 0 ${x},${yB - D} H${x - hookRet(dbM)}`;
        })()
      : `H${end}`;
    bars.push({ role: 'crank', key: keys.crank, path: `M${xS},${yB - up} V${yB} ${straightEnd}`, width: w });
  }

  if (extra) {
    const db = dia(extra);
    const w = stroke(db);
    bars.push({ role: 'extra', key: keys.extra, path: `${legLeft} H${cut} ${hookEnd(cut, db)}`, width: w });
    bars.push({
      role: 'extra',
      key: keys.extra,
      path: dropped
        ? `${hookStart(S - cut, db)} H${xR} ${legRight}`
        : `${hookStart(S - cut, db)} H${S + cut} ${hookEnd(S + cut, db)}`,
      width: w,
    });
  }

  // ---- เหล็กพื้นข้างเคียง (พื้นลดระดับ) ฝังในคานด้วยขอ 180° — วาดตามแบบให้เห็นว่าเหล็กสองพื้นไม่ต่อกัน
  const context: SlabDetailModel['context'] = [];
  if (dropped) {
    const w = stroke(dbM);
    const yTa = top + yT;
    const yBa = top + yB;
    const xA = xR + 1.5 * dbTop;
    const D = hookD(dbM);
    const r = hookRet(dbM);
    const startTop = `M${xA + r},${yTa + D} H${xA} A${D / 2},${D / 2} 0 0 1 ${xA},${yTa}`;
    context.push(
      { path: `${startTop} H${S + cut} A${D / 2},${D / 2} 0 0 1 ${S + cut},${yTa + D} H${S + cut - r}`, width: w },
      { path: `${startTop} H${S + bend - rise} L${S + bend},${yBa} H${end}`, width: w },
      { path: `M${xA + r},${yBa - D} H${xA} A${D / 2},${D / 2} 0 0 0 ${xA},${yBa} H${end}`, width: w },
    );
  }

  // ---- เหล็กทิศตั้งฉาก: จุดวางบนเส้นเหล็กล่างตลอดช่วง และใต้เส้นเหล็กบนในช่วงที่มีเหล็กบน ตามแบบ
  // ศูนย์กลางจุดอยู่ที่ขอบด้านในของเส้นเหล็ก — พื้นบาง ระยะหุ้ม 3 ซม. จุดบนกับจุดล่างจึงไม่ทับกัน
  const dots: SlabDetailModel['dots'] = [];
  const bottomDots: { x: number; y: number; r: number }[] = [];
  if (crossRun) {
    const r = Math.max(dia(crossRun) / 2, 0.38 * u);
    const yBot = yB - stroke(dbM) / 2;
    const yTop = yT + stroke(dbTop) / 2;
    const lo = xL + dbTop / 2 + r;
    const hi = dropped ? S + bw / 2 - c - r : end - u;
    for (const x of along(crossRun.spacing, lo, hi)) bottomDots.push({ x, y: yBot, r });
    const zones: [number, number][] = [[lo, cut - r], [S - cut + r, dropped ? xR - r : S + cut - r]];
    for (const [z1, z2] of zones) {
      for (const x of along(crossRun.spacing, z1, z2)) dots.push({ key: keys.cross, x, y: yTop, r });
    }
    dots.push(...bottomDots.map((d) => ({ key: keys.cross, ...d })));
  }

  // ---- ป้ายชี้สามบรรทัดเหนือรูป ข้อความอยู่ปลายเส้นแนวนอนตามแบบ
  const callouts: DetailCallout[] = [];
  const lineH = 1.9 * sizes.label;
  const level3 = top - 9 * u;
  const levels: Record<DetailRole, number> = { extra: level3 - 2 * lineH, crank: level3 - lineH, cross: level3 };
  const textAt = (x: number, y: number, text: string, anchor: 'start' | 'end' = 'start'): NoteText => {
    const note: NoteText = { x, y: y + 0.35 * sizes.label, text, anchor };
    ext.add(textRect(note.x, note.y, text, sizes.label, anchor));
    return note;
  };

  // ลูกศรชี้เส้นเหล็กจากด้านบน — คอม้าชี้ระหว่างจุดเหล็กสองจุด จุดเหล็กชี้ทางขวาของคอม้า
  const nearest = (x: number, after = -Infinity) =>
    bottomDots
      .filter((d) => d.x > after)
      .reduce<(typeof bottomDots)[number] | null>((best, d) => (!best || Math.abs(d.x - x) < Math.abs(best.x - x) ? d : best), null);
  const extraTip = (bend + cut) / 2;
  const d1 = nearest(0.39 * S);
  const d1Next = d1 && bottomDots.find((d) => d.x > d1.x + 1e-9);
  const crankTip = d1 && d1Next ? (d1.x + d1Next.x) / 2 : 0.39 * S;
  const ringDot = nearest(0.46 * S, crankTip + 2 * u);
  const crossTip = ringDot?.x ?? crankTip + 4 * u;
  const labelX = { extra: extraTip + 13 * u, rest: crossTip + 9 * u };

  const pointer = (role: DetailRole, tipX: number, tipY: number, textX: number, ring: DetailCallout['ring']) => {
    const lvl = levels[role];
    const from = ring ? ring.y - ring.r : tipY;
    callouts.push({
      role,
      lines: [`M${tipX},${from} V${lvl} H${textX - 0.6 * u}`],
      arrows: ring ? '' : arrowHead({ x: tipX, y: tipY }, { x: tipX, y: lvl }, u),
      ring,
      text: textAt(textX, lvl, roleText(role, input, layout, a)),
    });
  };
  pointer('extra', extraTip, yT - stroke(dbTop) / 2, labelX.extra, null);
  pointer('crank', crankTip, yB - stroke(dbM) / 2, labelX.rest, null);
  pointer('cross', crossTip, ringDot?.y ?? yB, labelX.rest, ringDot ? { x: ringDot.x, y: ringDot.y, r: ringDot.r + 0.5 * u } : null);
  if (ringDot) ext.add({ x1: ringDot.x - ringDot.r - 0.5 * u, y1: ringDot.y - ringDot.r - 0.5 * u, x2: ringDot.x + ringDot.r + 0.5 * u, y2: ringDot.y });

  // ระยะหุ้ม: ลูกศรคู่ระหว่างผิวบนกับเหล็กบน ข้อความทางซ้าย (กรณีพื้นทั่วไปตามแบบ)
  if (!dropped) {
    const x = bw / 2 - 1.5;
    const lvl = top - 4 * u;
    const textEnd = x - 4 * u;
    callouts.push({
      role: 'cover',
      lines: [`M${x},0 V${lvl} H${textEnd + 0.6 * u}`, `M${x},${c} V${c + 2.5 * u}`],
      arrows: `${arrowHead({ x, y: 0 }, { x, y: lvl }, u)} ${arrowHead({ x, y: c }, { x, y: c + 2.5 * u }, u)}`,
      ring: null,
      text: textAt(textEnd, lvl, `Covering=${fmt(c, 1)}cm.`, 'end'),
    });
  }

  // ---- เส้นบอกระยะ: L/4 (ในช่องใต้พื้น) L/5 และ Short Span (ใต้คาน) ตามแบบ
  const rowCut = t + 0.7 * (beamBottom - t);
  const rowBend = beamBottom + 3.5 * u;
  const rowSpan = rowBend + 4 * u;
  const lines: string[] = [];
  const ticks: string[] = [];
  const origins: { x: number; y: number }[] = [];
  const labels: NoteText[] = [];
  const label = (x: number, y: number, text: string) => {
    const note: NoteText = { x, y: y - 0.8 * u, text, anchor: 'middle' };
    labels.push(note);
    ext.add(textRect(note.x, note.y, text, sizes.dim, 'middle'));
  };
  /** ช่วงจากศูนย์กลางคาน (จุด) ไปถึงปลาย (ขีด 45°) พร้อมเส้นช่วยลงมาจากด้านบน */
  const seg = (from: number, to: number, row: number, text: string) => {
    const s = Math.sign(to - from);
    lines.push(`M${from},${row} H${to + s * u}`, `M${to},${row - 3.5 * u} V${row + u}`);
    ticks.push(`M${to - 0.7 * u},${row + 0.7 * u} L${to + 0.7 * u},${row - 0.7 * u}`);
    origins.push({ x: from, y: row });
    label((from + to) / 2, row, text);
    ext.add({ x1: Math.min(from, to + s * u), y1: row - 3.5 * u, x2: Math.max(from, to + s * u), y2: row + u });
  };
  const supports: [number, -1 | 1][] = dropped ? [[0, 1], [S, -1]] : [[0, 1], [S, -1], [S, 1]];
  for (const [x, s] of supports) {
    seg(x, x + s * cut, rowCut, 'L/4');
    seg(x, x + s * bend, rowBend, 'L/5');
  }
  const cross2 = (x: number, y: number) => `M${x - 1.2 * u},${y} H${x + 1.2 * u} M${x},${y - 1.2 * u} V${y + 1.2 * u}`;
  const crosses = [cross2(0, rowSpan), cross2(S, rowSpan)];
  lines.push(`M${0},${rowSpan} H${S}`);
  label(S / 2, rowSpan, 'Short Span');
  ext.add({ x1: -1.2 * u, y1: rowSpan - 1.2 * u, x2: S + 1.2 * u, y2: rowSpan + 1.2 * u });

  // ความหนา: พื้นทั่วไปบอกที่ปลายขวา, พื้นลดระดับบอกพื้นนี้ทางซ้ายและพื้นข้างเคียงทางขวา (ตัวเลขแนวนอน)
  const thickness = (x: number, faceX: number, y0: number, side: -1 | 1) => {
    lines.push(`M${faceX + side * 0.8 * u},${y0} H${x + side * 1.2 * u}`, `M${faceX + side * 0.8 * u},${y0 + t} H${x + side * 1.2 * u}`);
    lines.push(`M${x},${y0 - 1.2 * u} V${y0 + t + 1.2 * u}`);
    crosses.push(cross2(x, y0), cross2(x, y0 + t));
    const note: NoteText = { x: x + side * 1.4 * u, y: y0 + t / 2 + 0.35 * sizes.dim, text: fmt(t / 100, 2), anchor: side > 0 ? 'start' : 'end' };
    labels.push(note);
    ext.add(textRect(note.x, note.y, note.text, sizes.dim, note.anchor));
    ext.add({ x1: x - 1.2 * u, y1: y0 - 1.2 * u, x2: x + 1.2 * u, y2: y0 + t + 1.2 * u });
  };
  if (dropped) thickness(-bw / 2 - 4 * u, -bw / 2, 0, -1);
  thickness(xe + 4 * u, xe, top, 1);

  const centerLines = [0, S].map((x) => `M${x},${top - 3 * u} V${rowSpan + 1.5 * u}`).join(' ');

  const title = detailTitle(ext, S / 2, detailTitleText(input), LEVEL_SUFFIX[level], denom, u, sizes);
  const view = ext.box(2 * u);
  return {
    level, denom, u, sizes, t, concrete, breakLine, centerLines, bars, context, dots, callouts,
    dims: { lines: lines.join(' '), ticks: ticks.join(' '), crosses: crosses.join(' '), origins, labels },
    title, view, sizeMm: sizeMm(view, denom),
  };
}

/** มาตราส่วนของแบบขยาย — ตามแบบใช้ 1:20 ย่อลงเมื่อกรอบไม่พอ */
export const DETAIL_SCALES = [20, 25, 30, 40, 50] as const;
/** กรอบรูปบนหน้าจอ (มม.) */
export const SLAB_DETAIL_SCREEN_BOX = { w: 180, h: 90 };

export function pickDetailScale(input: SlabInput, a: SlabAnalysis, layout: SlabLayout, box = SLAB_DETAIL_SCREEN_BOX): number {
  return (
    DETAIL_SCALES.find((d) => {
      const s = buildSlabDetail(input, a, layout, d).sizeMm;
      return s.w <= box.w && s.h <= box.h;
    }) ?? DETAIL_SCALES[DETAIL_SCALES.length - 1]
  );
}
