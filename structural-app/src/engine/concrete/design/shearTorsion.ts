import { ACI318_WSD as C, ACI318_WSD_TORSION as E } from '../codes/aci318Wsd';
import type { BeamInput, TorsionMethod } from '../types';
import type { WsdParams } from './flexure';

export interface ShearTorsionDemand {
  method: TorsionMethod;
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
  /** ACI เท่านั้น (วิธี ว.ส.ท. = 0) */
  vtc: number;
  vtNeglectLimit: number;
  torsionNeglected: boolean;

  sumX2y: number;
  x1: number;
  y1: number;
  /** ACI เท่านั้น (วิธี ว.ส.ท. = 1) */
  alphaT: number;
  /** พื้นที่ภายในเส้นศูนย์กลางปลอก x1·y1 (ซม.²) */
  Ac: number;

  vExcess: number;
  vMax: number;
  shearSectionOk: boolean;
  vtMax: number;
  torsionSectionOk: boolean;
  /** หน่วยแรงเฉือนรวม v + vt ที่ยอมให้ (วิธี ว.ส.ท.) — null = ไม่ได้ตรวจ */
  vCombinedMax: number | null;
  combinedOk: boolean;

  /** Av/s ที่ต้องการ (ซม.²/ซม.) */
  avs: number;
  /** At/s ที่ต้องการต่อขา (ซม.²/ซม.) */
  ats: number;
  /** Av/s ขั้นต่ำของปลอกทุกขารวมกัน (ซม.²/ซม.) */
  avsMin: number;

  sMaxShear: number;
  sMaxTorsion: number | null;
  sMax: number;

  AlStrength: number;
  AlMin: number;
  /** เหล็กยืนรับแรงบิดทั้งหมด (ซม.²) */
  Al: number;
}

/**
 * ความต้องการเหล็กปลอกจากแรงเฉือน + แรงบิด (WSD) ตาม input.torsionMethod
 * @param d ความลึกประสิทธิผล (ซม.)
 * @param stirrupDia เส้นผ่านศูนย์กลางเหล็กปลอก (ซม.) — ใช้หา x1, y1
 */
export function shearTorsionDemand(input: BeamInput, p: WsdParams, d: number, stirrupDia: number): ShearTorsionDemand {
  return input.torsionMethod === 'eit'
    ? eitDemand(input, p, d, stirrupDia)
    : aciDemand(input, p, d, stirrupDia);
}

/** ส่วนที่สองวิธีใช้ร่วมกัน */
function common(input: BeamInput, d: number, stirrupDia: number) {
  const { b, h, cover } = input;
  const V = Math.abs(input.V);
  const T = Math.abs(input.T) * 100;
  const sqrtFc = Math.sqrt(input.fc);
  const x = Math.min(b, h);
  const y = Math.max(b, h);
  const x1 = x - 2 * cover - stirrupDia;
  const y1 = y - 2 * cover - stirrupDia;
  return {
    V, T, d, sqrtFc, x, x1, y1,
    v: V / (b * d),
    sumX2y: x * x * y,
    Ac: x1 * y1,
    vcBase: C.vcCoef * sqrtFc,
    vMax: C.vMaxCoef * sqrtFc,
  };
}

/** ACI 318-83 — คอนกรีตรับแรงเฉือนและแรงบิดร่วมกันตามสมการปฏิสัมพันธ์ */
function aciDemand(input: BeamInput, p: WsdParams, d: number, stirrupDia: number): ShearTorsionDemand {
  const { b } = input;
  const c = common(input, d, stirrupDia);
  const { T, sqrtFc, v, x, x1, y1, sumX2y, vcBase } = c;

  const vt = (3 * T) / sumX2y;
  const vtNeglectLimit = C.vtNeglectCoef * sqrtFc;
  const torsionNeglected = vt <= vtNeglectLimit;

  let vc = vcBase;
  let vtc = 0;
  if (!torsionNeglected) {
    vc = v > 0 ? vcBase / Math.sqrt(1 + (vt / (1.2 * v)) ** 2) : 0;
    vtc = (C.vtcCoef * sqrtFc) / Math.sqrt(1 + ((1.2 * v) / vt) ** 2);
  }

  const vExcess = Math.max(0, v - vc);
  const vtMax = (1 + C.torsionSteelMaxFactor) * vtc;
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
    ...c,
    method: 'aci',
    vc, vt, vtc, vtNeglectLimit, torsionNeglected,
    alphaT,
    vExcess,
    shearSectionOk: v <= c.vMax,
    vtMax,
    torsionSectionOk: torsionNeglected || vt <= vtMax,
    vCombinedMax: null,
    combinedOk: true,
    avs, ats,
    avsMin: (C.AvMinCoef * b) / input.fyv,
    sMaxShear, sMaxTorsion, sMax,
    AlStrength, AlMin,
    Al: Math.max(AlStrength, AlMin),
  };
}

/**
 * เอกสาร ว.ส.ท. — เหล็กปลอกปิดรับแรงบิดทั้งหมด ส่วนแรงเฉือนหัก vc ของคอนกรีตได้เต็ม
 * At/s = T/(2·Ac·fv) ต่อขา, Al = T·2(x1 + y1)/(2·Ac·fs)
 */
function eitDemand(input: BeamInput, p: WsdParams, d: number, stirrupDia: number): ShearTorsionDemand {
  const { b } = input;
  const c = common(input, d, stirrupDia);
  const { T, sqrtFc, v, x1, y1, sumX2y, vcBase, Ac } = c;

  const vt = (E.vtCoef * T) / sumX2y;
  const vtNeglectLimit = E.vtNeglectCoef * sqrtFc;
  const torsionNeglected = vt <= vtNeglectLimit;

  const vc = vcBase;
  const vExcess = Math.max(0, v - vc);
  const vtMax = E.vtMaxCoef * sqrtFc;
  const vCombinedMax = E.combinedMaxCoef * sqrtFc;

  const avs = (vExcess * b) / p.fvAllow;
  const ats = torsionNeglected ? 0 : T / (2 * Ac * p.fvAllow);
  const sMaxShear = vExcess > E.quarterSpacingCoef * sqrtFc ? d / 4 : d / 2;
  const Al = torsionNeglected ? 0 : (T * 2 * (x1 + y1)) / (2 * Ac * p.fsAllow);

  return {
    ...c,
    method: 'eit',
    vc, vt, vtc: 0, vtNeglectLimit, torsionNeglected,
    alphaT: 1,
    vExcess,
    shearSectionOk: v <= c.vMax,
    vtMax,
    torsionSectionOk: vt <= vtMax,
    vCombinedMax,
    combinedOk: v + vt <= vCombinedMax,
    avs, ats,
    avsMin: E.AvMinRatio * b,
    sMaxShear, sMaxTorsion: null, sMax: sMaxShear,
    AlStrength: Al, AlMin: 0, Al,
  };
}

/** แบ่ง Al ลงผิวบน/ล่าง/ข้าง — h < 60 ซม. แบ่งครึ่งบนล่าง, h ≥ 60 ซม. แบ่ง ⅓ รวมเหล็กข้าง */
export function distributeAl(Al: number, h: number): { top: number; bottom: number; side: number } {
  if (Al <= 0) return { top: 0, bottom: 0, side: 0 };
  if (h < 60) return { top: Al / 2, bottom: Al / 2, side: 0 };
  return { top: Al / 3, bottom: Al / 3, side: Al / 3 };
}
