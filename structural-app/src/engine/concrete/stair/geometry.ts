import type { SupportCondition } from '../types';
import type { StairEnd, StairInput } from './types';

type Shape = Pick<StairInput, 'riser' | 'tread' | 'risers' | 'landingLow' | 'landingHigh'>;

export interface StairProfile {
  /** มุมลาด (เรเดียน) */
  theta: number;
  cos: number;
  sin: number;
  tan: number;
  /** ความสูงของช่วงบันได N·R */
  rise: number;
  /** ความยาวราบของขั้นบันได (N−1)·T */
  run: number;
  /** ช่วงราบระหว่างศูนย์กลางที่รองรับ */
  L: number;
  /** ความยาวช่วงลาดตามแนวเอียง */
  slopeLength: number;
  /** x ของลูกตั้งขั้นแรกและขั้นสุดท้าย วัดจากศูนย์กลางที่รองรับปลายล่าง */
  xFirst: number;
  xLast: number;
}

export function stairProfile(s: Shape): StairProfile {
  const theta = Math.atan2(s.riser, s.tread);
  const run = (s.risers - 1) * s.tread;
  const cos = Math.cos(theta);
  return {
    theta,
    cos,
    sin: Math.sin(theta),
    tan: s.riser / s.tread,
    rise: s.risers * s.riser,
    run,
    L: s.landingLow + run + s.landingHigh,
    slopeLength: run / cos,
    xFirst: s.landingLow,
    xLast: s.landingLow + run,
  };
}

/** ยุบสภาพปลายสองด้านให้เป็นสภาพรองรับแบบเดียวกับพื้น เพื่อใช้ตารางสัมประสิทธิ์ชุดเดียวกัน */
export function stairSupport(endLow: StairEnd, endHigh: StairEnd): SupportCondition {
  const continuous = [endLow, endHigh].filter((e) => e === 'continuous').length;
  if (continuous === 2) return 'bothEnds';
  return continuous === 1 ? 'oneEnd' : 'simple';
}

export const degrees = (rad: number) => (rad * 180) / Math.PI;
