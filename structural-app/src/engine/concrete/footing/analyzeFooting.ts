import { ACI318_WSD as C, ACI318_WSD_FOOTING as K } from '../codes/aci318Wsd';
import { wsdParams, type WsdParams } from '../design/flexure';
import { worstStatus } from '../design/sectionCheck';
import { fmt } from '../format';
import { REBARS, type BarName } from '../rebar';
import type { CalcStep, CheckItem, CheckStatus } from '../types';
import { columnLocation, footingGeometry, spanOf, widthOf, type ColumnLocation, type FootingGeometry } from './geometry';
import { integrateNet, solvePressure, type SoilPressure } from './pressure';
import { punchingPerimeter, type PunchingPerimeter } from './punching';
import type { BarDir, FootingDims, FootingInput, FootingLayout } from './types';

export const DIR_TH: Record<BarDir, string> = { x: 'ทิศ X', y: 'ทิศ Y' };

export interface FootingLoads {
  dims: FootingDims;
  loc: ColumnLocation;
  /** น้ำหนักฐานรากและดินถมต่อพื้นที่ (ksc) */
  w: number;
  /** น้ำหนักฐานรากและดินถม (kg) */
  W: number;
  N: number;
  /** ระยะเยื้องศูนย์ของแรงลัพธ์จากศูนย์ถ่วงฐานราก (ซม.) */
  ex: number;
  ey: number;
  pressure: SoilPressure;
}

export function footingLoads(input: FootingInput, dims: FootingDims): FootingLoads {
  const loc = columnLocation(input, dims);
  const soilDepth = Math.max(0, input.Df * 100 - dims.t);
  // t/m³ → kg/cm³ คูณ 0.001
  const w = (dims.t * K.concreteUnitWeight + soilDepth * input.gammaSoil) / 1000;
  const W = w * dims.B * dims.L;
  const P = Math.max(0, input.P);
  const N = P + W;
  const ex = (P * loc.xc + input.My * 100) / N;
  const ey = (P * loc.yc + input.Mx * 100) / N;
  return { dims, loc, w, W, N, ex, ey, pressure: solvePressure(dims.B, dims.L, N, ex, ey) };
}

/** ค่าด้านลบ (ซ้าย/ล่าง) และด้านบวก (ขวา/บน) ของทิศนั้น */
export interface SidePair {
  neg: number;
  pos: number;
}

/** แรงสุทธิ ∫(q − w) และโมเมนต์อันดับหนึ่งตามแกนของทิศ บนแถบ a ≤ s ≤ b เต็มความกว้างฐาน */
function strip(loads: FootingLoads, dir: BarDir, a: number, b: number) {
  const { B, L } = loads.dims;
  const { pressure, w } = loads;
  if (dir === 'x') {
    const r = integrateNet(pressure, w, a, b, -L / 2, L / 2);
    return { F: r.F, S: r.Sx };
  }
  const r = integrateNet(pressure, w, -B / 2, B / 2, a, b);
  return { F: r.F, S: r.Sy };
}

const faceNeg = (loc: ColumnLocation, dir: BarDir) => (dir === 'x' ? loc.faces.left : loc.faces.bottom);
const facePos = (loc: ColumnLocation, dir: BarDir) => (dir === 'x' ? loc.faces.right : loc.faces.top);
const overhangs = (loc: ColumnLocation, dir: BarDir): SidePair =>
  dir === 'x' ? { neg: loc.overhang.left, pos: loc.overhang.right } : { neg: loc.overhang.bottom, pos: loc.overhang.top };

/** โมเมนต์ที่ผิวเสาด้านซ้าย/ขวา (หรือล่าง/บน) — บวก = ผิวล่างรับแรงดึง (kg·cm) */
export function faceMoments(loads: FootingLoads, dir: BarDir): SidePair {
  const half = spanOf(loads.dims, dir) / 2;
  const fn = faceNeg(loads.loc, dir);
  const fp = facePos(loads.loc, dir);
  let neg = 0;
  let pos = 0;
  if (fn > -half + 1e-9) {
    const s = strip(loads, dir, -half, fn);
    neg = fn * s.F - s.S;
  }
  if (fp < half - 1e-9) {
    const s = strip(loads, dir, fp, half);
    pos = s.S - fp * s.F;
  }
  return { neg, pos };
}

