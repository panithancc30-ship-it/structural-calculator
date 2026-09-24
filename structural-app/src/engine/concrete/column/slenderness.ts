/** ผลความชะลูด — moment magnifier (ACI 318-89 10.10–10.11, App. A.6: ใช้ 2.5P แทน Pu) */
import { ACI318_WSD as C, ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';
import type { ColumnInput } from './types';

export interface AxisSlenderness {
  axis: 'x' | 'y';
  k: number;
  r: number;
  ratio: number;
  limit: number;
  slender: boolean;
  tooSlender: boolean;
  EI: number;
  Pc: number;
  Cm: number;
  delta: number;
  stable: boolean;
  /** kg·cm */
  Mapplied: number;
  Mmin: number;
  Mdesign: number;
}

/**
 * k, M1/M2 และ βd ใช้ค่ากำหนดอัตโนมัติ (K.autoK, K.autoM1M2, K.autoBetaD)
 * @param axis 'x' = ดัดรอบแกน x (ใช้ความลึก h), 'y' = รอบแกน y (ใช้ b)
 * @param depth ขนาดหน้าตัดในทิศที่ดัด (ซม.)
 */
export function axisSlenderness(
  input: ColumnInput,
  axis: 'x' | 'y',
  Ig: number,
  depth: number,
  phi: number,
): AxisSlenderness {
  const Lu = input.Lu * 100;
  const k = K.autoK;
  const r = input.shape === 'circle' ? K.radiusGyrationCircle * input.D : K.radiusGyrationRect * depth;
  const ratio = (k * Lu) / r;
  const limit = K.slenderBracedA - K.slenderBracedB * K.autoM1M2;
  const Mapplied = Math.abs(axis === 'x' ? input.Mx : input.My) * 100;
  const Ec = C.EcCoef * Math.sqrt(input.fc);
  const EI = (K.EIcoef * Ec * Ig) / (1 + K.autoBetaD);
  const Pc = (Math.PI ** 2 * EI) / (k * Lu) ** 2;
  const slender = ratio > limit;

  let Cm = 1;
  let delta = 1;
  let stable = true;
  let Mmin = 0;
  let Mdesign = Mapplied;
  if (slender) {
    Cm = Math.max(K.CmMin, 0.6 + 0.4 * K.autoM1M2);
    const q = (K.slendernessLoadFactor * input.P) / (phi * Pc);
    stable = q < 1;
    delta = stable ? Math.max(1, Cm / (1 - q)) : Infinity;
    Mmin = input.P * (K.minEccBase + K.minEccCoef * depth);
    Mdesign = delta * Math.max(Mapplied, Mmin);
  }

  return {
    axis, k, r, ratio, limit, slender,
    tooSlender: ratio > K.slenderMax,
    EI, Pc, Cm, delta, stable, Mapplied, Mmin, Mdesign,
  };
}
