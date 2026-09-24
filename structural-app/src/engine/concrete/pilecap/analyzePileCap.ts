import { ACI318_WSD as C, ACI318_WSD_FOOTING as KF, ACI318_WSD_PILECAP as K } from '../codes/aci318Wsd';
import { wsdParams, type WsdParams } from '../design/flexure';
import { worstStatus } from '../design/sectionCheck';
import { asMinRatio, developmentLengths, type Anchorage, type SidePair } from '../footing/analyzeFooting';
import { footingGeometry, type ColumnLocation, type FootingGeometry } from '../footing/geometry';
import type { Pt } from '../footing/polygon';
import { punchingPerimeter, type PunchingPerimeter } from '../footing/punching';
import type { BarDir, FootingLayout } from '../footing/types';
import { fmt } from '../format';
import { REBARS, type BarName } from '../rebar';
import type { CalcStep, CheckItem, CheckStatus } from '../types';
import { outsideDistance, outsideShare, pileLayout, pileReactions, type PileLayout, type PileReactions } from './piles';
import type { PileArrangement, PileCapDims, PileCapInput } from './types';

export const DIR_TH: Record<BarDir, string> = { x: 'ทิศ X', y: 'ทิศ Y' };

export interface PileCapLoads {
  dims: PileCapDims;
  piles: PileLayout;
  loc: ColumnLocation;
  /** น้ำหนักฐานรากและดินถม (kg) */
  W: number;
  /** แรงในเข็มจากแรงใช้งานทั้งหมด (P + W) — ตรวจกำลังเข็ม */
  service: PileReactions;
  /** แรงในเข็มจาก P, M เท่านั้น — ออกแบบโครงสร้างฐานราก (น้ำหนักฐานรากถ่ายลงเข็มโดยตรง) */
  structural: PileReactions;
}

/** ขนาดเทียบเท่าของเข็ม (ด้านสี่เหลี่ยมพื้นที่เท่ากัน) สำหรับหน้าตัดวิกฤตเฉือนทะลุ */
export const pileSquareSide = (input: Pick<PileCapInput, 'pileShape' | 'pileSize'>) =>
  input.pileShape === 'circle' ? input.pileSize * Math.sqrt(Math.PI / 4) : input.pileSize;

export function pileCapLoads(input: PileCapInput, arrangement: PileArrangement, t: number): PileCapLoads {
  const piles = pileLayout(input, arrangement);
  const dims = { ...piles.dims, t };
  const { x: xc, y: yc } = piles.column;
  const faces = { left: xc - input.cx / 2, right: xc + input.cx / 2, bottom: yc - input.cy / 2, top: yc + input.cy / 2 };
  const loc: ColumnLocation = {
    xc,
    yc,
    faces,
    overhang: { left: faces.left + dims.B / 2, right: dims.B / 2 - faces.right, bottom: faces.bottom + dims.L / 2, top: dims.L / 2 - faces.top },
  };
  const soilDepth = Math.max(0, input.Df * 100 - t);
  const W = (dims.B * dims.L * (t * K.concreteUnitWeight + soilDepth * input.gammaSoil)) / 1000;
  const P = Math.max(0, input.P);
  const column = { F: P, x: xc, y: yc };
  const Mx = input.Mx * 100;
  const My = input.My * 100;
  return {
    dims,
    piles,
    loc,
    W,
    service: pileReactions(piles.actual, [column, { F: W, x: 0, y: 0 }], Mx, My),
    structural: pileReactions(piles.actual, [column], Mx, My),
  };
}

const coord = (p: Pt, dir: BarDir) => (dir === 'x' ? p.x : p.y);
const faceNeg = (loc: ColumnLocation, dir: BarDir) => (dir === 'x' ? loc.faces.left : loc.faces.bottom);
const facePos = (loc: ColumnLocation, dir: BarDir) => (dir === 'x' ? loc.faces.right : loc.faces.top);
export const capWidth = (dims: Pick<PileCapDims, 'B' | 'L'>, dir: BarDir) => (dir === 'x' ? dims.L : dims.B);
export const capSpan = (dims: Pick<PileCapDims, 'B' | 'L'>, dir: BarDir) => (dir === 'x' ? dims.B : dims.L);

