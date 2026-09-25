import { isBarName } from '../rebar';
import { validateInput } from '../validate';
import { ledgeSectionInputs } from './analyzeLedge';
import { ledgeLoads } from './loads';
import { LEDGE_SUPPORTS, type LedgeBeamInput } from './types';

type NumericKey = { [K in keyof LedgeBeamInput]-?: LedgeBeamInput[K] extends number ? K : never }[keyof LedgeBeamInput];

const RANGES: Record<NumericKey, [number, number, string]> = {
  slabLength: [0.1, 5, 'ความยาวพื้นยื่น Lc'],
  slabT: [5, 50, 'ความหนาพื้นยื่น'],
  finishDL: [0, 2000, 'น้ำหนักวัสดุปูผิว'],
  LL: [0, 3000, 'น้ำหนักใช้งาน'],
  tipWallH: [0, 5, 'ความสูงผนังปลายพื้นยื่น'],
  tipWallW: [0, 1000, 'น้ำหนักผนังปลายพื้นยื่น'],
  beamWallH: [0, 10, 'ความสูงผนังบนคาน'],
  beamWallW: [0, 1000, 'น้ำหนักผนังบนคาน'],
  otherLoad: [0, 1e5, 'น้ำหนักอื่นลงคาน'],
  b: [15, 200, 'ความกว้าง b'],
  h: [20, 300, 'ความลึก h'],
  L: [0.5, 30, 'ช่วงคาน L'],
  cover: [1.5, 10, 'ระยะหุ้ม covering'],
  fc: [100, 700, 'f′c'],
  fy: [2000, 6000, 'fy เหล็กยืน'],
  fyv: [2000, 6000, 'fy เหล็กปลอก'],
  sMin: [5, 30, 'ระยะปลอกต่ำสุด'],
};

/** คืนรายการข้อผิดพลาด (ว่าง = ใช้คำนวณได้) */
export function validateLedgeInput(input: LedgeBeamInput): string[] {
  const errors: string[] = [];
  for (const [key, [min, max, label]] of Object.entries(RANGES) as [NumericKey, [number, number, string]][]) {
    const value = input[key];
    if (!Number.isFinite(value)) errors.push(`${label}: กรุณากรอกตัวเลข`);
    else if (value < min || value > max) errors.push(`${label}: ต้องอยู่ระหว่าง ${min} – ${max}`);
  }
  if (!LEDGE_SUPPORTS.includes(input.support)) errors.push('สภาพรองรับไม่ถูกต้อง');
  if (!isBarName(input.mainBar) || !isBarName(input.stirrupBar)) errors.push('ขนาดเหล็กไม่ถูกต้อง');
  if (errors.length > 0) return errors;

  // ตรวจขนาดหน้าตัดเทียบเหล็กและช่วงของแรงภายในด้วยกฎเดียวกับคาน คสล.
  const sections = ledgeSectionInputs(input, ledgeLoads(input));
  return [...new Set([...validateInput(sections.A), ...validateInput(sections.B)])];
}
