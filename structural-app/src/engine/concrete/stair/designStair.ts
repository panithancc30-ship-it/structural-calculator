import { ACI318_WSD_SLAB as KS, ACI318_WSD_STAIR as K } from '../codes/aci318Wsd';
import { wsdParams } from '../design/flexure';
import { asMinRatio } from '../footing/analyzeFooting';
import { REBARS } from '../rebar';
import { candidatesFrom, pickRun } from '../slab/designSlab';
import { minThickness } from './analyzeStair';
import { stairProfile } from './geometry';
import { endReaction, stairLoads, stairMoments } from './loads';
import type { StairDims, StairInput, StairLayout } from './types';

const STRIP = 100;

const ceilStep = (v: number) => Math.ceil(v / KS.sizeStep - 1e-9) * KS.sizeStep;

/**
 * โมเมนต์และแรงเฉือนที่ความหนาหนึ่ง ๆ
 * แยกออกมาเพราะทั้งการหาความหนาและการเลือกเหล็กต้องใช้ชุดเดียวกัน — น้ำหนักตัวบันไดเปลี่ยนตาม t
 */
function demandAt(input: StairInput, t: number) {
  const { L } = stairProfile(input);
  const loads = stairLoads(input, t);
  const moments = stairMoments(loads.wEq, L, input.endLow, input.endHigh);
  const V = Math.max(
    endReaction(loads.statics.Rlow, input.endLow),
    endReaction(loads.statics.Rhigh, input.endHigh),
  );
  return { moments, V };
}

/** ความหนานี้ผ่านเกณฑ์คอนกรีต (โมเมนต์ที่รับได้ และเฉือนทางเดียว) หรือไม่ */
function thicknessOk(input: StairInput, t: number): boolean {
  if (t < minThickness(input).required - 1e-9) return false;

  const p = wsdParams(input.fc, input.fy, input.fy);
  const d = t - input.cover - REBARS[input.bar].dia / 2;
  if (d < KS.minEffectiveDepth) return false;

  const { moments, V } = demandAt(input, t);
  const M = Math.max(moments.pos, moments.negLow, moments.negHigh);
  if (M > p.R * STRIP * d * d * (1 + 1e-9)) return false;
  return V / (STRIP * d) <= KS.oneWayVcCoef * Math.sqrt(input.fc) * (1 + 1e-9);
}

let cache: { key: string; dims: StairDims } | null = null;

/** หาความหนาท้องบันไดที่บางที่สุดที่ยังผ่านทุกเกณฑ์ */
export function autoStairDims(input: StairInput): StairDims {
  const key = JSON.stringify(input);
  if (cache?.key === key) return cache.dims;

  let t = ceilStep(Math.max(K.absMinThickness, minThickness(input).required));
  while (t < KS.autoMaxThickness && !thicknessOk(input, t)) t += KS.sizeStep;

  const dims: StairDims = { t };
  cache = { key, dims };
  return dims;
}

export function stairDims(input: StairInput): StairDims {
  return input.thicknessMode === 'manual' ? { t: input.t } : autoStairDims(input);
}

/** จัดเหล็กทุกชุดให้อัตโนมัติ — ระบุเป็นระยะเรียงต่อแถบกว้าง 1 ม. แบบเดียวกับพื้น */
export function autoStairLayout(input: StairInput, dims: StairDims): StairLayout {
  const { t } = dims;
  const p = wsdParams(input.fc, input.fy, input.fy);
  const { moments } = demandAt(input, t);
  const AsTemp = asMinRatio(input.fy) * STRIP * t;
  const main = candidatesFrom(input.bar);
  const temp = candidatesFrom(input.tempBar);
  const sMain = Math.min(KS.maxSpacingFactor * t, KS.maxSpacing);
  const sTemp = Math.min(KS.tempSpacingFactor * t, KS.maxSpacing);

  const mainRun = (M: number) =>
    pickRun(main, 1, sMain, {
      t,
      cover: input.cover,
      behind: 0,
      fsjRequired: (d) => Math.max(M / (p.fsAllow * p.j * d), AsTemp),
      minDepth: KS.minEffectiveDepth,
    });

  const bottom = mainRun(moments.pos);
  return {
    bottom,
    topLow: mainRun(moments.negLow),
    topHigh: mainRun(moments.negHigh),
    // เหล็กกระจายวางถัดจากเหล็กหลักเข้าไปในเนื้อคอนกรีต
    dist: pickRun(temp, AsTemp, sTemp, {
      t,
      cover: input.cover,
      behind: bottom ? REBARS[bottom.size].dia : 0,
      fsjRequired: null,
      minDepth: 0,
    }),
    step: { size: input.tempBar, spacing: K.stepBarSpacing },
  };
}
