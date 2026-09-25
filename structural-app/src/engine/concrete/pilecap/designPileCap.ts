import { ACI318_WSD as C, ACI318_WSD_FOOTING as KF, ACI318_WSD_PILECAP as K } from '../codes/aci318Wsd';
import { wsdParams } from '../design/flexure';
import { developmentLengths } from '../footing/analyzeFooting';
import { footingGeometry, otherDir } from '../footing/geometry';
import type { BarDir, BarSet, FootingLayout } from '../footing/types';
import { MAIN_BAR_SIZES, REBARS, type BarName } from '../rebar';
import {
  analyzeColumnPunching,
  analyzePilePunching,
  anchorageAvailable,
  basketRecommended,
  maxBarSpacing,
  capWidth,
  directionDemand,
  faceMoments,
  oneWayShears,
  pileCapLoads,
  type PileCapLoads,
} from './analyzePileCap';
import { canRotate, PILE_COUNTS } from './piles';
import type { PileArrangement, PileCapInput } from './types';

/** กลุ่มเข็มรับแรงได้: ไม่มีโมเมนต์ที่รับไม่ได้, Rmax ≤ Pa, Rmin ≥ −Ta */
export function pilesOk(input: PileCapInput, loads: PileCapLoads): boolean {
  const R = loads.service.R;
  return (
    loads.service.unresisted <= K.unresistedTolerance &&
    Math.max(...R) <= input.pileCapacity * 1000 * (1 + 1e-9) &&
    Math.min(...R) >= -input.pileTension * 1000 - 1e-6
  );
}

/** จำนวนเข็มน้อยสุดที่รับแรงได้ (ลองรูปแบบปกติก่อนรูปที่หมุน) — ไม่พบใช้ 9 ต้น */
export function pickArrangement(input: PileCapInput, t: number): PileArrangement {
  if (input.countMode === 'manual') return { count: input.pileCount, rotate: canRotate(input.pileCount) && input.rotate };
  for (const count of PILE_COUNTS) {
    for (const rotate of canRotate(count) ? [input.rotate, !input.rotate] : [false]) {
      if (pilesOk(input, pileCapLoads(input, { count, rotate }, t))) return { count, rotate };
    }
  }
  return { count: K.maxPiles, rotate: false };
}

/**
 * เลือกขนาด/จำนวนเหล็กทั้งสองทิศ — ชั้นล่างคือทิศที่โมเมนต์ต่อความกว้างมากกว่า
 * เข็มต้นเดียวหรือฐานรากหนามากใช้เหล็กตะกร้อ (ขาล่างและขาบนแบ่งเหล็กกันร้าวกันคนละครึ่ง)
 */
export function autoPileCapLayout(input: PileCapInput, arrangement: PileArrangement, t: number): FootingLayout {
  return layoutFor(input, pileCapLoads(input, arrangement, t));
}

function layoutFor(input: PileCapInput, loads: PileCapLoads): FootingLayout {
  const { dims } = loads;
  const basket = basketRecommended(loads.piles.nominal.length, dims.t);
  const p = wsdParams(input.fc, input.fy, input.fy);
  const moments = { x: faceMoments(loads, 'x'), y: faceMoments(loads, 'y') };
  const perWidth = (dir: BarDir) => Math.max(0, moments[dir].neg, moments[dir].pos) / capWidth(dims, dir);
  const bottom: BarDir = perWidth('x') >= perWidth('y') ? 'x' : 'y';
  const start = Math.max(0, MAIN_BAR_SIZES.indexOf(input.bar));
  const candidates: BarName[] = [...MAIN_BAR_SIZES.slice(start), ...MAIN_BAR_SIZES.slice(0, start).reverse()];
  const sMax = maxBarSpacing(dims.t, basket);

  const pick = (dir: BarDir, zBase: number): BarSet => {
    const width = capWidth(dims, dir);
    let fallback: BarSet | null = null;
    let first: BarSet | null = null;
    for (const size of candidates) {
      const { dia, area } = REBARS[size];
      const d = dims.t - zBase - dia / 2;
      const demand = directionDemand(input, loads, dir, d, p, moments[dir], basket);
      const net = width - 2 * input.cover - dia;
      const n = Math.max(2, Math.ceil(demand.AsReq / area - 1e-9), Math.ceil(net / sMax - 1e-9) + 1);
      const set = { size, count: n };
      first ??= set;
      if (net / (n - 1) - dia < Math.max(dia, C.minClearSpacing) - 1e-9) continue;
      fallback ??= set;
      const available = anchorageAvailable(loads, dir, demand.M, input.cover);
      if (available === null) return set;
      const { ld, ldh } = developmentLengths(size, input.fc, input.fy, demand.AsFlex / (n * area));
      if (available >= Math.min(ld, ldh) - 1e-9) return set;
    }
    return fallback ?? first!;
  };

  const top = otherDir(bottom);
  const bottomSet = pick(bottom, input.cover);
  const topSet = pick(top, input.cover + REBARS[bottomSet.size].dia);
  return bottom === 'x' ? { x: bottomSet, y: topSet, bottom, basket } : { x: topSet, y: bottomSet, bottom, basket };
}

