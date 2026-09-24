import { ACI318_WSD_PILECAP as K } from '../codes/aci318Wsd';
import { isBarName, REBARS } from '../rebar';
import type { PileCapInput } from './types';

type NumericKey = { [P in keyof PileCapInput]: PileCapInput[P] extends number ? P : never }[keyof PileCapInput];
type Range = [NumericKey, [number, number, string]];

export const PILE_SHAPES = ['square', 'circle'] as const;
export const AUTO_MODES = ['auto', 'manual'] as const;

const includes = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value);

const RANGES: Range[] = [
  ['cx', [15, 300, 'ด้านเสา cx']],
  ['cy', [15, 300, 'ด้านเสา cy']],
  ['ex', [-500, 500, 'ระยะเยื้อง ex']],
  ['ey', [-500, 500, 'ระยะเยื้อง ey']],
  ['pileSize', [10, 150, 'ขนาดเสาเข็ม']],
  ['pileCapacity', [0.5, 1000, 'น้ำหนักบรรทุกปลอดภัยเสาเข็ม']],
  ['pileTension', [0, 1000, 'แรงถอนที่ยอมให้']],
  ['spacing', [20, 1000, 'ระยะห่างเสาเข็ม']],
  ['edge', [10, 300, 'ระยะศูนย์เข็มถึงขอบฐาน']],
  ['cover', [5, 20, 'ระยะหุ้ม covering']],
  ['embed', [0, 20, 'ระยะหัวเข็มฝังในฐานราก']],
  ['Df', [0, 10, 'ความลึกฐานราก Df']],
  ['gammaSoil', [1, 2.5, 'หน่วยน้ำหนักดิน γs']],
  ['fc', [100, 700, 'f′c']],
  ['fy', [2000, 6000, 'fy']],
  ['P', [0, 1e8, 'แรงอัด P']],
  ['Mx', [-1e7, 1e7, 'โมเมนต์ Mx']],
  ['My', [-1e7, 1e7, 'โมเมนต์ My']],
];

export function validatePileCapInput(input: PileCapInput): string[] {
  const errors: string[] = [];
  if (!includes(PILE_SHAPES, input.pileShape)) errors.push('รูปหน้าตัดเสาเข็มไม่ถูกต้อง');
  if (!includes(AUTO_MODES, input.countMode) || !includes(AUTO_MODES, input.thicknessMode)) errors.push('รูปแบบการออกแบบไม่ถูกต้อง');
  if (!isBarName(input.bar)) errors.push('ขนาดเหล็กไม่ถูกต้อง');
  if (!Array.isArray(input.offsets) || input.offsets.length < K.maxPiles) errors.push('ข้อมูลระยะเยื้องเสาเข็มไม่ครบ');
  if (errors.length > 0) return errors;

  const ranges: Range[] = [...RANGES];
  if (input.countMode === 'manual') ranges.push(['pileCount', [1, K.maxPiles, 'จำนวนเสาเข็ม']]);
  if (input.thicknessMode === 'manual') ranges.push(['t', [20, K.autoMaxThickness, 'ความหนา t']]);
  for (const [key, [min, max, label]] of ranges) {
    const value = input[key];
    if (!Number.isFinite(value)) errors.push(`${label}: กรุณากรอกตัวเลข`);
    else if (value < min || value > max) errors.push(`${label}: ต้องอยู่ระหว่าง ${min} – ${max}`);
  }
  if (input.countMode === 'manual' && !Number.isInteger(input.pileCount)) errors.push('จำนวนเสาเข็มต้องเป็นจำนวนเต็ม');
  input.offsets.slice(0, K.maxPiles).forEach((o, i) => {
    if (!Number.isFinite(o?.dx) || !Number.isFinite(o?.dy) || Math.abs(o.dx) > 200 || Math.abs(o.dy) > 200) {
      errors.push(`ระยะเยื้องเข็มต้นที่ ${i + 1}: ต้องอยู่ระหว่าง −200 – 200 ซม.`);
    }
  });
  if (errors.length > 0) return errors;

  if (input.edge < input.pileSize / 2) errors.push('ระยะศูนย์เข็มถึงขอบฐานต้องไม่น้อยกว่าครึ่งขนาดเข็ม');
  if (input.embed >= input.cover) errors.push('ระยะหุ้มต้องมากกว่าระยะหัวเข็มฝังในฐานราก (เหล็กล่างวางเหนือหัวเข็ม)');
  if (input.thicknessMode === 'manual' && input.t - input.cover - 2 * REBARS[input.bar].dia < 5) {
    errors.push('ฐานรากบางเกินไปสำหรับระยะหุ้มและขนาดเหล็ก');
  }
  return errors;
}