/** โมเมนต์ที่ผิวเสาจากแรงเข็มที่ศูนย์อยู่นอกผิวเสา — บวก = ผิวล่างรับแรงดึง (kg·cm) */
export function faceMoments(loads: PileCapLoads, dir: BarDir): SidePair {
  const fn = faceNeg(loads.loc, dir);
  const fp = facePos(loads.loc, dir);
  let neg = 0;
  let pos = 0;
  loads.piles.actual.forEach((p, i) => {
    const s = coord(p, dir);
    const R = loads.structural.R[i];
    if (s < fn) neg += R * (fn - s);
    if (s > fp) pos += R * (s - fp);
  });
  return { neg, pos };
}

/** แรงเฉือนแบบคานที่ระยะ d จากผิวเสา — เข็มคร่อมหน้าตัดคิดตามสัดส่วน (kg) */
export function oneWayShears(loads: PileCapLoads, dir: BarDir, d: number, pileSize: number): SidePair {
  const sn = faceNeg(loads.loc, dir) - d;
  const sp = facePos(loads.loc, dir) + d;
  let neg = 0;
  let pos = 0;
  loads.piles.actual.forEach((p, i) => {
    const s = coord(p, dir);
    const R = loads.structural.R[i];
    neg += R * outsideShare(sn - s, pileSize);
    pos += R * outsideShare(s - sp, pileSize);
  });
  return { neg, pos };
}

export interface DirectionDemand {
  M: SidePair;
  Mdesign: number;
  Mc: number;
  AsFlex: number;
  AsMin: number;
  AsReq: number;
}

export function directionDemand(input: PileCapInput, loads: PileCapLoads, dir: BarDir, d: number, p: WsdParams, M = faceMoments(loads, dir)): DirectionDemand {
  const width = capWidth(loads.dims, dir);
  const Mdesign = Math.max(0, M.neg, M.pos);
  const AsFlex = d > 0 ? Mdesign / (p.fsAllow * p.j * d) : Infinity;
  const AsMin = asMinRatio(input.fy) * width * loads.dims.t;
  return { M, Mdesign, Mc: p.R * width * d * d, AsFlex, AsMin, AsReq: Math.max(AsFlex, AsMin) };
}

/** ระยะจากผิวเสาด้านที่โมเมนต์สูงสุดถึงปลายเหล็ก — null เมื่อไม่มีโมเมนต์ */
export function anchorageAvailable(loads: PileCapLoads, dir: BarDir, M: SidePair, cover: number): number | null {
  const Mdesign = Math.max(0, M.neg, M.pos);
  if (Mdesign <= 0) return null;
  const ov = dir === 'x' ? { neg: loads.loc.overhang.left, pos: loads.loc.overhang.right } : { neg: loads.loc.overhang.bottom, pos: loads.loc.overhang.top };
  const sides = (['neg', 'pos'] as const).filter((side) => M[side] >= Mdesign * (1 - 1e-6));
  return Math.min(...sides.map((side) => ov[side] - cover));
}

export interface TopTension {
  M: number;
  AsTop: number;
}

export interface PileCapDirection extends DirectionDemand {
  dir: BarDir;
  size: BarName;
  count: number;
  isBottom: boolean;
  db: number;
  d: number;
  width: number;
  AsProv: number;
  pitch: number;
  clear: number;
  clearReq: number;
  sMax: number;
  /** ไม่มีข้อกำหนดแถบกลางสำหรับฐานรากเสาเข็ม (ให้เข้ากับ popover แก้เหล็กของฐานรากแผ่) */
  band: null;
  bandAsReq: number;
  bandAsProv: null;
  V: SidePair;
  v: number;
  vc: number;
  top: TopTension | null;
  anchorage: Anchorage | null;
}

export interface ColumnPunching extends PunchingPerimeter {
  V: number;
  Mux: number;
  Muy: number;
  betaC: number;
  vV: number;
  vM: number;
  v: number;
  vc: number;
}

export interface PilePunching extends PunchingPerimeter {
  pile: number;
  V: number;
  v: number;
  vc: number;
}

