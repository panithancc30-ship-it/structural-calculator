/**
 * หน้าตัดประกอบจากเหล็กสองท่อน — รวมคุณสมบัติด้วยทฤษฎีบทแกนขนาน
 *
 * การประกอบช่วยเพิ่มความแข็งแรงรอบแกนอ่อนอย่างมาก โดยไม่ต้องสั่งหน้าตัดพิเศษ
 * แต่ต้องยึดสองท่อนให้ทำงานร่วมกันจริง จึงต้องตรวจระยะห่างของจุดยึดตาม AISC E4 ด้วย
 */

import { STEEL_UNIT_WEIGHT, type SteelGrade } from './materials'
import type { SectionProps } from './geometry'

export type BuiltUpArrangement = 'single' | '2c-back' | '2c-box' | '2l-back' | '2tube'

export interface ArrangementInfo {
  id: BuiltUpArrangement
  label: string
  description: string
  /** หมวดหน้าตัดที่ใช้กับการประกอบแบบนี้ได้ */
  appliesTo: string[]
}

export const ARRANGEMENTS: ArrangementInfo[] = [
  {
    id: 'single',
    label: 'หน้าตัดเดี่ยว',
    description: 'ใช้เหล็กท่อนเดียวตามที่เลือก',
    appliesTo: ['*'],
  },
  {
    id: '2c-back',
    label: '2 รางน้ำ หลังชนหลัง  ][',
    description: 'เอาด้านหลังเอวชนกัน ปีกหันออกสองข้าง ได้หน้าตัดคล้ายตัว I',
    appliesTo: ['channel', 'lipped-channel', 'g550'],
  },
  {
    id: '2c-box',
    label: '2 รางน้ำ ประกบเป็นกล่อง  [ ]',
    description: 'หันปีกเข้าหากัน เอวเป็นผิวนอกสองข้าง แข็งแรงรอบแกนอ่อนมาก',
    appliesTo: ['channel', 'lipped-channel', 'g550'],
  },
  {
    id: '2l-back',
    label: '2 เหล็กฉาก ประกบหลัง',
    description: 'ฉากสองตัวประกบผ่านแผ่นเหล็ก (gusset) นิยมใช้เป็นชิ้นส่วนโครงถัก',
    appliesTo: ['angle-equal', 'angle-unequal'],
  },
  {
    id: '2tube',
    label: '2 กล่อง/ท่อ วางคู่',
    description: 'วางเคียงกันตามแนวนอน เพิ่มความแข็งแรงรอบแกนอ่อน',
    appliesTo: ['square-tube', 'rect-tube', 'pipe'],
  },
]

export function arrangementsFor(category: string): ArrangementInfo[] {
  return ARRANGEMENTS.filter(
    (a) => a.appliesTo.includes('*') || a.appliesTo.includes(category),
  )
}

/**
 * รวมหน้าตัดสองท่อนเข้าด้วยกัน
 * @param base คุณสมบัติของเหล็กท่อนเดียว
 * @param arrangement รูปแบบการประกอบ
 * @param gap ระยะห่างระหว่างสองท่อน (ซม.) — ปกติคือความหนาแผ่นประกับ
 */
export function combineSection(
  base: SectionProps,
  arrangement: BuiltUpArrangement,
  gap: number,
): SectionProps {
  if (arrangement === 'single') return base

  const g = Math.max(gap, 0)
  const A = 2 * base.A

  /** ระยะจากเซนทรอยด์รวมถึงเซนทรอยด์ของแต่ละท่อน */
  let e: number
  /** ความกว้างรวมของหน้าตัดประกอบ */
  let width: number

  switch (arrangement) {
    case '2c-back':
    case '2l-back':
      // ผิวหลัง (เอวหรือขาฉาก) หันเข้าหากัน — เซนทรอยด์ท่อนอยู่ห่างจากระนาบสัมผัส = xbar
      e = base.xbar + g / 2
      width = 2 * base.bf + g
      break
    case '2c-box':
      // ปลายปีกหันเข้าหากัน — เอวอยู่ผิวนอก
      e = base.bf - base.xbar + g / 2
      width = 2 * base.bf + g
      break
    case '2tube':
      e = base.bf / 2 + g / 2
      width = 2 * base.bf + g
      break
  }

  const Ix = 2 * base.Ix
  const Iy = 2 * (base.Iy + base.A * e ** 2)

  return {
    ...base,
    family: 'built-up',
    bf: width,
    A,
    weight: A * STEEL_UNIT_WEIGHT,
    Ix,
    Iy,
    Sx: 2 * base.Sx,
    Sy: Iy / (width / 2),
    rx: Math.sqrt(Ix / A),
    ry: Math.sqrt(Iy / A),
    rmin: Math.sqrt(Math.min(Ix, Iy) / A),
    Aw: 2 * base.Aw,
    J: 2 * base.J,
    rT: Math.sqrt(Iy / A),
    dAf: base.dAf / 2,
    doublySymmetric: arrangement !== '2l-back',
    // เชื่อมเป็นกล่องต่อเนื่องเท่านั้นจึงจะได้พฤติกรรมหน้าตัดปิด จึงคิดแบบเปิดไว้ก่อน (ปลอดภัยกว่า)
    closed: base.closed,
  }
}

export interface ConnectorCheck {
  required: boolean
  /** ความชะลูดของท่อนเดี่ยวระหว่างจุดยึด */
  localSlenderness: number
  /** ขีดจำกัด = 0.75 × ความชะลูดของหน้าตัดประกอบ */
  limit: number
  /** ระยะห่างจุดยึดสูงสุดที่ยอมให้ (ซม.) */
  maxSpacing: number
  ok: boolean
}

/**
 * ตรวจระยะห่างจุดยึดของหน้าตัดประกอบ (AISC E4)
 * ความชะลูดของท่อนเดี่ยวระหว่างจุดยึดต้องไม่เกิน 3/4 ของความชะลูดของหน้าตัดรวม
 * มิฉะนั้นท่อนเดี่ยวจะโก่งเดาะก่อนที่หน้าตัดประกอบจะรับกำลังได้เต็มที่
 */
export function checkConnectorSpacing(
  arrangement: BuiltUpArrangement,
  singleRmin: number,
  spacing: number,
  governingSlenderness: number,
): ConnectorCheck {
  if (arrangement === 'single') {
    return {
      required: false,
      localSlenderness: 0,
      limit: 0,
      maxSpacing: Infinity,
      ok: true,
    }
  }

  const limit = 0.75 * governingSlenderness
  const localSlenderness = singleRmin > 0 ? spacing / singleRmin : Infinity
  const maxSpacing = limit * singleRmin

  return {
    required: true,
    localSlenderness,
    limit,
    maxSpacing,
    ok: localSlenderness <= limit,
  }
}

/** ความชะลูดปรับค่าของหน้าตัดประกอบยึดด้วยสลักเกลียวแบบขันแน่นพอดี (AISC E4) */
export function modifiedSlenderness(
  overall: number,
  spacing: number,
  singleRmin: number,
): number {
  if (singleRmin <= 0) return overall
  const local = spacing / singleRmin
  return Math.sqrt(overall ** 2 + local ** 2)
}

/** หน้าตัดประกอบจากเหล็กขึ้นรูปเย็นยังต้องลดหน้าตัดประสิทธิผลเหมือนเดิม */
export function isColdFormedGrade(grade: SteelGrade): boolean {
  return grade.coldFormed
}
