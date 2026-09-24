/**
 * แปลงบันได → องค์ประกอบรูปตัด (หน่วย ซม. ตามจริง) + เลือกมาตราส่วนให้พอดีกรอบกระดาษ
 *
 * สร้างเรขาคณิตในพิกัดวิศวกรรม: x ตามแนวราบจากศูนย์กลางคานปลายล่าง, y ชี้ขึ้นจากผิวบนส่วนราบปลายล่าง
 * แล้วแปลงเป็นพิกัด SVG ครั้งเดียวตอนวางป้ายและเส้นบอกขนาด — บันไดขึ้นซ้ายหรือขวาจึงใช้เรขาคณิตชุดเดียวกัน
 */
import { ACI318_WSD_SLAB as KS, ACI318_WSD_STAIR as K } from '@/engine/concrete/codes/aci318Wsd';
import { cmToM, fmt } from '@/engine/concrete/format';
import { REBARS } from '@/engine/concrete/rebar';
import type { StairAnalysis } from '@/engine/concrete/stair/analyzeStair';
import type { StairBarKey, StairEnd, StairInput, StairLayout } from '@/engine/concrete/stair/types';
import {
  addDimExtent,
  addTitleExtent,
  dimLine,
  Extent,
  overlaps,
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
import { runText } from '../slab/slabDrawingModel';

/** กรอบรูปบนหน้าจอ (มม.) */
export const STAIR_BOX = { w: 170, h: 110 };
/** มาตราส่วนที่ใช้กับแบบบันได — แบบขยายบันไดนิยม 1:20 ถึง 1:50 */
export const STAIR_SCALES = [20, 25, 30, 40, 50, 75, 100] as const;

/** สิ่งที่คลิกได้ในรูปบันได */
export interface StairPick {
  kind: 'bars';
  key: StairBarKey;
}

export const END_TH: Record<StairEnd, string> = { simple: 'ยึดหมุน', continuous: 'ต่อเนื่อง' };

/** ความกว้างคานรองรับที่ใช้วาด (ซม.) — ค่าสมมติสำหรับเขียนแบบ ไม่ได้ใช้ในการคำนวณ */
const BEAM_WIDTH = 2 * K.minLanding;
/** ความลึกคานรวมพื้นที่ใช้วาด (ซม.) — อยู่ในช่วงคานจริงทั่วไป */
const beamDepth = (t: number) => Math.min(60, Math.max(30, 2.5 * t));
/** ความยาวพื้นช่วงถัดไปที่วาดต่อจากคานเมื่อปลายต่อเนื่อง */
const CONTINUE_LENGTH = 40;
/** ความยาวขอที่งอลงไปในคาน = 12db (ACI 7.1.2) */
const HOOK_DB = 12;

const LEVEL_TEXT = (cm: number) => (cm === 0 ? '±0.00' : `+${fmt(cm / 100, 2)}`);

interface Pt {
  x: number;
  y: number;
}

/** เส้นตรง y = m·x + q */
interface Line {
  m: number;
  q: number;
}

const at = (l: Line, x: number) => l.m * x + l.q;
const cross = (a: Line, b: Line): Pt => {
  const x = (b.q - a.q) / (a.m - b.m);
  return { x, y: at(a, x) };
};
const flat = (y: number): Line => ({ m: 0, q: y });
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** จุดที่วางเรียงตามแนวเส้นหักด้วยระยะคงที่ จัดให้อยู่กึ่งกลางความยาวทั้งเส้น */
function pointsAlong(path: Pt[], spacing: number): Pt[] {
  const segs = path.slice(1).map((b, i) => {
    const a = path[i];
    return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) };
  });
  const total = segs.reduce((s, g) => s + g.len, 0);
  if (total <= 0 || spacing <= 0) return [];
  const count = Math.floor(total / spacing + 1e-9);
  const offset = (total - count * spacing) / 2;
  const out: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    let dist = offset + i * spacing;
    for (const g of segs) {
      if (dist <= g.len + 1e-9 || g === segs[segs.length - 1]) {
        const f = g.len > 0 ? Math.min(1, dist / g.len) : 0;
        out.push({ x: g.a.x + f * (g.b.x - g.a.x), y: g.a.y + f * (g.b.y - g.a.y) });
        break;
      }
      dist -= g.len;
    }
  }
  return out;
}

