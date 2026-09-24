import { REBARS, isBarName } from '../rebar';
import type { ColumnInput } from './types';

type NumericKey = { [K in keyof ColumnInput]: ColumnInput[K] extends number ? K : never }[keyof ColumnInput];

const RANGES: Partial<Record<NumericKey, [number, number, string]>> = {
  cover: [2, 10, 'ระยะหุ้ม covering'],
  Lu: [0.5, 30, 'ความสูงเสา Lu'],
  fc: [100, 700, "f′c"],
  fy: [2000, 6000, 'fy เหล็กยืน'],
  fyv: [2000, 6000, 'fy เหล็กปลอก'],
  P: [0, 1e8, 'แรงอัด P'],
  Mx: [-1e7, 1e7, 'โมเมนต์ Mx'],
  My: [-1e7, 1e7, 'โมเมนต์ My'],
};

export function validateColumnInput(input: ColumnInput): string[] {
  const errors: string[] = [];
  const ranges: [NumericKey, [number, number, string]][] = [
    ...(Object.entries(RANGES) as [NumericKey, [number, number, string]][]),
    ...(input.shape === 'rect'
      ? ([['b', [15, 300, 'ด้าน b']], ['h', [15, 300, 'ด้าน h']]] as [NumericKey, [number, number, string]][])
      : ([['D', [20, 300, 'เส้นผ่านศูนย์กลาง D']]] as [NumericKey, [number, number, string]][])),
  ];
  for (const [key, [min, max, label]] of ranges) {
    const value = input[key];
    if (!Number.isFinite(value)) errors.push(`${label}: กรุณากรอกตัวเลข`);
    else if (value < min || value > max) errors.push(`${label}: ต้องอยู่ระหว่าง ${min} – ${max}`);
  }
  if (!isBarName(input.mainBar) || !isBarName(input.tieBar)) {
    errors.push('ขนาดเหล็กไม่ถูกต้อง');
    return errors;
  }
  if (errors.length === 0) {
    const inner = 2 * (input.cover + REBARS[input.tieBar].dia) + 2 * REBARS[input.mainBar].dia + 4;
    const least = input.shape === 'rect' ? Math.min(input.b, input.h) : input.D * 0.7;
    if (least < inner) errors.push('หน้าตัดเสาเล็กเกินไปสำหรับขนาดเหล็กและระยะหุ้ม');
  }
  return errors;
}
