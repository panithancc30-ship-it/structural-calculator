import { ACI318_WSD as C } from '../codes/aci318Wsd';
import type { BeamInput } from '../types';
import type { WsdParams } from './flexure';

export interface ShearTorsionDemand {
  /** kg */
  V: number;
  /** kg·cm */
  T: number;
  d: number;
  sqrtFc: number;

  v: number;
  vcBase: number;
  vc: number;
  /** vt จากแรงบิด (คำนวณจริง แม้จะละเลยได้) */
  vt: number;
  vtc: number;
  vtNeglectLimit: number;
  torsionNeglected: boolean;

  sumX2y: number;
  x1: number;
  y1: number;
  alphaT: number;

  vExcess: number;
  vMax: number;
  shearSectionOk: boolean;
  vtMax: number;
  torsionSectionOk: boolean;

  /** Av/s ที่ต้องการ (ซม.²/ซม.) */
  avs: number;
  /** At/s ที่ต้องการต่อขา (ซม.²/ซม.) */
  ats: number;

  sMaxShear: number;
  sMaxTorsion: number | null;
  sMax: number;

  AlStrength: number;
  AlMin: number;
  /** เหล็กยืนรับแรงบิดทั้งหมด (ซม.²) */
  Al: number;
}

/**
 * ความต้องการเหล็กปลอกจากแรงเฉือน + แรงบิด (ACI 318 WSD)
 * @param d ความลึกประสิทธิผล (ซม.)
 * @param stirrupDia เส้นผ่านศูนย์กลางเหล็กปลอก (ซม.) — ใช้หา x1, y1
 */
export function shearTorsionDemand(input: BeamInput, p: WsdParams, d: number, stirrupDia: number): ShearTorsionDemand {
  const { b, h, cover } = input;
  const V = Math.abs(input.V);
  const T = Math.abs(input.T) * 100;
  const sqrtFc = Math.sqrt(input.fc);

  const v = V / (b * d);
  const x = Math.min(b, h);
  const y = Math.max(b, h);
  const sumX2y = x * x * y;
  const vt = (3 * T) / sumX2y;
  const vtNeglectLimit = C.vtNeglectCoef * sqrtFc;
  const torsionNeglected = vt <= vtNeglectLimit;

  const vcBase = C.vcCoef * sqrtFc;
  let vc = vcBase;
  let vtc = 0;
  if (!torsionNeglected) {
    vc = v > 0 ? vcBase / Math.sqrt(1 + (vt / (1.2 * v)) ** 2) : 0;
    vtc = (C.vtcCoef * sqrtFc) / Math.sqrt(1 + ((1.2 * v) / vt) ** 2);
  }

  const vExcess = Math.max(0, v - vc);
  const vMax = C.vMaxCoef * sqrtFc;
  const vtMax = (1 + C.torsionSteelMaxFactor) * vtc;

  const x1 = x - 2 * cover - stirrupDia;
  const y1 = y - 2 * cover - stirrupDia;
  const alphaT = Math.min(C.alphaTMax, 0.66 + (0.33 * y1) / x1);

  const fv = p.fvAllow;
  const avs = (vExcess * b) / fv;
  const vtExcess = torsionNeglected ? 0 : Math.max(0, vt - vtc);
  const ats = (vtExcess * sumX2y) / (3 * alphaT * x1 * y1 * fv);

  const sMaxShear = vExcess > C.vExcessHalfSpacingCoef * sqrtFc ? d / 4 : d / 2;
  const sMaxTorsion = torsionNeglected ? null : Math.min((x1 + y1) / 4, C.torsionSpacingMax);
  const sMax = sMaxTorsion === null ? sMaxShear : Math.min(sMaxShear, sMaxTorsion);

  let AlStrength = 0;
  let AlMin = 0;
  if (!torsionNeglected) {
    AlStrength = 2 * ats * (x1 + y1);
    const twoAtPerS = Math.max(2 * ats, (C.AvMinCoef * b) / input.fyv);
    AlMin = Math.max(0, ((C.AlMinCoef * x) / p.fy * (vt / (vt + v)) - twoAtPerS) * (x1 + y1));
  }

  return {
    V, T, d, sqrtFc,
    v, vcBase, vc, vt, vtc, vtNeglectLimit, torsionNeglected,
    sumX2y, x1, y1, alphaT,
    vExcess, vMax,
    shearSectionOk: v <= vMax,
    vtMax,
    torsionSectionOk: torsionNeglected || vt <= vtMax,
    avs, ats,
    sMaxShear, sMaxTorsion, sMax,
    AlStrength, AlMin,
    Al: Math.max(AlStrength, AlMin),
  };
}

/** แบ่ง Al ลงผิวบน/ล่าง/ข้าง — h < 60 ซม. แบ่งครึ่งบนล่าง, h ≥ 60 ซม. แบ่ง ⅓ รวมเหล็กข้าง */
export function distributeAl(Al: number, h: number): { top: number; bottom: number; side: number } {
  if (Al <= 0) return { top: 0, bottom: 0, side: 0 };
  if (h < 60) return { top: Al / 2, bottom: Al / 2, side: 0 };
  return { top: Al / 3, bottom: Al / 3, side: Al / 3 };
}