export interface StairSectionModel {
  denom: number;
  u: number;
  sizes: TextSizes;
  /** เส้นขอบคอนกรีตทั้งหมด (ท้องบันได ขั้นบันได ส่วนราบ คานรองรับ) เป็นรูปปิดรูปเดียว */
  outline: string;
  /** เส้นศูนย์กลางคานรองรับ */
  axes: string;
  /** เหล็กที่ขนานกับระนาบตัด — หนึ่งเส้นทางต่อเหล็กหนึ่งเส้น */
  bars: { key: StairBarKey; path: string; width: number }[];
  /** เหล็กที่ตั้งฉากกับระนาบตัด (เหล็กกระจาย เหล็กมุมขั้น) วาดเป็นจุด */
  dots: { key: StairBarKey; x: number; y: number; r: number }[];
  /** เครื่องหมายระดับที่ปลายทั้งสอง */
  levels: { path: string; line: string; text: NoteText }[];
  leaders: Leader[];
  dims: DimLine[];
  extensions: string;
  titleBlock: TitleBlock;
  view: Box;
  sizeMm: { w: number; h: number };
}

export const stairTitle = (input: StairInput) => {
  const name = input.stairName.trim() || 'ST1';
  const levels = input.levels.trim();
  return levels ? `${name} (${levels})` : name;
};

interface LabelSpec {
  key: string;
  from: Pt;
  to: Pt;
  anchor: 'start' | 'end';
  text: string;
  sub: string;
  /** ทิศที่เลื่อนป้ายหนีเมื่อทับป้ายอื่น: −1 ขึ้น, +1 ลง (พิกัด SVG) */
  away: -1 | 1;
}

