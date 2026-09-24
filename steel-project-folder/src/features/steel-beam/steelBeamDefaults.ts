import type { SteelBeamInput } from '@/engine/steel/beamASD'
import { DEFAULT_CUSTOM_SECTION, type SectionSelection } from '@/engine/steel/section'
import { getSection, type SectionCategory } from '@/engine/steel/sectionTable'

export const DEFAULT_SECTION_SELECTION: SectionSelection = {
  source: 'table',
  sectionId: 'h-narrow:H300×150×6.5×9',
  arrangement: 'single',
  gap: 0,
  connectorSpacing: 60,
  gradeId: 'SS400',
  customFy: 2400,
  custom: DEFAULT_CUSTOM_SECTION,
}

export const DEFAULT_STEEL_BEAM_INPUT: SteelBeamInput = {
  moment: 3000,
  shear: 2000,
  axial: 0,
  span: 6,
  spanBasis: 'slope',
  memberAngle: 0,
  sectionAngle: 0,
  unbracedLength: 2,
  Cb: 1,
  sagRods: 'none',
  deflectionPattern: 'udl',
  deflectionLimit: 240,
  section: DEFAULT_SECTION_SELECTION,
}

export const DEFAULT_SUGGEST_CATEGORIES: SectionCategory[] = ['h-narrow', 'h-wide']

/** แปหมวกตั้งต้น — ขนาดตามข้อมูลผู้ขาย SCG/CPAC */
export const HAT_BATTEN_ID = 'hat:Ω65×30×0.55 (SCG/CPAC)'

/**
 * ค่าตั้งต้นสำเร็จรูปสำหรับงานที่พบบ่อย — ช่วยให้ผู้ใช้ไม่ต้องตั้งมุมเองทุกครั้ง
 * ความชัน 1:2 (26.57°) เป็นความชันหลังคากระเบื้องที่ใช้กันทั่วไปในไทย
 *
 * หมายเหตุ: จันทันที่วางตามแนวลาด "เอวตั้งดิ่ง" กับ "เอวตั้งฉากกับหลังคา" คือการวางแบบเดียวกัน
 * (ระนาบดิ่งที่ผ่านแกนจันทันตั้งฉากกับผิวหลังคาเสมอ) จึงใช้ θs = 0 — มุมหน้าตัดมีผลเฉพาะชิ้นส่วน
 * ที่วางขวางแนวลาด เช่น แป
 */
export const BEAM_PRESETS: Array<{
  id: string
  label: string
  description: string
  patch: Partial<SteelBeamInput>
}> = [
  {
    id: 'flat',
    label: 'คานราบ',
    description: 'คานพื้นหรือคานหลังคาแบน — ไม่มีมุมเอียง',
    patch: { memberAngle: 0, sectionAngle: 0, spanBasis: 'slope', deflectionLimit: 240 },
  },
  {
    id: 'purlin',
    label: 'แป (หน้าตัดเอียงตามหลังคา)',
    description: 'วางนอน แต่หน้าตัดเอียงตามความชันหลังคา → เกิดการดัดสองแกน',
    patch: {
      memberAngle: 0,
      sectionAngle: 26.57,
      spanBasis: 'slope',
      deflectionLimit: 200,
      sagRods: 'one',
    },
  },
  {
    id: 'hat-batten',
    label: 'แปหมวก (รับกระเบื้อง)',
    description:
      'แปเหล็กเคลือบรูปหมวกวางบนจันทันห่างไม่เกิน 1 ม. หน้าตัดเอียงตามหลังคา → ดัดสองแกน · ' +
      'ใส่แรงตัวอย่างให้: กระเบื้องคอนกรีต 50 + น้ำหนักจร 30 กก./ตร.ม. ระยะแป 0.33 ม. ' +
      'ช่วง 1 ม. → M = wL²/8 ≈ 3.4 กก.-ม. — แก้เป็นค่าของงานจริง',
    patch: {
      // w = (50 + 30) × 0.33 + น้ำหนักแป 0.5 ≈ 27 กก./ม. → M = 27 × 1²/8 ≈ 3.4 กก.-ม., V = 27 × 1/2 ≈ 14 กก.
      moment: 3.4,
      shear: 14,
      axial: 0,
      memberAngle: 0,
      sectionAngle: 26.57,
      spanBasis: 'slope',
      span: 1,
      unbracedLength: 1,
      sagRods: 'none',
      deflectionLimit: 200,
      section: {
        ...DEFAULT_SECTION_SELECTION,
        sectionId: HAT_BATTEN_ID,
        gradeId: 'G300',
        hat: getSection(HAT_BATTEN_ID)?.hatDims,
      },
    },
  },
  {
    id: 'rafter',
    label: 'จันทัน (ชิ้นส่วนเอียงตามหลังคา)',
    description:
      'วางเอียงตามความชันหลังคา เอวอยู่ในระนาบดิ่งตามแนวจันทัน (ซึ่งตั้งฉากกับผิวหลังคาอยู่แล้ว) ' +
      '→ เกิดแรงตามแกน แต่ไม่เกิดการดัดรอบแกนอ่อน',
    patch: {
      memberAngle: 26.57,
      sectionAngle: 0,
      spanBasis: 'horizontal',
      deflectionLimit: 240,
    },
  },
]