/** แรงเฉือนแบบคานที่ระยะ d จากผิวเสา (kg) */
export function oneWayShears(loads: FootingLoads, dir: BarDir, d: number): SidePair {
  const half = spanOf(loads.dims, dir) / 2;
  const sn = faceNeg(loads.loc, dir) - d;
  const sp = facePos(loads.loc, dir) + d;
  return {
    neg: sn > -half + 1e-9 ? strip(loads, dir, -half, sn).F : 0,
    pos: sp < half - 1e-9 ? strip(loads, dir, sp, half).F : 0,
  };
}

export function asMinRatio(fy: number): number {
  if (fy <= K.plainBarFyMax) return K.rhoTempPlain;
  return fy < K.rhoTempRefFy ? K.rhoTempLowFy : Math.max(K.rhoTempMin, (K.rhoTemp * K.rhoTempRefFy) / fy);
}

export interface BandRequirement {
  /** ด้านยาว / ด้านสั้น */
  beta: number;
  ratio: number;
  lo: number;
  hi: number;
}

/**
 * เหล็กทิศสั้นของฐานสี่เหลี่ยมผืนผ้า: สัดส่วน 2/(β+1) ต้องอยู่ในแถบกว้างเท่าด้านสั้น ศูนย์ที่เสา (15.4.4)
 * แถบถูกเลื่อนให้อยู่ภายในฐานรากเมื่อเสาชิดขอบ
 */
export function bandFor(loads: FootingLoads, dir: BarDir): BandRequirement | null {
  const span = spanOf(loads.dims, dir);
  const width = widthOf(loads.dims, dir);
  if (width <= span * (1 + 1e-6)) return null;
  const beta = width / span;
  const center = dir === 'x' ? loads.loc.yc : loads.loc.xc;
  const lo = Math.min(Math.max(center - span / 2, -width / 2), width / 2 - span);
  return { beta, ratio: 2 / (beta + 1), lo, hi: lo + span };
}

export const countInBand = (positions: number[], band: BandRequirement) =>
  positions.filter((p) => p >= band.lo - 1e-6 && p <= band.hi + 1e-6).length;

export interface DirectionDemand {
  M: SidePair;
  /** โมเมนต์ออกแบบ (kg·cm) */
  Mdesign: number;
  Mc: number;
  AsFlex: number;
  AsMin: number;
  AsReq: number;
  band: BandRequirement | null;
  bandAsReq: number;
}

export function directionDemand(
  input: FootingInput,
  loads: FootingLoads,
  dir: BarDir,
  d: number,
  p: WsdParams,
  M: SidePair = faceMoments(loads, dir),
): DirectionDemand {
  const width = widthOf(loads.dims, dir);
  const Mdesign = Math.max(0, M.neg, M.pos);
  const AsFlex = d > 0 ? Mdesign / (p.fsAllow * p.j * d) : Infinity;
  const AsMin = asMinRatio(input.fy) * width * loads.dims.t;
  const AsReq = Math.max(AsFlex, AsMin);
  const band = bandFor(loads, dir);
  return { M, Mdesign, Mc: p.R * width * d * d, AsFlex, AsMin, AsReq, band, bandAsReq: band ? AsReq * band.ratio : 0 };
}

/** หน่วยแรงยึดเหนี่ยวยอมให้ของเหล็กล่าง (ksc) ตามมาตรฐาน วสท. */
export function allowableBond(size: BarName, fc: number): number {
  const { dia, kind } = REBARS[size];
  const u = Math.min((K.bondCoef * Math.sqrt(fc)) / dia, K.bondMax);
  return kind === 'RB' ? Math.min(u * K.bondPlainFactor, K.bondPlainMax) : u;
}

/**
 * ระยะฝังเหล็กตรง ld = fs·db/(4u) ตาม วสท. และงอขอ ldh ตาม ACI 12.5
 * excess = As ต้องการ/As ที่ใส่ — หน่วยแรงในเหล็กจริงต่ำกว่าค่ายอมให้ตามสัดส่วนนี้
 */