export interface BearingCheck {
  A1: number;
  sqrtRatio: number;
  f: number;
  fAllow: number;
  dowelAs: number;
}

export interface PileCheck {
  Rmax: number;
  Rmin: number;
  Pa: number;
  Ta: number;
  /** ระยะห่างเข็มจริงน้อยสุด (ศูนย์ถึงศูนย์) */
  minSpacing: number | null;
  /** ระยะผิวเข็มถึงขอบฐานรากน้อยสุด */
  minEdgeClear: number;
  /** ระยะเยื้องเข็มมากสุด */
  maxOffset: number;
}

export interface PileCapAnalysis {
  dims: PileCapDims;
  loads: PileCapLoads;
  geom: FootingGeometry;
  params: WsdParams;
  pile: PileCheck;
  x: PileCapDirection;
  y: PileCapDirection;
  punching: ColumnPunching | null;
  pilePunching: PilePunching | null;
  bearing: BearingCheck;
  checks: CheckItem[];
  steps: CalcStep[];
  status: CheckStatus;
}

const punchingVc = (fc: number, betaC: number, alphaS: number, d: number, b0: number) =>
  Math.sqrt(fc) * Math.min(KF.punchingVcMax, KF.punchingVcBase * (1 + 2 / betaC), KF.punchingVcBase * ((alphaS * d) / b0 + 2));

/** เฉือนทะลุรอบเสา: แรงเข็มนอกหน้าตัดวิกฤต + โมเมนต์ถ่ายเท γv·M·c/J */
export function analyzeColumnPunching(input: PileCapInput, loads: PileCapLoads, d: number): ColumnPunching | null {
  const per = punchingPerimeter(loads.loc, loads.dims, d);
  if (per.b0 <= 0) return null;
  const P = Math.max(0, input.P);
  let V = 0;
  let insideX = 0;
  let insideY = 0;
  loads.piles.actual.forEach((p, i) => {
    const R = loads.structural.R[i];
    const share = outsideShare(outsideDistance(p, per.x1, per.x2, per.y1, per.y2), input.pileSize);
    V += R * share;
    insideX += R * (1 - share) * (p.x - per.xg);
    insideY += R * (1 - share) * (p.y - per.yg);
  });
  V = Math.max(0, V);
  const Mux = input.My * 100 + P * (loads.loc.xc - per.xg) - insideX;
  const Muy = input.Mx * 100 + P * (loads.loc.yc - per.yg) - insideY;
  const betaC = Math.max(input.cx, input.cy) / Math.min(input.cx, input.cy);
  const vV = V / (per.b0 * d);
  const vM = (per.Jx > 0 ? (per.gammaX * Math.abs(Mux) * per.cX) / per.Jx : 0) + (per.Jy > 0 ? (per.gammaY * Math.abs(Muy) * per.cY) / per.Jy : 0);
  return { ...per, V, Mux, Muy, betaC, vV, vM, v: vV + vM, vc: punchingVc(input.fc, betaC, per.alphaS, d, per.b0) };
}

/** เฉือนทะลุรอบเข็มแต่ละต้น (เข็มมุม/ขอบ หน้าตัดถูกตัดด้วยขอบฐาน) — ข้ามต้นที่หน้าตัดวิกฤตซ้อนกับของเสา; คืนต้นที่ v/vc สูงสุด */
export function analyzePilePunching(input: PileCapInput, loads: PileCapLoads, d: number): PilePunching | null {
  const side = pileSquareSide(input);
  const h = d / 2;
  const col = loads.loc.faces;
  let worst: PilePunching | null = null;
  loads.piles.actual.forEach((p, i) => {
    const R = loads.structural.R[i];
    if (R <= 0) return;
    const overlapsColumn =
      p.x - side / 2 - h < col.right + h && p.x + side / 2 + h > col.left - h && p.y - side / 2 - h < col.top + h && p.y + side / 2 + h > col.bottom - h;
    if (overlapsColumn) return;
    const loc: ColumnLocation = {
      xc: p.x,
      yc: p.y,
      faces: { left: p.x - side / 2, right: p.x + side / 2, bottom: p.y - side / 2, top: p.y + side / 2 },
      overhang: { left: 0, right: 0, bottom: 0, top: 0 },
    };
    const per = punchingPerimeter(loc, loads.dims, d);
    if (per.b0 <= 0) return;
    const v = R / (per.b0 * d);
    const vc = punchingVc(input.fc, 1, per.alphaS, d, per.b0);
    if (!worst || v / vc > worst.v / worst.vc) worst = { ...per, pile: i, V: R, v, vc };
  });
  return worst;
}

