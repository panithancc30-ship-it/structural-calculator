import { ACI318_WSD_FOOTING as K } from '../codes/aci318Wsd';
import { fmt } from '../format';
import { REBARS, isBarName } from '../rebar';
import { columnLocation } from './geometry';
import type { FootingInput } from './types';

type NumericKey = { [P in keyof FootingInput]: FootingInput[P] extends number ? P : never }[keyof FootingInput];
type Range = [NumericKey, [number, number, string]];

export const POSITIONS = ['center', 'offset', 'edge', 'corner'] as const;
export const EDGE_SIDES = ['left', 'right', 'bottom', 'top'] as const;
export const CORNER_SIDES = ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const;
export const SIZE_MODES = ['auto', 'manual'] as const;

const includes = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value);

const RANGES: Range[] = [
  ['cx', [15, 300, 'ด้านเสา cx']],
  ['cy', [15, 300, 'ด้านเสา cy']],
  ['cover', [5, 15, 'ระยะหุ้ม covering']],
  ['Df', [0, 10, 'ความลึกฐานราก Df']],
  ['qa', [1, 200, 'qa ดิน']],
  ['gammaSoil', [1, 2.5, 'หน่วยน้ำหนักดิน γs']],
  ['fc', [100, 700, 'f′c']],
  ['fy', [2000, 6000, 'fy']],
  ['P', [0, 1e8, 'แรงอัด P']],
  ['Mx', [-1e7, 1e7, 'โมเมนต์ Mx']],
  ['My', [-1e7, 1e7, 'โมเมนต์ My']],
];

export function validateFootingInput(input: FootingInput): string[] {
  const errors: string[] = [];
  if (!includes(POSITIONS, input.position) || !includes(EDGE_SIDES, input.edgeSide) || !includes(CORNER_SIDES, input.cornerSide)) {
    errors.push('ตำแหน่งเสาไม่ถูกต้อง');
  }
  if (!includes(SIZE_MODES, input.sizeMode)) errors.push('รูปแบบขนาดฐานรากไม่ถูกต้อง');
  if (!isBarName(input.bar)) errors.push('ขนาดเหล็กไม่ถูกต้อง');
  if (errors.length > 0) return errors;

  const ranges: Range[] = [...RANGES];
  if (input.position === 'offset') ranges.push(['ex', [-1500, 1500, 'ระยะเยื้อง ex']], ['ey', [-1500, 1500, 'ระยะเยื้อง ey']]);
  if (input.position === 'edge' || input.position === 'corner') ranges.push(['edgeGap', [0, 100, 'ระยะผิวเสาถึงขอบฐาน']]);
  const manual = input.sizeMode === 'manual';
  if (manual) ranges.push(['B', [50, K.autoMaxSpan, 'ด้าน B']], ['L', [50, K.autoMaxSpan, 'ด้าน L']], ['t', [20, K.autoMaxThickness, 'ความหนา t']]);

  for (const [key, [min, max, label]] of ranges) {
    const value = input[key];
    if (!Number.isFinite(value)) errors.push(`${label}: กรุณากรอกตัวเลข`);
    else if (value < min || value > max) errors.push(`${label}: ต้องอยู่ระหว่าง ${min} – ${max}`);
  }
  if (errors.length > 0) return errors;

  const t = manual ? input.t : K.autoMinThickness;
  const selfWeight = (t * K.concreteUnitWeight + Math.max(0, input.Df * 100 - t) * input.gammaSoil) / 100;
  if (input.qa <= selfWeight) {
    errors.push(`qa ต้องมากกว่าน้ำหนักฐานรากและดินถม ${fmt(selfWeight, 2)} t/m²`);
  }
  if (manual) {
    const ov = columnLocation(input, input).overhang;
    if (Math.min(ov.left, ov.right, ov.bottom, ov.top) < -1e-6) errors.push('เสาอยู่นอกฐานราก — ขยาย B, L หรือลดระยะเยื้องศูนย์');
    if (input.t - input.cover - 2 * REBARS[input.bar].dia < 5) {
      errors.push('ฐานรากบางเกินไปสำหรับระยะหุ้มและขนาดเหล็ก');
    }
  }
  return errors;
}