export function buildStairModel(
  input: StairInput,
  a: StairAnalysis,
  layout: StairLayout,
  denom: number,
): StairSectionModel {
  const u = denom / 10;
  const sizes: TextSizes = { label: TEXT_MM.label * u, dim: TEXT_MM.dim * u, small: TEXT_MM.small * u };
  const { t } = a.dims;
  const { L, rise: H, run, cos, sin, tan, xFirst: x0, xLast } = a.profile;
  const N = input.risers;
  const R = input.riser;
  const T = input.tread;
  const cv = input.cover;
  const half = BEAM_WIDTH / 2;
  const lowCont = input.endLow === 'continuous';
  const highCont = input.endHigh === 'continuous';
  const xL = lowCont ? -half - CONTINUE_LENGTH : -half;
  const xR = highCont ? L + half + CONTINUE_LENGTH : L + half;
  const lap = K.kinkLap;

  /** เส้นขนานกับแนวมุมในของขั้นบันได เลื่อนตั้งฉากออกไป δ (บวก = ขึ้น) — δ = −t คือท้องบันได */
  const slope = (delta: number): Line => ({ m: tan, q: -x0 * tan + delta / cos });

  // ---------------------------------------------------------------- คอนกรีต
  const soffitFl = slope(-t);
  const k1 = cross(flat(-t), soffitFl).x;
  const k2 = cross(flat(H - t), soffitFl).x;
  const soffitAt = (x: number) => (x <= k1 ? -t : x >= k2 ? H - t : at(soffitFl, x));
  const hbL = Math.max(beamDepth(t), t + 15);
  const hbR = Math.max(beamDepth(t), t + 15, H - soffitAt(L - half) + 10);

  /** รอยตัดของพื้นที่ต่อเนื่องไปช่วงถัดไป — เส้นซิกแซกตั้งฉาก */
  const breakEdge = (x: number, yFrom: number, yTo: number): Pt[] => {
    const mid = (yFrom + yTo) / 2;
    const s = Math.sign(yTo - yFrom);
    const z = Math.min(1.2 * u, Math.abs(yTo - yFrom) / 3);
    return [
      { x, y: mid - s * z },
      { x: x + 0.8 * z, y: mid - s * 0.3 * z },
      { x: x - 0.8 * z, y: mid + s * 0.3 * z },
      { x, y: mid + s * z },
      { x, y: yTo },
    ];
  };

  const outline: Pt[] = [{ x: xL, y: 0 }, { x: x0, y: 0 }];
  for (let k = 1; k <= N - 1; k++) outline.push({ x: x0 + (k - 1) * T, y: k * R }, { x: x0 + k * T, y: k * R });
  outline.push({ x: xLast, y: H }, { x: xR, y: H });
  if (highCont) outline.push(...breakEdge(xR, H, H - t), { x: L + half, y: H - t });
  outline.push({ x: L + half, y: H - hbR }, { x: L - half, y: H - hbR }, { x: L - half, y: soffitAt(L - half) });
  if (k2 < L - half) outline.push({ x: k2, y: H - t });
  outline.push({ x: k1, y: -t }, { x: half, y: -t }, { x: half, y: -hbL }, { x: -half, y: -hbL });
  if (lowCont) outline.push({ x: -half, y: -t }, { x: xL, y: -t }, ...breakEdge(xL, -t, 0));

  // ---------------------------------------------------------------- เหล็กเสริม
  const dia = (key: StairBarKey) => {
    const r = layout[key];
    return r ? REBARS[r.size].dia : 0;
  };
  const dB = dia('bottom');
  const dTL = dia('topLow');
  const dTH = dia('topHigh');
  const bars: { key: StairBarKey; pts: Pt[]; width: number }[] = [];
  const dots: StairSectionModel['dots'] = [];
  const specs: LabelSpec[] = [];

  const xHookL = -half + cv;
  const xHookR = L + half - cv;
  const embedLow = (db: number) => Math.max(0, Math.min(HOOK_DB * db, hbL - t - 2 * cv));
  const embedHigh = (db: number) => Math.max(0, Math.min(HOOK_DB * db, hbR - t - 2 * cv));

  /** ปลายเหล็กที่ปลายล่าง: หล่อติดคาน → งอขอลงไปในคาน, ต่อเนื่อง → วิ่งต่อไปถึงรอยตัด */
  const fromLow = (y: number, db: number): Pt[] =>
    lowCont ? [{ x: xL, y }] : [{ x: xHookL, y: -t - embedLow(db) }, { x: xHookL, y }];
  /** ปลายเหล็กที่ปลายบน เรียงจากปลายเข้าหาช่วงบันได */
  const fromHigh = (y: number, db: number): Pt[] =>
    highCont ? [{ x: xR, y }] : [{ x: xHookR, y: H - t - embedHigh(db) }, { x: xHookR, y }];

  // ระยะที่เหล็กบนยื่นเข้าไปในช่วงลาด — อย่างน้อยถึง L/4 จากที่รองรับ และเลยมุมหักไม่น้อยกว่าระยะทาบ
  const eTL = cv + dTL / 2;
  const eTH = cv + dTH / 2;
  const valleyTop = cross(flat(-eTL), slope(-eTL));
  const ridgeTop = cross(flat(H - eTH), slope(-eTH));
  const reachLow = clamp(Math.max(KS.topBarExtension * L, valleyTop.x + lap * cos), valleyTop.x, xLast);
  const reachHigh = clamp(Math.min((1 - KS.topBarExtension) * L, ridgeTop.x - lap * cos), x0, ridgeTop.x);

  if (layout.bottom) {
    const e = cv + dB / 2;
    const low = flat(-t + e);
    const fl = slope(-t + e);
    const high = flat(H - t + e);

    // เหล็กล่างช่วงลาด: ดัดตามมุมหักด้านล่าง (มุมนอกของผิวล่าง) แล้ววิ่งตรงเลยมุมหักด้านบน
    // ซึ่งเป็นมุมด้านในของผิวล่าง ขึ้นไปทาบกับผิวบนของส่วนราบ แทนการดัดตามมุมที่จะดึงคอนกรีตหุ้มหลุด
    const P1 = cross(low, fl);
    const P2 = cross(fl, flat(H - cv - dTH - dB / 2));
    const limit = highCont ? xR : xHookR;
    const A = [...fromLow(low.q, dB), P1];
    if (P2.x <= limit) {
      A.push(P2, { x: Math.min(P2.x + lap, limit), y: P2.y });
    } else {
      const y = at(fl, limit);
      A.push({ x: limit, y });
      if (!highCont) A.push({ x: limit, y: Math.max(y - HOOK_DB * dB, H - hbR + cv) });
    }
    bars.push({ key: 'bottom', pts: A, width: dB });

    // เหล็กล่างส่วนราบบน: วิ่งตรงเลยมุมหักเข้าไปในช่วงลาดจนถึงผิวบน แล้วทาบต่อตามผิวบน
    if (k2 < L - half) {
      const Q1 = cross(high, slope(-(cv + dTH + dB / 2)));
      const Q2 = { x: Q1.x - lap * cos, y: Q1.y - lap * sin };
      bars.push({ key: 'bottom', pts: [...fromHigh(high.q, dB), Q1, Q2], width: dB });
    }

    const F = { x: P1.x + 0.62 * (P2.x - P1.x), y: P1.y + 0.62 * (P2.y - P1.y) };
    specs.push({
      key: 'bottom', from: F, to: { x: F.x + 3 * u, y: F.y - 7 * u }, anchor: 'start',
      text: runText(layout.bottom), sub: 'เหล็กล่าง', away: 1,
    });
  }

  if (layout.topLow) {
    const tl = flat(-eTL);
    const tf = slope(-eTL);
    // มุมหักด้านล่างเป็นมุมด้านในของผิวบน เหล็กบนจึงไขว้กัน: เหล็กส่วนราบวิ่งตรงลงไปถึงผิวล่างของช่วงลาด
    // ส่วนเหล็กช่วงลาดวิ่งเลยมุมลงไปถึงผิวล่างของส่วนราบ แล้วทาบต่อทั้งสองเส้น
    const C1 = cross(tl, slope(-t + cv + dB + dTL / 2));
    bars.push({
      key: 'topLow',
      pts: [...fromLow(tl.q, dTL), C1, { x: C1.x + lap * cos, y: C1.y + lap * sin }],
      width: dTL,
    });
    const D0 = { x: reachLow, y: at(tf, reachLow) };
    const D1 = cross(tf, flat(-t + cv + dB + dTL / 2));
    bars.push({
      key: 'topLow',
      pts: [D0, D1, { x: Math.max(D1.x - lap, lowCont ? xL : xHookL), y: D1.y }],
      width: dTL,
    });

    const onLanding = x0 >= 40;
    const from = onLanding ? { x: 0.45 * x0, y: tl.q } : { x: D1.x + 0.6 * (D0.x - D1.x), y: D1.y + 0.6 * (D0.y - D1.y) };
    specs.push({
      key: 'topLow', from, to: { x: from.x - 3 * u, y: Math.max(from.y, 0) + 7 * u }, anchor: 'end',
      text: runText(layout.topLow), sub: 'เหล็กบนปลายล่าง', away: -1,
    });
  }

  if (layout.topHigh) {
    const th = flat(H - eTH);
    const tf = slope(-eTH);
    // มุมหักด้านบนเป็นมุมนอกของผิวบน เหล็กบนดัดตามมุมต่อเนื่องได้
    const E2 = { x: reachHigh, y: at(tf, reachHigh) };
    bars.push({ key: 'topHigh', pts: [...fromHigh(th.q, dTH), ridgeTop, E2], width: dTH });

    const from = { x: (ridgeTop.x + Math.min(L, xHookR)) / 2, y: th.q };
    specs.push({
      key: 'topHigh', from, to: { x: from.x - 3 * u, y: H + 7 * u }, anchor: 'end',
      text: runText(layout.topHigh), sub: 'เหล็กบนปลายบน', away: -1,
    });
  }

  if (layout.dist) {
    const dd = dia('dist');
    const r = dd / 2;
    const s = layout.dist.spacing;
    const startX = (lowCont ? xL : -half) + cv + dd;
    const endX = (highCont ? xR : L + half) - cv - dd;
    const place = (path: Pt[]) => pointsAlong(path, s).forEach((p) => dots.push({ key: 'dist', ...p, r }));

    // เหล็กกระจายวางถัดจากเหล็กหลักเข้าไปในเนื้อคอนกรีต
    const e = cv + dB + dd / 2;
    const low = flat(-t + e);
    const fl = slope(-t + e);
    const high = flat(H - t + e);
    const P1 = cross(low, fl);
    const P2 = cross(fl, high);
    const bottomPath =
      P2.x < endX
        ? [{ x: startX, y: low.q }, P1, P2, { x: endX, y: high.q }]
        : [{ x: startX, y: low.q }, P1, { x: endX, y: at(fl, endX) }];
    const bottomDots = pointsAlong(bottomPath, s);
    bottomDots.forEach((p) => dots.push({ key: 'dist', ...p, r }));

    if (layout.topLow) {
      const e2 = cv + dTL + dd / 2;
      const tf = slope(-e2);
      place([{ x: startX, y: -e2 }, cross(flat(-e2), tf), { x: reachLow, y: at(tf, reachLow) }]);
    }
    if (layout.topHigh) {
      const e2 = cv + dTH + dd / 2;
      const tf = slope(-e2);
      place([{ x: reachHigh, y: at(tf, reachHigh) }, cross(tf, flat(H - e2)), { x: endX, y: H - e2 }]);
    }

    // ป้ายชี้ที่จุดเหล็กกระจายช่วงล่างของช่วงลาด
    const target = x0 + 0.25 * run;
    const D = bottomDots.reduce((best, p) => (Math.abs(p.x - target) < Math.abs(best.x - target) ? p : best), bottomDots[0]);
    if (D) {
      specs.push({
        key: 'dist', from: D, to: { x: D.x + 3 * u, y: D.y - 6 * u }, anchor: 'start',
        text: runText(layout.dist), sub: 'เหล็กกระจาย', away: 1,
      });
    }
  }

  if (layout.step) {
    const ds = dia('step');
    const es = cv + ds / 2;
    // เหล็กขั้นบันไดงอตามลูกตั้งและลูกนอน ขาทั้งสองยึดลงไปถึงระดับเหล็กบนของท้องบันได
    const waist = slope(-es);
    const nose: Pt[] = [];
    for (let k = 1; k <= N - 1; k++) {
      const xr = x0 + (k - 1) * T;
      const yt = k * R;
      const S1 = { x: xr + es, y: yt - es };
      bars.push({
        key: 'step',
        pts: [{ x: xr + es, y: at(waist, xr + es) }, S1, cross(flat(yt - es), waist)],
        width: ds,
      });
      // เหล็กมุมขั้น — วางในมุมของเหล็กขั้นบันไดทุกขั้น
      dots.push({ key: 'step', x: xr + es + ds, y: yt - es - ds, r: ds / 2 });
      nose.push(S1);
    }
    if (nose.length > 0) {
      const S = nose[Math.max(0, Math.round(0.6 * (nose.length - 1)))];
      specs.push({
        key: 'step', from: S, to: { x: S.x - 5 * u, y: S.y + 7 * u }, anchor: 'end',
        text: runText(layout.step), sub: `ขั้นบันได · ${layout.step.size} ทุกมุม`, away: -1,
      });
    }
  }

  // ---------------------------------------------------------------- แปลงเป็นพิกัดรูป
  const s = input.ascend === 'left' ? -1 : 1;
  const X = (x: number) => s * (x - L / 2);
  const Y = (y: number) => -y;
  const flipAnchor = (anchor: 'start' | 'end'): 'start' | 'end' =>
    s > 0 ? anchor : anchor === 'start' ? 'end' : 'start';
  const toPath = (pts: Pt[], close = false) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x)},${Y(p.y)}`).join(' ') + (close ? ' Z' : '');

  const ext = new Extent();
  const addPts = (pts: Pt[]) => pts.forEach((p) => ext.add({ x1: X(p.x), y1: Y(p.y), x2: X(p.x), y2: Y(p.y) }));
  addPts(outline);
  bars.forEach((b) => addPts(b.pts));

  // เครื่องหมายระดับ นอกปลายพื้นทั้งสองด้าน
  const placed: Rect[] = [];
  const levels: StairSectionModel['levels'] = [];
  const levelAt = (x: number, y: number, outward: number, text: string) => {
    const x1 = X(x);
    const yy = Y(y);
    const o = outward * s;
    const ax = x1 + o * 5 * u;
    const note: NoteText = { x: ax, y: yy - 2.2 * u, text, anchor: 'middle' };
    levels.push({
      path: `M${ax - 0.9 * u},${yy - 1.6 * u} L${ax},${yy} L${ax + 0.9 * u},${yy - 1.6 * u} Z`,
      line: `M${x1 + o * 0.8 * u},${yy} H${x1 + o * 9 * u}`,
      text: note,
    });
    const rect = textRect(note.x, note.y, text, sizes.small, 'middle');
    placed.push(rect);
    ext.add(rect);
    ext.add({ x1: Math.min(x1, x1 + o * 9 * u), y1: yy - 1.6 * u, x2: Math.max(x1, x1 + o * 9 * u), y2: yy });
  };
  levelAt(xL, 0, -1, LEVEL_TEXT(0));
  levelAt(xR, H, 1, LEVEL_TEXT(H));

  // ป้ายกำกับเหล็ก — เลื่อนออกห่างรูปเมื่อทับป้ายที่วางไปแล้ว
  const leaders: Leader[] = [];
  for (const sp of specs) {
    const anchor = flipAnchor(sp.anchor);
    const fx = X(sp.from.x);
    const fy = Y(sp.from.y);
    const tx = X(sp.to.x);
    const pad = (anchor === 'start' ? 1 : -1) * 0.6 * u;
    const subGap = sizes.small * 1.25;
    const rectsAt = (ty: number) => [
      textRect(tx + pad, ty, sp.text, sizes.label, anchor),
      textRect(tx + pad, ty + subGap, sp.sub, sizes.small, anchor),
    ];
    let ty = Y(sp.to.y);
    for (let i = 0; i < 12 && rectsAt(ty).some((r) => placed.some((p) => overlaps(r, p, 0.4 * u))); i++) {
      ty += sp.away * 2 * u;
    }
    const rects = rectsAt(ty);
    rects.forEach((r) => {
      placed.push(r);
      ext.add(r);
    });
    leaders.push({
      key: sp.key,
      dir: 'x',
      points: `${fx},${fy} ${tx},${ty}`,
      text: sp.text,
      tx: tx + pad,
      ty,
      anchor,
      sub: { text: sp.sub, x: tx + pad, y: ty + subGap },
    });
  }

  // ---------------------------------------------------------------- เส้นบอกขนาด
  const occupied: Rect[] = [...placed];
  const dims: DimLine[] = [];
  const m2 = (cm: number) => fmt(cm / 100, 2);
  const hseg = (x1: number, x2: number, text: string): DimSeg => {
    const p = X(x1);
    const q = X(x2);
    return { a: Math.min(p, q), b: Math.max(p, q), text };
  };

  // ระยะราบ: ส่วนราบล่าง · ขั้นบันได · ส่วนราบบน และช่วงราบรวม (ระหว่างศูนย์กลางคาน)
  const rowChain = ext.y1 - 4 * u;
  const chain = [
    hseg(0, x0, m2(x0)),
    hseg(x0, xLast, `${N - 1}@${cmToM(T)}=${m2(run)}`),
    hseg(xLast, L, m2(input.landingHigh)),
  ].sort((p, q) => p.a - q.a);
  const chainLine = dimLine(chain, rowChain, false, sizes.dim, u, occupied);
  addDimExtent(ext, chainLine, sizes.dim, u);
  const rowTotal = Math.min(ext.y1, rowChain - 1.5 * u) - 3.5 * u;
  const totalLine = dimLine([hseg(0, L, m2(L))], rowTotal, false, sizes.dim, u, occupied);
  addDimExtent(ext, totalLine, sizes.dim, u);
  dims.push(chainLine, totalLine);

  // ความสูงช่วงบันได N@R อยู่ด้านปลายล่าง ความหนาพื้นอยู่ด้านปลายบน — ใช้ได้ทั้งบันไดขึ้นซ้ายและขวา
  const lowSide = -s;
  const riseRow = lowSide < 0 ? ext.x1 - 4 * u : ext.x2 + 4 * u;
  const riseLine = dimLine(
    [{ a: Y(H), b: Y(0), text: `${N}@${cmToM(R)}=${m2(H)}` }],
    riseRow, true, sizes.dim, u, occupied,
  );
  addDimExtent(ext, riseLine, sizes.dim, u);
  const thickRow = lowSide < 0 ? ext.x2 + 3 * u : ext.x1 - 3 * u;
  const thickLine = dimLine([{ a: Y(H), b: Y(H - t), text: cmToM(t) }], thickRow, true, sizes.dim, u, occupied);
  addDimExtent(ext, thickLine, sizes.dim, u);
  dims.push(riseLine, thickLine);

  const hx = (x: number, y: number, row: number) => {
    const from = X(x);
    const dirn = Math.sign(row - from);
    return `M${from + dirn * 1 * u},${Y(y)} H${row + dirn * 1.2 * u}`;
  };
  const extensions = [
    hx(xL, 0, riseRow),
    hx(xLast, H, riseRow),
    hx(xR, H, thickRow),
    hx(xR, H - t, thickRow),
  ].join(' ');

  // เส้นศูนย์กลางคานรองรับ ลากจากเส้นบอกขนาดลงมาถึงใต้คาน
  const axisTop = rowTotal - 1.5 * u;
  const axes = [
    `M${X(0)},${axisTop} V${Y(-hbL) + 3 * u}`,
    `M${X(L)},${axisTop} V${Y(H - hbR) + 3 * u}`,
  ].join(' ');
  ext.add({ x1: X(0), y1: axisTop, x2: X(0), y2: Y(-hbL) + 3 * u });

  const tb = titleBlock(
    stairTitle(input),
    `รูปตัดบันได   t = ${cmToM(t)}   SCALE 1:${denom}`,
    ext.y2 + 5 * u,
    TEXT_MM.title * u,
    TEXT_MM.sub * u,
    4 * u,
  );
  addTitleExtent(ext, tb, u);

  const view = ext.box(2 * u);
  return {
    denom, u, sizes,
    outline: toPath(outline, true),
    axes,
    bars: bars.map((b) => ({ key: b.key, path: toPath(b.pts), width: b.width })),
    dots: dots.map((d) => ({ ...d, x: X(d.x), y: Y(d.y) })),
    levels,
    leaders,
    dims,
    extensions,
    titleBlock: tb,
    view,
    sizeMm: sizeMm(view, denom),
  };
}

const fits = (s: { w: number; h: number }, box: { w: number; h: number }) => s.w <= box.w && s.h <= box.h;

/** มาตราส่วนใหญ่ที่สุดที่รูปตัดยังพอดีกรอบ */
export function pickStairScale(input: StairInput, a: StairAnalysis, layout: StairLayout, box = STAIR_BOX): number {
  return (
    STAIR_SCALES.find((d) => fits(buildStairModel(input, a, layout, d).sizeMm, box)) ??
    STAIR_SCALES[STAIR_SCALES.length - 1]
  );
}

/** ข้อความสรุปเหล็กหนึ่งชุด ใช้ในการ์ดสรุปผลและหน้ารายงาน */
export const stairRunText = (layout: StairLayout, key: StairBarKey) => {
  const run = layout[key];
  return run ? runText(run) : '—';
};
