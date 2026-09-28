import type { EncasedColumnInput } from '@/engine/steel/encasedColumn'
import type { SectionCategory } from '@/engine/steel/sectionTable'
import { DEFAULT_SECTION_SELECTION } from '../steel-beam/steelBeamDefaults'

/** ค่าตั้งต้นตามตัวอย่างในตำรา: เสา 25 × 25 ซม. สูง 3.50 ม. รับแรงอัด 25 ตัน */
export const DEFAULT_ENCASED_COLUMN_INPUT: EncasedColumnInput = {
  axial: 25000,
  height: 3.5,
  width: 25,
  depth: 25,
  fc: 240,
  meshHoopSpacing: 10,
  meshVerticalSpacing: 20,
  section: { ...DEFAULT_SECTION_SELECTION, sectionId: 'h-wide:H125×125×6.5×9' },
}

/** หมวดหน้าตัดที่ใช้เป็นแกนเหล็กหุ้มคอนกรีตได้ */
export const ENCASED_SECTION_CATEGORIES: SectionCategory[] = ['h-wide', 'h-narrow', 'i-beam']

export const ENCASED_SUGGEST_GROUPS: Array<{ label: string; categories: SectionCategory[] }> = [
  { label: 'เหล็ก H หน้ากว้าง', categories: ['h-wide'] },
  { label: 'เหล็ก H ทุกแบบ', categories: ['h-wide', 'h-narrow'] },
  { label: 'เหล็ก H + เหล็กรูปตัว I', categories: ['h-wide', 'h-narrow', 'i-beam'] },
]

export const DEFAULT_ENCASED_SUGGEST_CATEGORIES: SectionCategory[] = ['h-wide', 'h-narrow']