function analyzeBearing(input: PileCapInput, loads: PileCapLoads, p: WsdParams): BearingCheck {
  const ov = loads.loc.overhang;
  const lim = 2 * loads.dims.t;
  const kx = 1 + (2 * Math.max(0, Math.min(ov.left, ov.right, lim))) / input.cx;
  const ky = 1 + (2 * Math.max(0, Math.min(ov.bottom, ov.top, lim))) / input.cy;
  const sqrtRatio = Math.min(kx, ky, KF.bearingSqrtMax);
  const A1 = input.cx * input.cy;
  const P = Math.max(0, input.P);
  const fAllow = KF.bearingRatio * input.fc * sqrtRatio;
  return { A1, sqrtRatio, f: P / A1, fAllow, dowelAs: Math.max(0, P - fAllow * A1) / p.fsAllow };
}

function analyzeDirection(input: PileCapInput, loads: PileCapLoads, geom: FootingGeometry, layout: FootingLayout, dir: BarDir, p: WsdParams): PileCapDirection {
  const { dims } = loads;
  const bars = layout[dir];
  const d = geom.d[dir];
  const db = geom.db[dir];
  const width = capWidth(dims, dir);
  const demand = directionDemand(input, loads, dir, d, p);
  const count = Math.max(1, Math.round(bars.count));
  const pitch = count > 1 ? (width - 2 * input.cover - db) / (count - 1) : Infinity;
  const V = oneWayShears(loads, dir, d, input.pileSize);
  const Mneg = Math.min(0, demand.M.neg, demand.M.pos);
  const AsProv = count * REBARS[bars.size].area;
  const available = anchorageAvailable(loads, dir, demand.M, input.cover);
  let anchorage: Anchorage | null = null;
  if (available !== null) {
    const { ld, ldh } = developmentLengths(bars.size, input.fc, input.fy, demand.AsFlex / AsProv);
    const hook = available < ld;
    anchorage = { available, ld, ldh, hook, ok: available >= (hook ? ldh : ld) - 1e-9 };
  }
  return {
    ...demand,
    dir,
    size: bars.size,
    count,
    isBottom: layout.bottom === dir,
    db,
    d,
    width,
    AsProv,
    pitch,
    clear: pitch - db,
    clearReq: Math.max(db, C.minClearSpacing),
    sMax: Math.min(KF.maxSpacingFactor * dims.t, KF.maxSpacing),
    band: null,
    bandAsReq: 0,
    bandAsProv: null,
    V,
    v: Math.max(0, V.neg, V.pos) / (width * d),
    vc: KF.oneWayVcCoef * Math.sqrt(input.fc),
    top: Mneg < -1 ? { M: -Mneg, AsTop: -Mneg / (p.fsAllow * p.j * (dims.t - input.cover)) } : null,
    anchorage,
  };
}

function pileGeometryCheck(input: PileCapInput, loads: PileCapLoads): PileCheck {
  const { actual, nominal } = loads.piles;
  const { B, L } = loads.dims;
  const R = loads.service.R;
  let minSpacing: number | null = null;
  for (let i = 0; i < actual.length; i++) {
    for (let j = i + 1; j < actual.length; j++) {
      const s = Math.hypot(actual[i].x - actual[j].x, actual[i].y - actual[j].y);
      minSpacing = minSpacing === null ? s : Math.min(minSpacing, s);
    }
  }
  const half = input.pileSize / 2;
  return {
    Rmax: Math.max(...R),
    Rmin: Math.min(...R),
    Pa: input.pileCapacity * 1000,
    Ta: input.pileTension * 1000,
    minSpacing,
    minEdgeClear: Math.min(...actual.map((p) => Math.min(p.x + B / 2, B / 2 - p.x, p.y + L / 2, L / 2 - p.y) - half)),
    maxOffset: Math.max(0, ...actual.map((p, i) => Math.hypot(p.x - nominal[i].x, p.y - nominal[i].y))),
  };
}

