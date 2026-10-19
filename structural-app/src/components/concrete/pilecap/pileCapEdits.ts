import type { PileCapDims, PileCapInput } from '@/engine/concrete/pilecap/types';
import type { DimKey, DimPick } from './pileCapDrawingModel';

export const DIM_LABEL: Record<DimKey, string> = {
  B: 'ความกว้างฐานราก Bx',
  L: 'ความยาวฐานราก By',
  t: 'ความหนาฐานราก t',
  embed: 'ระยะหัวเข็มฝังในฐานราก',
  lean: 'ความหนาคอนกรีตหยาบ 1:3:5',
  sand: 'ความหนาทรายรองพื้น',
  edgeX: 'ระยะขอบฐานถึงศูนย์เข็ม (แนว x)',
  edgeY: 'ระยะขอบฐานถึงศูนย์เข็ม (แนว y)',
  spacingX: 'ระยะห่างเสาเข็ม (แนว x)',
  spacingY: 'ระยะห่างเสาเข็ม (แนว y)',
  ex: 'เยื้องศูนย์เสา ex',
  ey: 'เยื้องศูนย์เสา ey',
};

const r1 = (v: number) => Math.round(v * 10) / 10;

/**
 * ค่าที่กรอกจากการแตะตัวเลขบอกระยะ (ซม.) → ข้อมูลนำเข้าที่เปลี่ยน
 * ขนาด/ระยะขอบ → กำหนดขนาดฐานเอง (ขยายเท่ากันสองข้าง กลุ่มเข็มอยู่กลางฐาน), ความหนา → กำหนดเอง,
 * ช่วงระหว่างเข็ม → ระยะห่างเข็ม s ตามสัดส่วนของช่วงนั้น (เช่น เข็มสามเหลี่ยม ช่วง = s/2)
 */
export function dimEditPatch(input: PileCapInput, dims: PileCapDims, pick: DimPick, v: number, single: boolean): Partial<PileCapInput> {
  switch (pick.key) {
    case 'B':
      return { sizeMode: 'manual', B: r1(v), L: dims.L };
    case 'L':
      return { sizeMode: 'manual', B: dims.B, L: r1(v) };
    case 'edgeX':
      return { sizeMode: 'manual', B: r1(dims.B + 2 * (v - pick.value)), L: dims.L };
    case 'edgeY':
      return { sizeMode: 'manual', B: dims.B, L: r1(dims.L + 2 * (v - pick.value)) };
    case 'spacingX':
    case 'spacingY':
      return { spacing: r1(v / (pick.ratio ?? 1)) };
    case 't':
      return { thicknessMode: 'manual', t: r1(v) };
    case 'embed':
      return single ? { embedSingle: r1(v) } : { embed: r1(v) };
    case 'lean':
      return { lean: r1(v) };
    case 'sand':
      return { sand: r1(v) };
    case 'ex':
      return { ex: (Math.sign(input.ex) || 1) * r1(v) };
    case 'ey':
      return { ey: (Math.sign(input.ey) || 1) * r1(v) };
  }
}

/** ระยะนี้เปลี่ยนขนาดแปลน → แสดงปุ่มกลับไปใช้ขนาดอัตโนมัติ */
export const changesSize = (key: DimKey) => key === 'B' || key === 'L' || key === 'edgeX' || key === 'edgeY';