export function developmentLengths(size: BarName, fc: number, fy: number, excess = 1) {
  const { dia } = REBARS[size];
  const sq = Math.sqrt(fc);
  const r = Math.min(1, Math.max(0, excess));
  const fs = Math.min(C.fsRatio * fy, C.fsMax) * r;
  return {
    ld: Math.max((fs * dia) / (4 * allowableBond(size, fc)), K.ldMin),
    ldh: Math.max(((K.ldhCoef * dia) / sq) * (fy / K.ldhFyRef) * r, K.ldhDbMin * dia, K.ldhMin),
  };
}

/**
 * ระยะจากผิวเสาด้านที่โมเมนต์สูงสุดถึงปลายเหล็ก (15.6) — null เมื่อไม่มีโมเมนต์
 * ส่วนยื่นไม่เกิน d ถ่ายแรงเข้าเสาโดยตรง (หน้าตัดเฉือนที่ระยะ d อยู่นอกฐาน) จึงไม่ตรวจ
 */
export function anchorageAvailable(loads: FootingLoads, dir: BarDir, M: SidePair, cover: number, d: number): number | null {
  const Mdesign = Math.max(0, M.neg, M.pos);
  const ov = overhangs(loads.loc, dir);
  const governing = (['neg', 'pos'] as const).filter((side) => Mdesign > 0 && M[side] >= Mdesign * (1 - 1e-6) && ov[side] > d);
  return governing.length > 0 ? Math.min(...governing.map((side) => ov[side] - cover)) : null;
}

export interface Anchorage {
  available: number;
  ld: number;
  ldh: number;
  hook: boolean;
  ok: boolean;
}

export interface TopTension {
  M: number;
  ft: number;
  ftAllow: number;
  AsTop: number;
}

export interface FootingDirection extends DirectionDemand {
  dir: BarDir;
  size: BarName;
  count: number;
  isBottom: boolean;
  db: number;
  d: number;
  width: number;
  AsProv: number;
  /** ระยะเรียงศูนย์ถึงศูนย์ (ซม.) */
  pitch: number;
  clear: number;
  clearReq: number;
  sMax: number;
  bandAsProv: number | null;
  V: SidePair;
  v: number;
  vc: number;
  top: TopTension | null;
  anchorage: Anchorage | null;
}

export interface PunchingCheck extends PunchingPerimeter {
  V: number;
  /** โมเมนต์ถ่ายเทรอบศูนย์หน้าตัดวิกฤต (kg·cm) */
  Mux: number;
  Muy: number;
  vV: number;
  vM: number;
  v: number;
  vc: number;
}

export interface BearingCheck {
  A1: number;
  sqrtRatio: number;
  f: number;
  fAllow: number;
  /** เหล็กเดือยถ่ายแรงแบกทานส่วนเกิน (15.8.1.2) */
  dowelAs: number;
}

export interface FootingAnalysis {
  dims: FootingDims;
  loads: FootingLoads;
  geom: FootingGeometry;
  params: WsdParams;
  x: FootingDirection;
  y: FootingDirection;
  punching: PunchingCheck | null;
  bearing: BearingCheck;
  checks: CheckItem[];
  steps: CalcStep[];
  status: CheckStatus;
}

function analyzeDirection(
  input: FootingInput,
  loads: FootingLoads,
  geom: FootingGeometry,
  layout: FootingLayout,
  dir: BarDir,
  p: WsdParams,
): FootingDirection {
  const { dims } = loads;
  const bars = layout[dir];
  const d = geom.d[dir];
  const db = geom.db[dir];
  const width = widthOf(dims, dir);
  const demand = directionDemand(input, loads, dir, d, p);
  const count = Math.max(1, Math.round(bars.count));
  const pitch = count > 1 ? (width - 2 * input.cover - db) / (count - 1) : Infinity;
  const sq = Math.sqrt(input.fc);

  const V = oneWayShears(loads, dir, d);
  const Mneg = Math.min(0, demand.M.neg, demand.M.pos);
  const top: TopTension | null =
    Mneg < -1
      ? {
          M: -Mneg,
          ft: (6 * -Mneg) / (width * dims.t * dims.t),
          ftAllow: K.plainTensionCoef * sq,
          AsTop: -Mneg / (p.fsAllow * p.j * (dims.t - input.cover)),
        }
      : null;

  const available = anchorageAvailable(loads, dir, demand.M, input.cover, d);
  const AsProv = count * REBARS[bars.size].area;
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
    sMax: Math.min(K.maxSpacingFactor * dims.t, K.maxSpacing),
    bandAsProv: demand.band ? countInBand(geom.positions[dir], demand.band) * REBARS[bars.size].area : null,
    V,
    v: Math.max(0, V.neg, V.pos) / (width * d),
    vc: K.oneWayVcCoef * sq,
    top,
    anchorage,
  };
}

