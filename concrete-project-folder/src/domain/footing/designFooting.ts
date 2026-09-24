import { ACI318_WSD as C, ACI318_WSD_FOOTING as K } from '../codes/aci318Wsd';
import { wsdParams } from '../design/flexure';
import { MAIN_BAR_SIZES, REBARS, type BarName } from '../rebar';
import {
  analyzePunching,
  anchorageAvailable,
  countInBand,
  developmentLengths,
  directionDemand,
  faceMoments,
  footingLoads,
  oneWayShears,
  type FootingLoads,
} from './analyzeFooting';
import { barPositions, footingGeometry, otherDir, widthOf } from './geometry';
import type { BarDir, BarSet, FootingDims, FootingInput, FootingLayout } from './types';

const STEP = K.sizeStep;
const ceilStep = (v: number) => Math.ceil(v / STEP - 1e-9) * STEP;

/** ขนาดเล็กสุดที่เสาอยู่ในฐานรากครบ */
function minPlan(input: FootingInput): { B: number; L: number } {
  const flushX = input.position === 'corner' || (input.position === 'edge' && (input.edgeSide === 'left' || input.edgeSide === 'right'));
  const flushY = input.position === 'corner' || (input.position === 'edge' && (input.edgeSide === 'bottom' || input.edgeSide === 'top'));
  const offset = input.position === 'offset';
  const span = (c: number, e: number, flush: boolean) => ceilStep(flush ? input.edgeGap + c + 10 : 2 * Math.abs(e) + c + 20);
  return { B: span(input.cx, offset ? input.ex : 0, flushX), L: span(input.cy, offset ? input.ey : 0, flushY) };
}

type Plan = { B: number; L: number };
const RATIOS = [1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2];

/**
 * แปลนพื้นที่น้อยสุดที่ qmax ≤ qa และดินรับแรงดัน ≥ 50% ของพื้นที่:
 * ทุกอัตราส่วนด้าน ≤ 2 ค้นหาแบบแบ่งครึ่งทีละ 5 ซม. แล้วเลือกรูปที่ใกล้จัตุรัสที่สุดในกลุ่มพื้นที่น้อยสุด
 */
export function sizePlan(input: FootingInput, t: number): Plan {
  const min = minPlan(input);
  const qa = input.qa / 10;
  const qmaxOf = (c: Plan) => {
    const p = footingLoads(input, { ...c, t }).pressure;
    return p.stable && p.contactRatio >= K.minContactRatio - 1e-9 ? p.qmax : Infinity;
  };
  const ok = (c: Plan) => qmaxOf(c) <= qa * (1 + 1e-9);
  const aspect = (c: Plan) => Math.max(c.B, c.L) / Math.min(c.B, c.L);
  const cap = (v: number) => Math.min(K.autoMaxSpan, v);
  const iMax = Math.ceil(K.autoMaxSpan / STEP);

  const found: Plan[] = [];
  for (const r of RATIOS) {
    for (const flip of r === 1 ? [false] : [false, true]) {
      const at = (i: number): Plan => ({
        B: cap(Math.max(min.B, ceilStep((flip ? r : 1) * i * STEP))),
        L: cap(Math.max(min.L, ceilStep((flip ? 1 : r) * i * STEP))),
      });
      if (!ok(at(iMax))) continue;
      let hi = iMax;
      if (ok(at(0))) hi = 0;
      else {
        let lo = 0;
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (ok(at(mid))) hi = mid;
          else lo = mid;
        }
      }
      found.push(at(hi));
    }
  }
  if (found.length === 0) return { B: K.autoMaxSpan, L: K.autoMaxSpan };

  // พื้นที่ไม่เกินค่าน้อยสุด + 4% เลือกที่ใกล้จัตุรัสที่สุด
  const minArea = Math.min(...found.map((c) => c.B * c.L));
  const order = (a: Plan, b: Plan) => aspect(a) - aspect(b) || a.B * a.L - b.B * b.L || qmaxOf(a) - qmaxOf(b);
  let best = found.filter((c) => c.B * c.L <= minArea * 1.04).sort(order)[0];

  // ลดด้านทีละ 5 ซม. เมื่อยังผ่านและไม่ทำให้ห่างจากจัตุรัสมากขึ้น
  for (;;) {
    const current = best;
    const shrunk = [
      { B: current.B - STEP, L: current.L },
      { B: current.B, L: current.L - STEP },
    ]
      .filter((c) => c.B >= min.B && c.L >= min.L && aspect(c) <= aspect(current) + 1e-9 && ok(c))
      .sort(order);
    if (shrunk.length === 0) return best;
    best = shrunk[0];
  }
}

/** เลือกขนาด/จำนวนเหล็กทุกทิศ — ชั้นล่างคือทิศที่โมเมนต์ต่อความกว้างมากกว่า */
export function autoFootingLayout(input: FootingInput, dims: FootingDims): FootingLayout {
  return layoutFor(input, dims, footingLoads(input, dims));
}

