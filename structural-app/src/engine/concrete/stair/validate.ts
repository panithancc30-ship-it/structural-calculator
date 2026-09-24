import { ACI318_WSD_SLAB as KS, ACI318_WSD_STAIR as K } from '../codes/aci318Wsd';
import { isBarName, REBARS } from '../rebar';
import { SIZE_MODES } from '../slab/validate';
import { stairProfile } from './geometry';
import type { StairInput } from './types';

type NumericKey = { [P in keyof StairInput]: StairInput[P] extends number ? P : never }[keyof StairInput];
type Range = [NumericKey, [number, number, string]];

export const STAIR_ENDS = ['simple', 'continuous'] as const;
export const STAIR_ASCENDS = ['right', 'left'] as const;
export const STAIR_USAGES = ['residential', 'public'] as const;
export { SIZE_MODES };

const includes = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value);

const RANGES: Range[] = [
  ['riser', [10, 25, 'ลูกตั้ง R']],
  ['tread', [15, 45, 'ลูกนอน T']],
  ['risers', [2, 30, 'จำนวนลูกตั้ง']],
  ['landingLow', [K.minLanding, 800, 'ส่วนราบปลายล่าง']],
  ['landingHigh', [K.minLanding, 800, 'ส่วนราบปลายบน']],
  ['width', [50, 600, 'ความกว้างบันได']],
  ['cover', [1, 10, 'ระยะหุ้ม covering']],
  ['fc', [100, 700, 'f′c']],
  ['fy', [2000, 6000, 'fy']],
  ['finishDL', [0, 2000, 'น้ำหนักวัสดุปูผิว']],
  ['LL', [0, 5000, 'น้ำหนักบรรทุกจร']],
];

export function validateStairInput(input: StairInput): string[] {
  const errors: string[] = [];

  if (!includes(STAIR_ENDS, input.endLow) || !includes(STAIR_ENDS, input.endHigh)) errors.push('สภาพปลายบันไดไม่ถูกต้อง');
  if (!includes(STAIR_ASCENDS, input.ascend)) errors.push('ทิศขึ้นบันไดไม่ถูกต้อง');
  if (!includes(STAIR_USAGES, input.usage)) errors.push('ประเภทอาคารไม่ถูกต้อง');
  if (!includes(SIZE_MODES, input.thicknessMode)) errors.push('รูปแบบความหนาไม่ถูกต้อง');
  if (!isBarName(input.bar) || !isBarName(input.tempBar)) errors.push('ขนาดเหล็กไม่ถูกต้อง');
  if (errors.length > 0) return errors;

  const ranges: Range[] = [...RANGES];
  if (input.thicknessMode === 'manual') ranges.push(['t', [K.absMinThickness, KS.autoMaxThickness, 'ความหนา t']]);

  for (const [key, [min, max, label]] of ranges) {
    const value = input[key];
    if (!Number.isFinite(value)) errors.push(`${label}: กรุณากรอกตัวเลข`);
    else if (value < min || value > max) errors.push(`${label}: ต้องอยู่ระหว่าง ${min} – ${max}`);
  }
  if (errors.length > 0) return errors;

  if (!Number.isInteger(input.risers)) errors.push('จำนวนลูกตั้งต้องเป็นจำนวนเต็ม');
  if (input.riser > input.tread) errors.push('ลูกตั้งสูงกว่าลูกนอน — บันไดชันเกิน 45°');
  // ขอบพื้นชั้นบนทำหน้าที่เป็นขั้นบนสุด ถ้าสั้นกว่าลูกนอน ท้องบันไดจะหักมุมเลยคานรองรับออกไป
  if (input.landingHigh < input.tread) {
    errors.push(`ส่วนราบปลายบนต้องยาวไม่น้อยกว่าลูกนอน (${input.tread} ซม.) — ขอบพื้นชั้นบนนับเป็นขั้นบนสุด`);
  }

  // ตรวจเฉพาะความหนาที่ผู้ใช้กำหนดเอง — โหมดอัตโนมัติการค้นหาความหนารับประกันเรื่องนี้ให้อยู่แล้ว
  if (input.thicknessMode === 'manual') {
    const d = input.t - input.cover - REBARS[input.bar].dia / 2;
    if (d <= KS.minEffectiveDepth) errors.push('ท้องบันไดบางเกินไปสำหรับระยะหุ้มและขนาดเหล็กที่กำหนด');
  }

  return errors;
}

/** คำเตือนที่ไม่ถึงกับผิด แต่ควรบอกผู้ใช้ — แสดงใต้แผงกรอกข้อมูล */
export function stairWarnings(input: StairInput): string[] {
  const warnings: string[] = [];
  const { L } = stairProfile(input);
  if (L > 600) {
    warnings.push(`ช่วงราบ ${(L / 100).toFixed(2)} ม. ยาวมาก — ควรพิจารณาเพิ่มคานรับชานพักกลางช่วง`);
  }

  // เหล็กกลม (RB) ในไทยเป็นชั้นคุณภาพ SR24 ส่วนเหล็กข้ออ้อย (DB) เป็น SD30 ขึ้นไป
  const kinds = [input.bar, input.tempBar].filter(isBarName).map((b) => REBARS[b].kind);
  if (kinds.includes('RB') && input.fy > 2400) {
    warnings.push(`เลือกเหล็กกลม RB แต่ตั้ง fy = ${input.fy} ksc — เหล็กกลมตาม มอก. เป็น SR24 (fy 2,400 ksc)`);
  }
  if (kinds.length > 0 && kinds.every((k) => k === 'DB') && input.fy < 3000) {
    warnings.push(`เลือกเหล็กข้ออ้อย DB แต่ตั้ง fy = ${input.fy} ksc — เหล็กข้ออ้อยตาม มอก. เริ่มที่ SD30 (fy 3,000 ksc)`);
  }
  return warnings;
}