export function analyzePunching(input: FootingInput, loads: FootingLoads, d: number): PunchingCheck | null {
  const { loc, dims, pressure, w } = loads;
  const per = punchingPerimeter(loc, dims, d);
  if (per.b0 <= 0) return null;
  const inside = integrateNet(pressure, w, per.x1, per.x2, per.y1, per.y2);
  const P = Math.max(0, input.P);
  const V = Math.max(0, P - inside.F);
  const Mux = input.My * 100 + P * (loc.xc - per.xg) - (inside.Sx - per.xg * inside.F);
  const Muy = input.Mx * 100 + P * (loc.yc - per.yg) - (inside.Sy - per.yg * inside.F);
  const vV = V / (per.b0 * d);
  const vM =
    (per.Jx > 0 ? (per.gammaX * Math.abs(Mux) * per.cX) / per.Jx : 0) +
    (per.Jy > 0 ? (per.gammaY * Math.abs(Muy) * per.cY) / per.Jy : 0);
  const vc = K.punchingVcCoef * Math.sqrt(input.fc);
  return { ...per, V, Mux, Muy, vV, vM, v: vV + vM, vc };
}

function analyzeBearing(input: FootingInput, loads: FootingLoads, p: WsdParams): BearingCheck {
  const ov = loads.loc.overhang;
  const lim = 2 * loads.dims.t;
  const kx = 1 + (2 * Math.max(0, Math.min(ov.left, ov.right, lim))) / input.cx;
  const ky = 1 + (2 * Math.max(0, Math.min(ov.bottom, ov.top, lim))) / input.cy;
  const sqrtRatio = Math.min(kx, ky, K.bearingSqrtMax);
  const A1 = input.cx * input.cy;
  const P = Math.max(0, input.P);
  const fAllow = K.bearingRatio * input.fc * sqrtRatio;
  return { A1, sqrtRatio, f: P / A1, fAllow, dowelAs: Math.max(0, P - fAllow * A1) / p.fsAllow };
}

const ton = (kg: number) => fmt(kg / 1000, 2);
const tm = (kgcm: number) => fmt(kgcm / 1e5, 2);
const tpm2 = (ksc: number) => fmt(ksc * 10, 2);
const meter = (cm: number) => fmt(cm / 100, 2);

