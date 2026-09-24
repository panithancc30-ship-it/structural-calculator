import { REBARS, isBarName } from './rebar';
import type { BeamInput } from './types';

type NumericKey = 'b' | 'h' | 'L' | 'cover' | 'fc' | 'fy' | 'fyv' | 'M' | 'V' | 'T' | 'sMin';

const RANGES: Record<NumericKey, [number, number, string]> = {
  b: [15, 200, 'ความกว้าง b'],
  h: [20, 300, 'ความลึก h'],
  L: [0.5, 30, 'ความยาว L'],
  cover: [1.5, 10, 'ระยะหุ้ม covering'],
  fc: [100, 700, "f′c"],
  fy: [2000, 6000, 'fy เหล็กยืน'],
  fyv: [2000, 6000, 'fy เหล็กปลอก'],
  M: [0, 1e7, 'โมเมนต์ M'],
  V: [0, 1e7, 'แรงเฉือน V'],
  T: [0, 1e7, 'แรงบิด T'],
  sMin: [5, 30, 'ระยะปลอกต่ำสุด'],
};

/** คืนรายการข้อผิดพลาด (ว่าง = ใช้คำนวณได้) */
export function validateInput(input: BeamInput): string[] {
  const errors: string[] = [];
  for (const [key, [min, max, label]] of Object.entries(RANGES) as [NumericKey, [number, number, string]][]) {
    const value = input[key];
    if (!Number.isFinite(value)) errors.push(`${label}: กรุณากรอกตัวเลข`);
    else if (value < min || value > max) errors.push(`${label}: ต้องอยู่ระหว่าง ${min} – ${max}`);
  }
  if (!isBarName(input.mainBar) || !isBarName(input.stirrupBar)) {
    errors.push('ขนาดเหล็กไม่ถูกต้อง');
    return errors;
  }
  if (errors.length === 0) {
    const ds = REBARS[input.stirrupBar].dia;
    const db = REBARS[input.mainBar].dia;
    const clearWidth = input.b - 2 * (input.cover + ds);
    if (clearWidth < 2 * db + 2.5) errors.push('ความกว้าง b แคบเกินไปสำหรับเหล็ก 2 เส้น');
    if (input.h - 2 * (input.cover + ds) < 2 * db + 2.5) errors.push('ความลึก h น้อยเกินไป');
  }
  return errors;
}
