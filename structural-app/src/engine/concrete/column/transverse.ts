/** เหล็กปลอกเดี่ยว / ปลอกเกลียวของเสา */
import { ACI318_WSD as C, ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';
import { REBARS, type BarName } from '../rebar';
import type { ColumnGeometry } from './geometry';
import type { ColumnInput } from './types';

export interface TieRequirement {
  minDia: number;
  /** min(16db, 48dt, ด้านแคบ) */
  sMax: number;
  /** ปัดลงทีละ 2.5 ซม. */
  spacing: number;
}

export function tieRequirement(input: ColumnInput, geom: ColumnGeometry, size: BarName): TieRequirement {
  const dbMax = geom.bars.reduce((m, b) => Math.max(m, b.dia), 0) || REBARS[input.mainBar].dia;
  const dt = REBARS[size].dia;
  const sMax = Math.min(K.tieSpacingDb * dbMax, K.tieSpacingDt * dt, Math.min(input.b, input.h));
  const spacing = Math.max(C.spacingStep, Math.floor(sMax / C.spacingStep + 1e-9) * C.spacingStep);
  return { minDia: K.tieMinDia, sMax, spacing };
}

export interface SpiralRequirement {
  minDia: number;
  /** เส้นผ่านศูนย์กลางแกนเสา (ขอบนอกเกลียว) */
  Dc: number;
  rhoMin: number;
  pitchMaxStrength: number;
  pitchMax: number;
  pitchMin: number;
  /** ปัดลงทีละ 0.5 ซม. */
  spacing: number;
}

export function spiralRequirement(input: ColumnInput, size: BarName): SpiralRequirement {
  const { dia, area } = REBARS[size];
  const Dc = input.D - 2 * input.cover;
  const Ac = (Math.PI * Dc * Dc) / 4;
  const Ag = (Math.PI * input.D ** 2) / 4;
  const rhoMin = ((K.spiralRhoCoef * (Ag / Ac - 1) * input.fc) / input.fyv);
  const pitchMaxStrength = (4 * area) / (Dc * rhoMin);
  const pitchMax = Math.min(pitchMaxStrength, K.spiralClearMax + dia);
  const spacing = Math.floor(pitchMax / K.spiralPitchStep + 1e-9) * K.spiralPitchStep;
  return { minDia: K.spiralMinDia, Dc, rhoMin, pitchMaxStrength, pitchMax, pitchMin: K.spiralClearMin + dia, spacing };
}

export function spiralRho(input: ColumnInput, size: BarName, pitch: number): number {
  const Dc = input.D - 2 * input.cover;
  return (4 * REBARS[size].area) / (Dc * pitch);
}
