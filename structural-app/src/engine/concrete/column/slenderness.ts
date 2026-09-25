/** ผลความชะลูด — ตัวคูณลดกำลังเสายาว R ตามมาตรฐาน วสท. (วิธีหน่วยแรงใช้งาน) */
import { ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';
import type { ColumnInput } from './types';

export interface AxisSlenderness {
  axis: 'x' | 'y';
  r: number;
  /** Lu/r */
  ratio: number;
  /** Lu/r ที่ R เริ่มน้อยกว่า 1 */
  limit: number;
  slender: boolean;
  tooSlender: boolean;
  /** 1.32 − 0.006·Lu/r ≤ 1.0 */
  R: number;
}

/**
 * @param axis 'x' = ดัดรอบแกน x (ใช้ความลึก h), 'y' = รอบแกน y (ใช้ b)
 * @param depth ขนาดหน้าตัดในทิศที่ดัด (ซม.)
 */
export function axisSlenderness(input: ColumnInput, axis: 'x' | 'y', depth: number): AxisSlenderness {
  const r = input.shape === 'circle' ? K.radiusGyrationCircle * input.D : K.radiusGyrationRect * depth;
  const ratio = (input.Lu * 100) / r;
  const limit = (K.longColumnRA - 1) / K.longColumnRB;
  const R = Math.min(1, K.longColumnRA - K.longColumnRB * ratio);
  return { axis, r, ratio, limit, slender: ratio > limit, tooSlender: ratio > K.slenderMax, R };
}