const ton = (kg: number) => fmt(kg / 1000, 2);
const tm = (kgcm: number) => fmt(kgcm / 1e5, 2);
const meter = (cm: number) => fmt(cm / 100, 2);

export function analyzePileCap(input: PileCapInput, arrangement: PileArrangement, t: number, layout: FootingLayout): PileCapAnalysis {
  const loads = pileCapLoads(input, arrangement, t);
  const { dims } = loads;
  const geom = footingGeometry(input.cover, dims, layout);
  const params = wsdParams(input.fc, input.fy, input.fy);
  const pile = pileGeometryCheck(input, loads);
  const x = analyzeDirection(input, loads, geom, layout, 'x', params);
  const y = analyzeDirection(input, loads, geom, layout, 'y', params);
  const punching = analyzeColumnPunching(input, loads, geom.dAvg);
  const pilePunching = analyzePilePunching(input, loads, geom.dAvg);
  const bearing = analyzeBearing(input, loads, params);
  const { service } = loads;
  const n = arrangement.count;

  // ---------- ตรวจสอบ ----------
  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, provided: string, status: CheckStatus) =>
    checks.push({ id: `P-${checks.length}`, group, label, required, provided, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);

  if (service.unresisted > K.unresistedTolerance) {
    push('pile', n === 1 ? 'เข็มต้นเดียวรับโมเมนต์ (t·m)' : 'โมเมนต์ตั้งฉากแนวเข็มแถวเดียว (t·m)', '0 — ต้องมีคานยึด', tm(service.unresisted), 'fail');
  }
  push('pile', 'แรงในเสาเข็มสูงสุด Rmax (ตัน/ต้น)', `≤ ${fmt(input.pileCapacity, 2)}`, ton(pile.Rmax), okIf(pile.Rmax <= pile.Pa * (1 + 1e-6)));
  push('pile', 'แรงในเสาเข็มต่ำสุด Rmin (ตัน/ต้น)', pile.Ta > 0 ? `≥ −${fmt(input.pileTension, 2)}` : '≥ 0 (ไม่มีแรงถอน)', ton(pile.Rmin),
    okIf(pile.Rmin >= -pile.Ta - 1e-6 * Math.max(1, pile.Pa)));
  if (pile.minSpacing !== null) {
    const req = K.pileSpacingFactor * input.pileSize;
    push('pile', 'ระยะห่างเสาเข็มจริง (ซม.)', `≥ ${fmt(req, 0)} (${K.pileSpacingFactor}D)`, fmt(pile.minSpacing, 1), okIf(pile.minSpacing >= req - 1e-6, 'warn'));
  }
  push('pile', 'ระยะผิวเข็มถึงขอบฐานราก (ซม.)', `≥ ${fmt(K.pileEdgeClear, 0)}`, fmt(pile.minEdgeClear, 1), okIf(pile.minEdgeClear >= K.pileEdgeClear - 1e-6, 'warn'));

  for (const r of [x, y]) {
    push('flexure', `M ${DIR_TH[r.dir]} ≤ R·b·d² (t·m)`, `≤ ${tm(r.Mc)}`, tm(r.Mdesign), okIf(r.Mdesign <= r.Mc * (1 + 1e-6)));
    push('flexure', `As ${DIR_TH[r.dir]} (ซม.²)`, `≥ ${fmt(r.AsReq)}`, fmt(r.AsProv), okIf(r.AsProv >= r.AsReq * (1 - 1e-6)));
    if (r.top) push('flexure', `ผิวบน ${DIR_TH[r.dir]} (เข็มรับแรงถอน) As บน (ซม.²)`, `≥ ${fmt(r.top.AsTop)}`, 'เสริมเหล็กบน', 'warn');
  }
  for (const r of [x, y]) {
    push('oneWay', `v ${DIR_TH[r.dir]} ที่ระยะ d จากผิวเสา (ksc)`, `≤ ${fmt(r.vc)}`, fmt(r.v), okIf(r.v <= r.vc * (1 + 1e-6)));
  }
  if (punching) {
    push('punching', `รอบเสา v = V/b0d + γv·M·c/J (ksc)`, `≤ ${fmt(punching.vc)}`, fmt(punching.v), okIf(punching.v <= punching.vc * (1 + 1e-6)));
  }
  if (pilePunching) {
    push('punching', `รอบเข็มต้นที่ ${pilePunching.pile + 1} (${pilePunching.nSides} ด้าน) (ksc)`, `≤ ${fmt(pilePunching.vc)}`, fmt(pilePunching.v),
      okIf(pilePunching.v <= pilePunching.vc * (1 + 1e-6)));
  }

  const dMin = Math.min(geom.d.x, geom.d.y);
  push('detail', 'ความลึกเหนือเหล็กล่าง d (ซม.)', `≥ ${fmt(K.minDepthAboveSteel, 0)}`, fmt(dMin, 1), okIf(dMin >= K.minDepthAboveSteel - 1e-9));
  for (const r of [x, y]) {
    push('detail', `ช่องว่างเหล็ก${DIR_TH[r.dir]} (ซม.)`, `≥ ${fmt(r.clearReq, 1)}`, fmt(r.clear, 1), okIf(r.clear >= r.clearReq - 1e-9));
    push('detail', `ระยะเรียงเหล็ก${DIR_TH[r.dir]} (ซม.)`, `≤ ${fmt(r.sMax, 1)}`, fmt(r.pitch, 1), okIf(r.pitch <= r.sMax + 1e-9));
  }
  for (const r of [x, y]) {
    const a = r.anchorage;
    if (!a) continue;
    push('anchorage', `ระยะฝังเหล็ก${DIR_TH[r.dir]} จากผิวเสา (ซม.)`, a.hook ? `งอขอ ≥ ${fmt(a.ldh, 1)}` : `≥ ${fmt(a.ld, 1)}`,
      `${fmt(a.available, 1)}${a.hook ? ' (งอขอ)' : ''}`, okIf(a.ok));
  }
  push('bearing', 'หน่วยแรงแบกทาน P/A1 (ksc)', `≤ ${fmt(bearing.fAllow, 1)}`, fmt(bearing.f, 1), okIf(bearing.f <= bearing.fAllow * (1 + 1e-6), 'warn'));

  // ---------- ขั้นตอนคำนวณ ----------
  const col = loads.piles.column;
  const gc = loads.piles.groupCenter;
  const steps: CalcStep[] = [
    { label: 'W', formula: `Bx·By·(${K.concreteUnitWeight}t + γs(Df − t))`, value: `${ton(loads.W)} ตัน`, print: true },
    { label: 'N', formula: 'P + W', value: `${ton(service.N)} ตัน`, print: true },
    {
      label: 'เยื้องศูนย์เสา',
      formula: 'ศูนย์เสา − ศูนย์ถ่วงกลุ่มเข็มจริง',
      value: `${meter(col.x - service.xg)}, ${meter(col.y - service.yg)} ม.`,
      print: true,
    },
    {
      label: 'My, Mx รวม',
      formula: 'M + ΣF·(ตำแหน่งแรง − ศูนย์ถ่วงกลุ่มเข็ม)',
      value: `${tm(service.MyG)}, ${tm(service.MxG)} t·m`,
      print: true,
    },
    {
      label: 'Σx², Σy², Σxy',
      formula: `รอบศูนย์ถ่วงกลุ่มเข็มจริง (${fmt(service.xg - gc.x, 1)}, ${fmt(service.yg - gc.y, 1)} ซม. จากตามแบบ)`,
      value: `${fmt(service.Ixx / 1e4, 3)}, ${fmt(service.Iyy / 1e4, 3)}, ${fmt(service.Ixy / 1e4, 3)} ม.²`,
    },
    {
      label: 'R',
      formula: service.Ixy !== 0 && Math.abs(service.Ixy) > 1e-6 ? 'N/n + a·x + b·y (รวม Σxy)' : 'N/n ± My·x/Σx² ± Mx·y/Σy²',
      value: `${ton(pile.Rmax)} / ${ton(pile.Rmin)} ตัน (max/min)`,
      print: true,
    },
    { label: 'n, k, j, R', formula: 'fc = 0.45f′c, fs = 0.5fy ≤ 1,700', value: `${params.n}, ${fmt(params.k, 3)}, ${fmt(params.j, 3)}, ${fmt(params.R, 2)}`, print: true },
    { label: 'd (X, Y)', formula: `ชั้นล่าง${DIR_TH[layout.bottom]}`, value: `${fmt(geom.d.x, 1)}, ${fmt(geom.d.y, 1)} ซม.`, print: true },
  ];
  for (const r of [x, y]) {
    const T = DIR_TH[r.dir];
    steps.push(
      { label: `M ${T}`, formula: `ΣR·(ระยะเข็มถึงผิวเสา), b = ${meter(r.width)} ม.`, value: `${tm(r.Mdesign)} t·m`, print: true },
      { label: `As ${T}`, formula: `max(M/(fs·j·d), ${fmt(asMinRatio(input.fy), 4)}·b·t)`, value: `${fmt(r.AsReq)} → ${r.count}-${r.size} = ${fmt(r.AsProv)} ซม.²`, print: true },
      { label: `V ${T}`, formula: 'ΣR นอกหน้าตัดที่ระยะ d (เข็มคร่อมคิดตามสัดส่วน)', value: `${ton(Math.max(0, r.V.neg, r.V.pos))} ตัน, v = ${fmt(r.v)} ksc`, print: true },
    );
    if (r.top) steps.push({ label: `ผิวบน ${T}`, formula: 'โมเมนต์ลบจากเข็มรับแรงถอน', value: `As บน ≥ ${fmt(r.top.AsTop)} ซม.²` });
  }
  if (punching) {
    steps.push(
      { label: 'b0 เสา', formula: `${punching.nSides} ด้าน ห่างผิวเสา d/2, d = ${fmt(geom.dAvg, 1)}`, value: `${fmt(punching.b0, 1)} ซม.` },
      { label: 'V ทะลุเสา', formula: 'ΣR เข็มนอกหน้าตัดวิกฤต', value: `${ton(punching.V)} ตัน`, print: true },
      { label: 'M ถ่ายเท', formula: 'รอบศูนย์หน้าตัดวิกฤต (x, y)', value: `${tm(punching.Mux)}, ${tm(punching.Muy)} t·m` },
      { label: 'vc ทะลุ', formula: `√f′c·min(0.53, 0.265(1+2/βc), 0.265(αs·d/b0+2)), αs = ${punching.alphaS}`, value: `${fmt(punching.vc)} ksc`, print: true },
    );
  }
  if (pilePunching) {
    steps.push({
      label: 'ทะลุรอบเข็ม',
      formula: `เข็มต้นที่ ${pilePunching.pile + 1}: R/(b0·d), b0 = ${fmt(pilePunching.b0, 1)} ซม.`,
      value: `${fmt(pilePunching.v)} / ${fmt(pilePunching.vc)} ksc`,
      print: true,
    });
  }
  const anch = [x, y].filter((r) => r.anchorage);
  if (anch.length > 0) {
    steps.push({
      label: 'ld, ldh',
      formula: '0.06Ab·fy/√f′c, 318db/√f′c·fy/4,200 × As ต้องการ/As ใส่',
      value: anch.map((r) => `${r.size}: ${fmt(r.anchorage!.ld, 0)}, ${fmt(r.anchorage!.ldh, 0)}`).join(' / ') + ' ซม.',
    });
  }
  steps.push({ label: 'fb ยอมให้', formula: `0.3f′c·√(A2/A1), √ = ${fmt(bearing.sqrtRatio, 2)}`, value: `${fmt(bearing.fAllow, 1)} ksc` });
  if (bearing.dowelAs > 0) {
    steps.push({ label: 'เหล็กเดือย', formula: '(P − fb·A1)/fs — ถ่ายแรงแบกทานส่วนเกิน', value: `As ≥ ${fmt(bearing.dowelAs)} ซม.²`, print: true });
  }

  return { dims, loads, geom, params, pile, x, y, punching, pilePunching, bearing, checks, steps, status: worstStatus(checks) };
}