/** d ขั้นต่ำ, ดัด (คอนกรีต), เฉือนแบบคาน, เฉือนทะลุรอบเสาและรอบเข็ม ผ่านด้วยเหล็กที่ออกแบบอัตโนมัติ */
function thicknessOk(input: PileCapInput, arrangement: PileArrangement, t: number): boolean {
  const loads = pileCapLoads(input, arrangement, t);
  const layout = layoutFor(input, loads);
  const geom = footingGeometry(input.cover, loads.dims, layout);
  if (Math.min(geom.d.x, geom.d.y) < K.minDepthAboveSteel - 1e-9) return false;
  const p = wsdParams(input.fc, input.fy, input.fy);
  const vc = KF.oneWayVcCoef * Math.sqrt(input.fc);
  for (const dir of ['x', 'y'] as const) {
    const d = geom.d[dir];
    const width = capWidth(loads.dims, dir);
    const M = faceMoments(loads, dir);
    if (Math.max(0, M.neg, M.pos) > p.R * width * d * d * (1 + 1e-6)) return false;
    const V = oneWayShears(loads, dir, d, input.pileSize);
    if (Math.max(0, V.neg, V.pos) / (width * d) > vc * (1 + 1e-6)) return false;
  }
  const col = analyzeColumnPunching(input, loads, geom.dAvg);
  if (col && col.v > col.vc * (1 + 1e-6)) return false;
  const pile = analyzePilePunching(input, loads, geom.dAvg);
  return !pile || pile.v <= pile.vc * (1 + 1e-6);
}

function minThickness(input: PileCapInput, arrangement: PileArrangement): number {
  const step = K.sizeStep;
  if (thicknessOk(input, arrangement, K.autoMinThickness)) return K.autoMinThickness;
  if (!thicknessOk(input, arrangement, K.autoMaxThickness)) return K.autoMaxThickness;
  let lo: number = K.autoMinThickness;
  let hi: number = K.autoMaxThickness;
  while (hi - lo > step) {
    const mid = lo + Math.floor((hi - lo) / step / 2) * step;
    if (thicknessOk(input, arrangement, mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export interface PileCapDesign {
  arrangement: PileArrangement;
  t: number;
}

/** จำนวนเข็ม ↔ ความหนา (น้ำหนักฐานรากเปลี่ยนแรงในเข็ม) วนจนคงที่ */
function search(input: PileCapInput): PileCapDesign {
  let t = input.thicknessMode === 'manual' ? input.t : K.autoMinThickness;
  let arrangement = pickArrangement(input, t);
  for (let i = 0; i < 8; i++) {
    const nextT = input.thicknessMode === 'manual' ? input.t : minThickness(input, arrangement);
    const next = pickArrangement(input, nextT);
    const same = nextT === t && next.count === arrangement.count && next.rotate === arrangement.rotate;
    t = nextT;
    arrangement = next;
    if (same) break;
  }
  return { arrangement, t };
}

let cache: { key: string; design: PileCapDesign } | null = null;

export function pileCapDesign(input: PileCapInput): PileCapDesign {
  const key = JSON.stringify(input);
  if (cache?.key === key) return cache.design;
  const design = search(input);
  cache = { key, design };
  return design;
}
