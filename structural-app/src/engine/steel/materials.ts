/**
 * คุณสมบัติวัสดุเหล็กโครงสร้างที่ใช้ในประเทศไทย
 * หน่วย: ksc (กก./ตร.ซม.)
 */

/** โมดูลัสยืดหยุ่นของเหล็ก E = 2,040,000 ksc (≈ 200 GPa) */
export const E_STEEL = 2_040_000

/** โมดูลัสเฉือนของเหล็ก G = 810,000 ksc (≈ 79 GPa) */
export const G_STEEL = 810_000

/** หน่วยน้ำหนักเหล็ก 7,850 กก./ลบ.ม. → 1 ตร.ซม. ยาว 1 ม. หนัก 0.785 กก. */
export const STEEL_UNIT_WEIGHT = 0.785

export interface SteelGrade {
  id: string
  label: string
  /** กำลังคราก (ksc) */
  Fy: number
  /** กำลังประลัย (ksc) */
  Fu: number
  /** ขึ้นรูปเย็น — ต้องออกแบบตาม AISI (ลดหน้าตัดประสิทธิผล) */
  coldFormed: boolean
  note: string
}

export const STEEL_GRADES: SteelGrade[] = [
  {
    id: 'SS400',
    label: 'SS400 / SM400 (มอก. 1227, 116)',
    Fy: 2400,
    Fu: 4100,
    coldFormed: false,
    note: 'เหล็กรูปพรรณรีดร้อนทั่วไปที่ใช้มากที่สุดในไทย',
  },
  {
    id: 'SM490',
    label: 'SM490 (มอก. 1227)',
    Fy: 3200,
    Fu: 4900,
    coldFormed: false,
    note: 'เหล็กกำลังสูง ใช้กับช่วงยาวหรือรับแรงมาก',
  },
  {
    id: 'SM520',
    label: 'SM520 (มอก. 1227)',
    Fy: 3600,
    Fu: 5200,
    coldFormed: false,
    note: 'เหล็กกำลังสูงพิเศษ',
  },
  {
    id: 'SSC400',
    label: 'SSC400 — ขึ้นรูปเย็น (มอก. 1228)',
    Fy: 2400,
    Fu: 4100,
    coldFormed: true,
    note: 'เหล็กตัวซี/กล่อง ขึ้นรูปเย็น ตรวจหน้าตัดประสิทธิผลตาม AISI',
  },
  {
    id: 'G300',
    label: 'G300 — เหล็กแผ่นเคลือบ (มอก. 2753)',
    Fy: 3000,
    Fu: 3400,
    coldFormed: true,
    note: 'เกรดขั้นต่ำที่พบในแปหมวกและแปสำเร็จรูปทั่วไป — ตรวจเกรดจริงจากฉลากสินค้า',
  },
  {
    id: 'G550',
    label: 'G550 — เหล็กชุบกัลวาไนซ์กำลังสูง (โครงหลังคาสำเร็จรูป)',
    Fy: 5500,
    Fu: 5500,
    coldFormed: true,
    note: 'ใช้ในโครงหลังคาสำเร็จรูปและแปสำเร็จรูป (เช่น SCG / CPAC) — ออกแบบตาม AISI',
  },
]

/** ความหนาที่ต่ำกว่านี้ เหล็ก G550 ต้องลดกำลังครากที่ใช้ออกแบบ (ซม.) */
const G550_THIN_LIMIT = 0.09

/**
 * กำลังครากที่ใช้ออกแบบ
 * เหล็ก G550 ที่บางกว่า 0.9 มม. มีความเหนียวต่ำ มาตรฐาน AS/NZS 4600 และ AISI S100 A2.3.2
 * จึงให้ใช้เพียง 75% ของ Fy (ไม่เกิน 4,220 ksc) = 4,125 ksc
 */
export function designYield(grade: SteelGrade, thickness: number): { Fy: number; reduced: boolean } {
  if (grade.id === 'G550' && thickness < G550_THIN_LIMIT) {
    return { Fy: Math.min(0.75 * grade.Fy, 4220), reduced: true }
  }
  return { Fy: grade.Fy, reduced: false }
}

export function getGrade(id: string): SteelGrade {
  const grade = STEEL_GRADES.find((g) => g.id === id)
  if (!grade) throw new Error(`ไม่พบเกรดเหล็ก: ${id}`)
  return grade
}

export const STEEL_RANGE = {
  Fy: { min: 2000, max: 6000 },
  Fu: { min: 3000, max: 7000 },
} as const