function layoutFor(input: FootingInput, dims: FootingDims, loads: FootingLoads): FootingLayout {
  const p = wsdParams(input.fc, input.fy, input.fy);
  const moments = { x: faceMoments(loads, 'x'), y: faceMoments(loads, 'y') };
  const perWidth = (dir: BarDir) => Math.max(0, moments[dir].neg, moments[dir].pos) / widthOf(dims, dir);
  const bottom: BarDir = perWidth('x') >= perWidth('y') ? 'x' : 'y';
  const start = Math.max(0, MAIN_BAR_SIZES.indexOf(input.bar));
  // ใช้ขนาดที่เลือกก่อน ถ้าช่องว่างไม่พอขยับใหญ่ขึ้น, ถ้าระยะฝังไม่พอลองขนาดเล็กลง
  const candidates: BarName[] = [...MAIN_BAR_SIZES.slice(start), ...MAIN_BAR_SIZES.slice(0, start).reverse()];
  const sMax = Math.min(K.maxSpacingFactor * dims.t, K.maxSpacing);

  const pick = (dir: BarDir, zBase: number): BarSet => {
    const width = widthOf(dims, dir);
    let fallback: BarSet | null = null;
    let first: BarSet | null = null;
    for (const size of candidates) {
      const { dia, area } = REBARS[size];
      const d = dims.t - zBase - dia / 2;
      const demand = directionDemand(input, loads, dir, d, p, moments[dir]);
      const net = width - 2 * input.cover - dia;
      let n = Math.max(2, Math.ceil(demand.AsReq / area - 1e-9), Math.ceil(net / sMax - 1e-9) + 1);
      const band = demand.band;
      if (band) {
        const need = Math.ceil(demand.bandAsReq / area - 1e-9);
        // จำนวนเส้นในแถบ ≈ n·ความกว้างแถบ/ความกว้างฐาน — เริ่มนับจากค่าประมาณ
        n = Math.max(n, Math.floor(((need - 1) * net) / (band.hi - band.lo)));
        while (n < 2000 && countInBand(barPositions(width, input.cover, dia, n), band) < need) n++;
      }
      const set = { size, count: n };
      first ??= set;
      const spacingOk = net / (n - 1) - dia >= Math.max(dia, C.minClearSpacing) - 1e-9;
      if (!spacingOk) continue;
      fallback ??= set;
      const available = anchorageAvailable(loads, dir, demand.M, input.cover, d);
      if (available === null) return set;
      const { ld, ldh } = developmentLengths(size, input.fc, input.fy, demand.AsFlex / (n * area));
      if (available >= Math.min(ld, ldh) - 1e-9) return set;
    }
    return fallback ?? first!;
  };

  const top = otherDir(bottom);
  const bottomSet = pick(bottom, input.cover);
  const topSet = pick(top, input.cover + REBARS[bottomSet.size].dia);
  return bottom === 'x' ? { x: bottomSet, y: topSet, bottom } : { x: topSet, y: bottomSet, bottom };
}

/** ความหนาพอรับดัด (คอนกรีต), เฉือนแบบคาน, เฉือนทะลุ และ d ขั้นต่ำ — ตรวจด้วยเหล็กที่ออกแบบอัตโนมัติ (ไม่สร้างข้อความรายงาน) */
function thicknessOk(input: FootingInput, dims: FootingDims): boolean {
  const loads = footingLoads(input, dims);
  const layout = layoutFor(input, dims, loads);
  const geom = footingGeometry(input.cover, dims, layout);
  if (Math.min(geom.d.x, geom.d.y) < K.minDepthAboveSteel - 1e-9) return false;
  const p = wsdParams(input.fc, input.fy, input.fy);
  const vc = K.oneWayVcCoef * Math.sqrt(input.fc);
  for (const dir of ['x', 'y'] as const) {
    const d = geom.d[dir];
    const width = widthOf(dims, dir);
    const M = faceMoments(loads, dir);
    if (Math.max(0, M.neg, M.pos) > p.R * width * d * d * (1 + 1e-6)) return false;
    const V = oneWayShears(loads, dir, d);
    if (Math.max(0, V.neg, V.pos) / (width * d) > vc * (1 + 1e-6)) return false;
  }
  const punching = analyzePunching(input, loads, geom.dAvg);
  return !punching || punching.v <= punching.vc * (1 + 1e-6);
}

/**
 * หาขนาดฐานรากอัตโนมัติ: แปลนจาก qa ที่ความหนา t → หา t น้อยสุด (ทีละ 5 ซม.) ที่เฉือนทะลุ เฉือนแบบคาน และดัด (คอนกรีต) ผ่าน
 * → หาแปลนใหม่ด้วย t ใหม่ (น้ำหนักฐานรากเพิ่ม) จนความหนาไม่เปลี่ยน
 */
export function autoDims(input: FootingInput): FootingDims {
  // store และหน้าจอเรียกด้วยข้อมูลชุดเดียวกันติดกัน — จำผลล่าสุดไว้
  const cacheKey = JSON.stringify(input);
  if (cache?.key === cacheKey) return cache.dims;
  const dims = searchDims(input);
  cache = { key: cacheKey, dims };
  return dims;
}

let cache: { key: string; dims: FootingDims } | null = null;

function searchDims(input: FootingInput): FootingDims {
  let t: number = K.autoMinThickness;
  for (;;) {
    const plan = sizePlan(input, t);
    if (thicknessOk(input, { ...plan, t })) return { ...plan, t };
    if (t >= K.autoMaxThickness || !thicknessOk(input, { ...plan, t: K.autoMaxThickness })) {
      return { ...sizePlan(input, K.autoMaxThickness), t: K.autoMaxThickness };
    }
    // ความหนาน้อยสุดที่ผ่าน (แบ่งครึ่งทีละ 5 ซม.) แล้วหาแปลนใหม่
    let lo = t;
    let hi: number = K.autoMaxThickness;
    while (hi - lo > STEP) {
      const mid = lo + Math.floor((hi - lo) / STEP / 2) * STEP;
      if (thicknessOk(input, { ...plan, t: mid })) hi = mid;
      else lo = mid;
    }
    t = hi;
  }
}

export function footingDims(input: FootingInput): FootingDims {
  return input.sizeMode === 'manual' ? { B: input.B, L: input.L, t: input.t } : autoDims(input);
}
