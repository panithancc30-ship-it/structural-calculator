import { ACI318_WSD as C } from '../codes/aci318Wsd';
import { REBARS, STIRRUP_BAR_SIZES, type BarName } from '../rebar';
import type { BeamInput, StirrupSpec } from '../types';
import { cmToM } from '../format';
import type { ShearTorsionDemand } from './shearTorsion';

export interface StirrupCapacity {
  /** ระยะสูงสุดตามกำลัง (Infinity ถ้าไม่ต้องการเหล็กรับแรง) */
  sStrength: number;
  /** ระยะสูงสุดจากปริมาณเหล็กปลอกขั้นต่ำ */
  sAreaMin: number;
  sMax: number;
  /** min ของทุกข้อจำกัด */
  sRaw: number;
  /** ปัดลงทีละ 2.5 ซม. */
  spacing: number;
}

/**
 * ระยะเหล็กปลอกที่ยอมให้
 * - 1 ปลอก (2 ขา):  2Ab/s ≥ Av/s + 2At/s
 * - 2 ปลอก (4 ขา):  ขาปลอกนอกต้องรับ At + Av/4 → 4Ab/s ≥ Av/s + 4At/s
 *   (แรงบิดใช้ได้เฉพาะปลอกนอกที่ปิดรอบหน้าตัด)
 * ปริมาณขั้นต่ำ (ทุกขารวมกัน) ตามวิธีที่ใช้: ACI 3.5·b·s/fy, ว.ส.ท. 0.0015·b·s
 */
export function stirrupSpacing(demand: ShearTorsionDemand, size: BarName, count: 1 | 2): StirrupCapacity {
  const Ab = REBARS[size].area;
  const need = count === 1 ? demand.avs + 2 * demand.ats : demand.avs + 4 * demand.ats;
  const sStrength = need > 0 ? (2 * count * Ab) / need : Infinity;
  const sAreaMin = (2 * count * Ab) / demand.avsMin;
  const sRaw = Math.min(sStrength, sAreaMin, demand.sMax);
  const spacing = Math.max(C.spacingStep, Math.floor(sRaw / C.spacingStep + 1e-9) * C.spacingStep);
  return { sStrength, sAreaMin, sMax: demand.sMax, sRaw, spacing };
}

export function stirrupText(spec: StirrupSpec): string {
  return `${spec.count === 2 ? '2-' : ''}${spec.size} @ ${cmToM(spec.spacing)}`;
}

export interface StirrupChoice {
  spec: StirrupSpec;
  capacity: StirrupCapacity;
  /** ระยะ ≥ s_min และผ่านกำลัง */
  constructible: boolean;
  suggestion: string | null;
}

function isConstructible(cap: StirrupCapacity, sMin: number): boolean {
  return cap.spacing >= sMin && cap.sRaw + 1e-9 >= cap.spacing;
}

/**
 * เลือกรูปแบบเหล็กปลอกที่ก่อสร้างง่ายที่สุด
 * ลำดับ (โหมดอัตโนมัติ): 1 ปลอกขนาดที่เลือก → 2 ปลอกขนาดเดียวกัน → เตือนพร้อมแนะนำขนาดที่ใหญ่ขึ้น
 * @param demandFor ความต้องการของหน้าตัดเมื่อใช้ปลอกขนาดนั้น (x1, y1 ขึ้นกับขนาดปลอก)
 */
export function chooseStirrup(input: BeamInput, demandFor: (size: BarName) => ShearTorsionDemand): StirrupChoice {
  const size = input.stirrupBar;
  const demand = demandFor(size);
  const cap1 = stirrupSpacing(demand, size, 1);
  const cap2 = stirrupSpacing(demand, size, 2);

  let count: 1 | 2;
  if (input.stirrupMode === 'single') count = 1;
  else if (input.stirrupMode === 'double') count = 2;
  // ปลอกในไม่ได้รับแรงบิด — ถ้า 2 ปลอกไม่ได้ระยะห่างขึ้น (แรงบิดคุม) ใช้ปลอกเดียวแล้วแนะนำขนาดที่ใหญ่ขึ้น
  else count = isConstructible(cap1, input.sMin) || cap2.spacing <= cap1.spacing ? 1 : 2;

  const capacity = count === 1 ? cap1 : cap2;
  const constructible = isConstructible(capacity, input.sMin);

  let suggestion: string | null = null;
  if (!constructible) {
    const counts: (1 | 2)[] = input.stirrupMode === 'single' ? [1] : input.stirrupMode === 'double' ? [2] : [1, 2];
    const larger = STIRRUP_BAR_SIZES.slice(STIRRUP_BAR_SIZES.indexOf(size) + 1);
    outer: for (const s of larger) {
      const dm = demandFor(s);
      for (const c of counts) {
        const cap = stirrupSpacing(dm, s, c);
        if (isConstructible(cap, input.sMin)) {
          suggestion = `แนะนำใช้ปลอก ${stirrupText({ size: s, count: c, spacing: cap.spacing })} ม.`;
          break outer;
        }
      }
    }
    suggestion ??= 'เหล็กปลอกไม่พอ — ควรขยายขนาดหน้าตัดคาน';
  }

  return { spec: { size, count, spacing: capacity.spacing }, capacity, constructible, suggestion };
}
