import { ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import { isBarName, REBARS } from '../rebar';
import { edgesOf } from './geometry';
import type { SlabInput } from './types';

type NumericKey = { [P in keyof SlabInput]: SlabInput[P] extends number ? P : never }[keyof SlabInput];
type Range = [NumericKey, [number, number, string]];

export const SLAB_TYPES = ['oneWay', 'twoWay', 'cantilever', 'onGround'] as const;
export const EDGE_SUPPORTS = ['simple', 'continuous', 'free'] as const;
export const SIZE_MODES = ['auto', 'manual'] as const;
export const GROUND_USAGES = ['light', 'medium', 'heavy'] as const;

const includes = (list: readonly string[], value: unknown) => typeof value === 'string' && list.includes(value);

const RANGES: Range[] = [
  ['lx', [50, 1500, 'ช่วง lx']],
  ['ly', [50, 1500, 'ช่วง ly']],
  ['cover', [1, 10, 'ระยะหุ้ม covering']],
  ['fc', [100, 700, 'f′c']],
  ['fy', [2000, 6000, 'fy']],
  ['finishDL', [0, 2000, 'น้ำหนักวัสดุปูผิว']],
  ['LL', [0, 5000, 'น้ำหนักบรรทุกจร']],
];

export function validateSlabInput(input: SlabInput): string[] {
  const errors: string[] = [];

  if (!includes(SLAB_TYPES, input.slabType)) errors.push('ชนิดพื้นไม่ถูกต้อง');
  if (![input.edgeX1, input.edgeX2, input.edgeY1, input.edgeY2].every((e) => includes(EDGE_SUPPORTS, e))) {
    errors.push('สภาพขอบพื้นไม่ถูกต้อง');
  }
  if (!includes(SIZE_MODES, input.thicknessMode)) errors.push('รูปแบบความหนาไม่ถูกต้อง');
  if (!includes(GROUND_USAGES, input.usage)) errors.push('ระดับการใช้งานไม่ถูกต้อง');
  if (!isBarName(input.bar) || !isBarName(input.tempBar)) errors.push('ขนาดเหล็กไม่ถูกต้อง');
  if (errors.length > 0) return errors;

  const ranges: Range[] = [...RANGES];
  if (input.thicknessMode === 'manual') {
    ranges.push(['t', [K.absMinThickness[input.slabType], K.autoMaxThickness, 'ความหนา t']]);
  }

  for (const [key, [min, max, label]] of ranges) {
    const value = input[key];
    if (!Number.isFinite(value)) errors.push(`${label}: กรุณากรอกตัวเลข`);
    else if (value < min || value > max) errors.push(`${label}: ต้องอยู่ระหว่าง ${min} – ${max}`);
  }
  if (errors.length > 0) return errors;

  // พื้นยื่นต้องมีขอบยึดหนึ่งด้านและขอบอิสระตรงข้าม จึงจะมีระยะยื่นจริง
  if (input.slabType === 'cantilever') {
    const [a, b] = edgesOf(input, 'x');
    const oneFixed = (a === 'continuous' && b === 'free') || (a === 'free' && b === 'continuous');
    if (!oneFixed) errors.push('พื้นยื่น: ขอบตามแกน x ต้องเป็นยึดแน่นหนึ่งด้านและอิสระอีกด้าน');
  } else if ([input.edgeX1, input.edgeX2, input.edgeY1, input.edgeY2].includes('free')) {
    errors.push('ขอบอิสระใช้ได้เฉพาะพื้นยื่น');
  }

  // ตรวจเฉพาะความหนาที่ผู้ใช้กำหนดเอง — โหมดอัตโนมัติการค้นหาความหนารับประกันเรื่องนี้ให้อยู่แล้ว
  if (input.thicknessMode === 'manual') {
    const d = input.t - input.cover - REBARS[input.bar].dia / 2;
    const need = input.slabType === 'onGround' ? 0 : K.minEffectiveDepth;
    if (d <= need) errors.push('พื้นบางเกินไปสำหรับระยะหุ้มและขนาดเหล็กที่กำหนด');
  }

  return errors;
}

/** คำเตือนที่ไม่ถึงกับผิด แต่ควรบอกผู้ใช้ — แสดงใต้แผงกรอกข้อมูล */
export function slabWarnings(input: SlabInput): string[] {
  const warnings: string[] = [];
  const long = Math.max(input.lx, input.ly);
  const short = Math.min(input.lx, input.ly);
  const ratio = short > 0 ? long / short : 1;

  if (input.slabType === 'oneWay' && ratio < 2) {
    warnings.push(`อัตราส่วนด้าน ${ratio.toFixed(2)} < 2 — ตามปกติควรออกแบบเป็นพื้นสองทาง`);
  }
  if (input.slabType === 'twoWay' && ratio > 2) {
    warnings.push(`อัตราส่วนด้าน ${ratio.toFixed(2)} > 2 — ตามปกติควรออกแบบเป็นพื้นทางเดียว`);
  }

  // เหล็กกลม (RB) ในไทยเป็นชั้นคุณภาพ SR24 ส่วนเหล็กข้ออ้อย (DB) เป็น SD30 ขึ้นไป
  // โปรแกรมให้เลือกขนาดกับ fy แยกกัน จึงเตือนเมื่อจับคู่กันไม่ตรงตามปกติ
  const kinds = [input.bar, input.tempBar].map((b) => REBARS[b].kind);
  if (kinds.includes('RB') && input.fy > 2400) {
    warnings.push(`เลือกเหล็กกลม RB แต่ตั้ง fy = ${input.fy} ksc — เหล็กกลมตาม มอก. เป็น SR24 (fy 2,400 ksc)`);
  }
  if (kinds.every((k) => k === 'DB') && input.fy < 3000) {
    warnings.push(`เลือกเหล็กข้ออ้อย DB แต่ตั้ง fy = ${input.fy} ksc — เหล็กข้ออ้อยตาม มอก. เริ่มที่ SD30 (fy 3,000 ksc)`);
  }
  return warnings;
}