export function analyzeFooting(input: FootingInput, dims: FootingDims, layout: FootingLayout): FootingAnalysis {
  const loads = footingLoads(input, dims);
  const geom = footingGeometry(input.cover, dims, layout);
  const params = wsdParams(input.fc, input.fy, input.fy);
  const x = analyzeDirection(input, loads, geom, layout, 'x', params);
  const y = analyzeDirection(input, loads, geom, layout, 'y', params);
  const punching = analyzePunching(input, loads, geom.dAvg);
  const bearing = analyzeBearing(input, loads, params);
  const { pressure } = loads;
  const qa = input.qa / 10;

  // ---------- ตรวจสอบ ----------
  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, provided: string, status: CheckStatus) =>
    checks.push({ id: `F-${checks.length}`, group, label, required, provided, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);

  push('soil', 'แรงลัพธ์อยู่ในฐานราก (ม.)', '|ex| < B/2, |ey| < L/2', `${meter(loads.ex)}, ${meter(loads.ey)}`, okIf(pressure.stable));
  if (pressure.stable) {
    push('soil', 'แรงดันดินสูงสุด qmax (t/m²)', `≤ ${fmt(input.qa, 2)}`, tpm2(pressure.qmax), okIf(pressure.qmax <= qa * (1 + 1e-6)));
    push('soil', 'พื้นที่ดินรับแรงดัน (%)', `≥ ${fmt(K.minContactRatio * 100, 0)}`, fmt(pressure.contactRatio * 100, 0),
      okIf(pressure.contactRatio >= K.minContactRatio - 1e-9, 'warn'));
  }

  for (const r of [x, y]) {
    push('flexure', `M ${DIR_TH[r.dir]} ≤ R·b·d² (t·m)`, `≤ ${tm(r.Mc)}`, tm(r.Mdesign), okIf(r.Mdesign <= r.Mc * (1 + 1e-6)));
    push('flexure', `As ${DIR_TH[r.dir]} (ซม.²)`, `≥ ${fmt(r.AsReq)}`, fmt(r.AsProv), okIf(r.AsProv >= r.AsReq * (1 - 1e-6)));
    if (r.top) {
      push('flexure', `ผิวบน ${DIR_TH[r.dir]} (โมเมนต์ลบ) ft (ksc)`, `≤ ${fmt(r.top.ftAllow)}`, fmt(r.top.ft), okIf(r.top.ft <= r.top.ftAllow, 'warn'));
    }
  }
  for (const r of [x, y]) {
    push('oneWay', `v ${DIR_TH[r.dir]} ที่ระยะ d จากผิวเสา (ksc)`, `≤ ${fmt(r.vc)}`, fmt(r.v), okIf(r.v <= r.vc * (1 + 1e-6)));
  }
  if (punching) {
    push('punching', `v = V/b0d + γv·M·c/J (${punching.nSides} ด้าน) (ksc)`, `≤ ${fmt(punching.vc)}`, fmt(punching.v),
      okIf(punching.v <= punching.vc * (1 + 1e-6)));
  }

  const dMin = Math.min(geom.d.x, geom.d.y);
  push('detail', 'ความลึกเหนือเหล็กล่าง d (ซม.)', `≥ ${fmt(K.minDepthAboveSteel, 1)}`, fmt(dMin, 1), okIf(dMin >= K.minDepthAboveSteel - 1e-9));
  for (const r of [x, y]) {
    push('detail', `ช่องว่างเหล็ก${DIR_TH[r.dir]} (ซม.)`, `≥ ${fmt(r.clearReq, 1)}`, fmt(r.clear, 1), okIf(r.clear >= r.clearReq - 1e-9));
    push('detail', `ระยะเรียงเหล็ก${DIR_TH[r.dir]} (ซม.)`, `≤ ${fmt(r.sMax, 1)}`, fmt(r.pitch, 1), okIf(r.pitch <= r.sMax + 1e-9));
    if (r.band && r.bandAsProv !== null) {
      push('detail', `As ${DIR_TH[r.dir]} ในแถบกลางกว้าง ${meter(spanOf(dims, r.dir))} ม. (ซม.²)`, `≥ ${fmt(r.bandAsReq)}`,
        fmt(r.bandAsProv), okIf(r.bandAsProv >= r.bandAsReq * (1 - 1e-6)));
    }
  }
  for (const r of [x, y]) {
    const a = r.anchorage;
    if (!a) continue;
    push('anchorage', `ระยะฝังเหล็ก${DIR_TH[r.dir]} จากผิวเสา (ซม.)`, a.hook ? `งอขอ ≥ ${fmt(a.ldh, 1)}` : `≥ ${fmt(a.ld, 1)}`,
      `${fmt(a.available, 1)}${a.hook ? ' (งอขอ)' : ''}`, okIf(a.ok));
  }
  push('bearing', 'หน่วยแรงแบกทาน P/A1 (ksc)', `≤ ${fmt(bearing.fAllow, 1)}`, fmt(bearing.f, 1),
    okIf(bearing.f <= bearing.fAllow * (1 + 1e-6), 'warn'));

  // ---------- ขั้นตอนคำนวณ ----------
  const steps: CalcStep[] = [
    { label: 'W', formula: `B·L·(${K.concreteUnitWeight}t + γs(Df − t))`, value: `${ton(loads.W)} ตัน`, print: true },
    { label: 'N', formula: 'P + W', value: `${ton(loads.N)} ตัน`, print: true },
    { label: 'ex, ey', formula: '(P·xc + My)/N, (P·yc + Mx)/N', value: `${meter(loads.ex)}, ${meter(loads.ey)} ม.`, print: true },
    {
      label: 'qmax, qmin',
      formula: !pressure.stable ? 'แรงลัพธ์อยู่นอกฐาน' : pressure.full ? 'N/A·(1 ± 6ex/B ± 6ey/L)' : 'ดินไม่รับแรงดึง — สมดุลระนาบแรงดัน',
      value: `${tpm2(pressure.qmax)}, ${tpm2(pressure.qmin)} t/m²`,
      print: true,
    },
    {
      label: 'n, k, j, R',
      formula: 'fc = 0.45f′c, fs = 0.5fy ≤ 1,700',
      value: `${params.n}, ${fmt(params.k, 3)}, ${fmt(params.j, 3)}, ${fmt(params.R, 2)}`,
      print: true,
    },
    { label: 'd (X, Y)', formula: `ชั้นล่าง${DIR_TH[layout.bottom]}`, value: `${fmt(geom.d.x, 1)}, ${fmt(geom.d.y, 1)} ซม.`, print: true },
  ];
  for (const r of [x, y]) {
    const T = DIR_TH[r.dir];
    steps.push(
      { label: `M ${T}`, formula: `∫(q − w)·แขน ที่ผิวเสา, b = ${meter(r.width)} ม.`, value: `${tm(r.Mdesign)} t·m`, print: true },
      {
        label: `As ${T}`,
        formula: `max(M/(fs·j·d), ${fmt(asMinRatio(input.fy), 4)}·b·t)`,
        value: `${fmt(r.AsReq)} → ${r.count}-${r.size} = ${fmt(r.AsProv)} ซม.²`,
        print: true,
      },
    );
    if (r.band) {
      steps.push({ label: `As แถบกลาง ${T}`, formula: `2/(β+1)·As, β = ${fmt(r.band.beta, 2)}`, value: `${fmt(r.bandAsReq)} ซม.²` });
    }
    steps.push({ label: `V ${T}`, formula: 'ที่ระยะ d จากผิวเสา, vc = 0.29√f′c', value: `${ton(Math.max(0, r.V.neg, r.V.pos))} ตัน, v = ${fmt(r.v)} ksc`, print: true });
    if (r.top) {
      steps.push({ label: `ผิวบน ${T}`, formula: '6M⁻/(b·t²) — เกินค่ายอมให้ ควรเสริมเหล็กบน', value: `${fmt(r.top.ft)} ksc, As บน ≥ ${fmt(r.top.AsTop)} ซม.²` });
    }
  }
  if (punching) {
    steps.push(
      { label: 'b0', formula: `${punching.nSides} ด้าน ห่างผิวเสา d/2, d = ${fmt(geom.dAvg, 1)}`, value: `${fmt(punching.b0, 1)} ซม.` },
      { label: 'V ทะลุ', formula: 'P − ∫วิกฤต(q − w)', value: `${ton(punching.V)} ตัน`, print: true },
      { label: 'M ถ่ายเท', formula: 'รอบศูนย์หน้าตัดวิกฤต (x, y)', value: `${tm(punching.Mux)}, ${tm(punching.Muy)} t·m` },
      {
        label: 'vc ทะลุ',
        formula: '0.53√f′c',
        value: `${fmt(punching.vc)} ksc`,
        print: true,
      },
    );
  }
  const anch = [x, y].filter((r) => r.anchorage);
  if (anch.length > 0) {
    steps.push({
      label: 'ld, ldh',
      formula: 'ld = fs·db/(4u), u = 3.23√f′c/db ≤ 35; ldh = 318db/√f′c·fy/4,200 × As ต้องการ/As ใส่',
      value: anch.map((r) => `${r.size}: ${fmt(r.anchorage!.ld, 0)}, ${fmt(r.anchorage!.ldh, 0)}`).join(' / ') + ' ซม.',
      print: true,
    });
  }
  steps.push({ label: 'fb ยอมให้', formula: `0.3f′c·√(A2/A1), √ = ${fmt(bearing.sqrtRatio, 2)}`, value: `${fmt(bearing.fAllow, 1)} ksc` });
  if (bearing.dowelAs > 0) {
    steps.push({ label: 'เหล็กเดือย', formula: '(P − fb·A1)/fs — ถ่ายแรงแบกทานส่วนเกิน', value: `As ≥ ${fmt(bearing.dowelAs)} ซม.²`, print: true });
  }

  return { dims, loads, geom, params, x, y, punching, bearing, checks, steps, status: worstStatus(checks) };
}
