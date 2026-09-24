/**
 * ตารางหน้าตัดเหล็กที่มีจำหน่ายในประเทศไทย
 *
 * เก็บเฉพาะ "มิติ" เท่านั้น — คุณสมบัติทุกค่าคำนวณจากรูปทรงใน geometry.ts
 * เพราะมิติคือชื่อเรียกหน้าตัดอยู่แล้ว (H200×100×5.5×8) จึงตรวจสอบด้วยตาเปล่าได้
 * ต่างจากตารางคุณสมบัติที่มีตัวเลขนับพันค่าและลอกผิดได้โดยไม่มีใครรู้
 *
 * มิติทั้งหมดเป็นเซนติเมตร
 */

import {
  angleProps,
  boxProps,
  channelProps,
  iShapeProps,
  lippedChannelProps,
  hatProps,
  pipeProps,
  type HatDims,
  type SectionProps,
} from './geometry'

export type SectionCategory =
  | 'h-wide'
  | 'h-narrow'
  | 'i-beam'
  | 'channel'
  | 'lipped-channel'
  | 'angle-equal'
  | 'angle-unequal'
  | 'square-tube'
  | 'rect-tube'
  | 'pipe'
  | 'g550'
  | 'hat'

export interface CategoryInfo {
  id: SectionCategory
  label: string
  standard: string
  /** เกรดเหล็กที่ใช้กับหมวดนี้เป็นปกติ */
  defaultGrade: string
  note?: string
}

export const SECTION_CATEGORIES: CategoryInfo[] = [
  {
    id: 'h-wide',
    label: 'เหล็ก H หน้ากว้าง (กว้าง = สูง)',
    standard: 'มอก. 1227 / JIS G3192',
    defaultGrade: 'SS400',
    note: 'ใช้เป็นเสาเป็นหลัก เพราะแกนอ่อนแข็งแรงใกล้เคียงแกนแข็ง',
  },
  {
    id: 'h-narrow',
    label: 'เหล็ก H หน้าแคบ (Wide Flange)',
    standard: 'มอก. 1227 / JIS G3192',
    defaultGrade: 'SS400',
    note: 'ใช้เป็นคานเป็นหลัก เพราะแกนแข็งมีประสิทธิภาพสูงต่อน้ำหนัก',
  },
  {
    id: 'i-beam',
    label: 'เหล็กรูปตัว I',
    standard: 'มอก. 116 / JIS G3192',
    defaultGrade: 'SS400',
    note: 'ปีกสอบ — ค่าแกนอ่อนที่คำนวณจากรูปทรงจะสูงกว่าตารางจริง',
  },
  {
    id: 'channel',
    label: 'เหล็กรางน้ำ (C)',
    standard: 'มอก. 1227 / JIS G3192',
    defaultGrade: 'SS400',
    note: 'ปีกสอบ — ค่าแกนอ่อนที่คำนวณจากรูปทรงจะสูงกว่าตารางจริง',
  },
  {
    id: 'lipped-channel',
    label: 'เหล็กตัวซี ขึ้นรูปเย็น',
    standard: 'มอก. 1228',
    defaultGrade: 'SSC400',
    note: 'นิยมใช้ทำแปหลังคา ต้องตรวจหน้าตัดประสิทธิผลตาม AISI',
  },
  {
    id: 'angle-equal',
    label: 'เหล็กฉากขาเท่า (L)',
    standard: 'มอก. 1227 / JIS G3192',
    defaultGrade: 'SS400',
  },
  {
    id: 'angle-unequal',
    label: 'เหล็กฉากขาไม่เท่า',
    standard: 'มอก. 1227 / JIS G3192',
    defaultGrade: 'SS400',
  },
  {
    id: 'square-tube',
    label: 'เหล็กกล่องสี่เหลี่ยมจัตุรัส',
    standard: 'มอก. 107 / 1228',
    defaultGrade: 'SSC400',
  },
  {
    id: 'rect-tube',
    label: 'เหล็กกล่องสี่เหลี่ยมผืนผ้า',
    standard: 'มอก. 107 / 1228',
    defaultGrade: 'SSC400',
  },
  {
    id: 'pipe',
    label: 'เหล็กท่อกลม',
    standard: 'มอก. 276 / 277',
    defaultGrade: 'SS400',
  },
  {
    id: 'g550',
    label: 'ตัวซีบางกำลังสูง G550 (โครงหลังคาสำเร็จรูป)',
    standard: 'AISI / JIS G3321 (เคลือบ AZ)',
    defaultGrade: 'G550',
    note:
      'ใช้กับโครงหลังคาสำเร็จรูป (เช่น SCG / CPAC) — มิติเป็นค่าตั้งต้นที่พบทั่วไป ' +
      'ปรับให้ตรงกับของที่ใช้จริงก่อนใช้งาน',
  },
  {
    id: 'hat',
    label: 'แปหมวก (แปสำเร็จรูปรับกระเบื้อง)',
    standard: 'AISI / มอก. 2753 (เหล็กแผ่นเคลือบ)',
    defaultGrade: 'G300',
    note:
      'แปเหล็กเคลือบรูปหมวกสำหรับหลังคากระเบื้องคอนกรีต เช่น แป SCG / CPAC — ' +
      'มิติแก้ไขได้ ผู้ขายไม่ระบุความกว้างสันและขอบพับ ต้องวัดจากของจริง',
  },
]

export interface SectionEntry {
  id: string
  name: string
  category: SectionCategory
  /** ปีกสอบ — ค่าแกนอ่อนที่คำนวณได้จะสูงกว่าตารางจริง ต้องเตือนผู้ใช้ */
  taperedFlange?: boolean
  props: () => SectionProps
  /** มิติตั้งต้นของแปหมวก — ผู้ใช้แก้ไขต่อได้ */
  hatDims?: HatDims
}

// ───────────────────────────────────────────────────────────────────────────
// เหล็ก H / I — [d, bf, tw, tf, r] หน่วย มม.
// ค่ารัศมีมุมโค้ง r สอบทานแล้วโดยให้พื้นที่หน้าตัดที่คำนวณได้ตรงกับตาราง JIS
// ───────────────────────────────────────────────────────────────────────────

type HRow = [number, number, number, number, number]

const H_WIDE: HRow[] = [
  [100, 100, 6, 8, 8],
  [125, 125, 6.5, 9, 8],
  [150, 150, 7, 10, 11],
  [175, 175, 7.5, 11, 13],
  [200, 200, 8, 12, 13],
  [250, 250, 9, 14, 16],
  [300, 300, 10, 15, 18],
  [350, 350, 12, 19, 20],
  [400, 400, 13, 21, 22],
]

const H_NARROW: HRow[] = [
  [148, 100, 6, 9, 11],
  [150, 75, 5, 7, 8],
  [198, 99, 4.5, 7, 11],
  [200, 100, 5.5, 8, 11],
  [248, 124, 5, 8, 12],
  [250, 125, 6, 9, 12],
  [298, 149, 5.5, 8, 13],
  [300, 150, 6.5, 9, 13],
  [346, 174, 6, 9, 14],
  [350, 175, 7, 11, 14],
  [396, 199, 7, 11, 16],
  [400, 200, 8, 13, 16],
  [446, 199, 8, 12, 18],
  [450, 200, 9, 14, 18],
  [496, 199, 9, 14, 20],
  [500, 200, 10, 16, 20],
  [596, 199, 10, 15, 22],
  [600, 200, 11, 17, 22],
  [588, 300, 12, 20, 28],
  [700, 300, 13, 24, 28],
]

const I_BEAM: HRow[] = [
  [100, 75, 5, 8, 7],
  [125, 75, 5.5, 8, 8],
  [150, 75, 5.5, 9.5, 9],
  [150, 125, 8.5, 14, 13],
  [180, 100, 6, 10, 10],
  [200, 100, 7, 10, 10],
  [250, 125, 7.5, 12.5, 12],
  [300, 150, 8, 13, 13],
  [350, 150, 9, 15, 13],
  [400, 150, 10, 18, 17],
]

/** รางน้ำ — [d, bf, tw, tf, r] หน่วย มม. */
const CHANNELS: HRow[] = [
  [75, 40, 5, 7, 8],
  [100, 50, 5, 7.5, 8],
  [125, 65, 6, 8, 8],
  [150, 75, 6.5, 10, 10],
  [180, 75, 7, 10.5, 11],
  [200, 80, 7.5, 11, 12],
  [250, 90, 9, 13, 14],
  [300, 90, 9, 13, 14],
  [380, 100, 10.5, 16, 18],
]

/** ตัวซีขึ้นรูปเย็น — [H, B, C, t] หน่วย มม. */
const LIPPED: Array<[number, number, number, number]> = [
  [60, 30, 10, 1.6],
  [60, 30, 10, 2.3],
  [75, 45, 15, 1.6],
  [75, 45, 15, 2.3],
  [75, 45, 15, 3.2],
  [100, 50, 20, 1.6],
  [100, 50, 20, 2.3],
  [100, 50, 20, 3.2],
  [125, 50, 20, 2.3],
  [125, 50, 20, 3.2],
  [150, 50, 20, 2.3],
  [150, 50, 20, 3.2],
  [150, 65, 20, 2.3],
  [150, 65, 20, 3.2],
  [200, 75, 20, 2.3],
  [200, 75, 20, 3.2],
  [200, 75, 20, 4.5],
  [250, 75, 25, 3.2],
  [250, 75, 25, 4.5],
  [300, 75, 25, 4.5],
]

/** ตัวซีบางกำลังสูง G550 — [H, B, C, t] หน่วย มม. */
const G550_SECTIONS: Array<[number, number, number, number]> = [
  [75, 35, 8, 0.75],
  [75, 35, 8, 1.0],
  [100, 40, 10, 0.75],
  [100, 40, 10, 1.0],
  [100, 40, 10, 1.2],
  [125, 45, 12, 1.0],
  [125, 45, 12, 1.2],
  [150, 45, 12, 1.0],
  [150, 45, 12, 1.2],
  [150, 45, 12, 1.6],
]

/** เหล็กฉากขาเท่า — [ขา, ความหนา] หน่วย มม. */
const ANGLES_EQUAL: Array<[number, number]> = [
  [25, 3],
  [30, 3],
  [40, 3],
  [40, 4],
  [40, 5],
  [50, 4],
  [50, 5],
  [50, 6],
  [60, 5],
  [65, 6],
  [65, 8],
  [75, 6],
  [75, 9],
  [90, 7],
  [90, 10],
  [100, 7],
  [100, 10],
  [100, 13],
  [120, 8],
  [125, 9],
  [125, 12],
  [130, 9],
  [130, 12],
  [150, 12],
  [150, 15],
  [175, 12],
  [200, 15],
  [200, 20],
]

/** เหล็กฉากขาไม่เท่า — [ขายาว, ขาสั้น, ความหนา] หน่วย มม. */
const ANGLES_UNEQUAL: Array<[number, number, number]> = [
  [65, 50, 6],
  [75, 50, 6],
  [90, 75, 9],
  [100, 75, 7],
  [100, 75, 10],
  [125, 75, 7],
  [125, 75, 10],
  [125, 90, 10],
  [150, 90, 9],
  [150, 90, 12],
  [150, 100, 9],
  [150, 100, 12],
]

/** เหล็กกล่องจัตุรัส — [ด้าน, ความหนาที่มีขาย] หน่วย มม. */
const SQUARE_TUBES: Array<[number, number[]]> = [
  [19, [1.0, 1.2, 1.4, 1.6]],
  [25, [1.2, 1.4, 1.6, 1.8, 2.0, 2.3]],
  [32, [1.2, 1.4, 1.6, 1.8, 2.0, 2.3]],
  [38, [1.2, 1.4, 1.6, 1.8, 2.0, 2.3, 3.2]],
  [50, [1.2, 1.4, 1.6, 1.8, 2.0, 2.3, 3.2, 4.0]],
  [60, [1.6, 1.8, 2.0, 2.3, 3.2, 4.0]],
  [65, [1.6, 1.8, 2.0, 2.3, 3.2, 4.0]],
  [75, [1.6, 2.0, 2.3, 3.2, 4.0, 4.5]],
  [90, [2.0, 2.3, 3.2, 4.0, 4.5]],
  [100, [2.0, 2.3, 3.2, 4.0, 4.5, 6.0]],
  [125, [3.2, 4.0, 4.5, 6.0]],
  [150, [3.2, 4.0, 4.5, 6.0, 9.0]],
  [175, [4.5, 6.0, 9.0]],
  [200, [4.5, 6.0, 9.0, 12.0]],
]

/** เหล็กกล่องผืนผ้า — [ด้านลึก, ด้านกว้าง, ความหนาที่มีขาย] หน่วย มม. */
const RECT_TUBES: Array<[number, number, number[]]> = [
  [25, 12, [1.0, 1.2]],
  [38, 19, [1.2, 1.6, 2.0]],
  [50, 25, [1.2, 1.6, 2.0, 2.3, 3.2]],
  [75, 38, [1.6, 2.0, 2.3, 3.2]],
  [75, 45, [1.6, 2.0, 2.3, 3.2]],
  [100, 50, [1.6, 2.0, 2.3, 3.2, 4.0]],
  [100, 75, [2.3, 3.2, 4.0]],
  [125, 75, [2.3, 3.2, 4.0, 4.5]],
  [150, 50, [2.3, 3.2, 4.0, 4.5]],
  [150, 75, [2.3, 3.2, 4.0, 4.5]],
  [150, 100, [3.2, 4.0, 4.5, 6.0]],
  [200, 100, [3.2, 4.0, 4.5, 6.0, 9.0]],
  [200, 150, [4.5, 6.0, 9.0]],
  [250, 150, [4.5, 6.0, 9.0]],
]

/** ท่อกลม — [ชื่อขนาดนิ้ว, เส้นผ่านศูนย์กลางนอก มม., ความหนาชั้นกลาง/หนา มม.] */
const PIPES: Array<[string, number, number[]]> = [
  ['1/2"', 21.7, [2.0, 2.8]],
  ['3/4"', 27.2, [2.0, 2.8]],
  ['1"', 34.0, [2.3, 3.2]],
  ['1-1/4"', 42.7, [2.3, 3.5]],
  ['1-1/2"', 48.6, [2.3, 3.5]],
  ['2"', 60.5, [2.8, 3.8]],
  ['2-1/2"', 76.3, [3.2, 4.5]],
  ['3"', 89.1, [3.2, 4.5]],
  ['4"', 114.3, [3.5, 4.5]],
  ['5"', 139.8, [4.0, 4.5]],
  ['6"', 165.2, [4.5, 5.0]],
  ['8"', 216.3, [5.8, 6.4]],
]

/**
 * แปหมวก — [ชื่อ, สูง, ฐานรวม, สัน, ระยะเอวที่ฐาน, ขอบพับ, หนา] หน่วย มม.
 *
 * SCG/CPAC: ผู้ขายระบุเฉพาะ กว้าง 65 สูง 30 หนา 0.55/0.70 และหนัก 0.575 กก./ม.
 *   ความกว้างสัน 25 ระยะเอว 35 และขอบพับ 5 มม. เป็นค่าสมมติ — น้ำหนักเหล็กเปลือยที่ได้ 0.524 กก./ม.
 *   ใกล้เคียงน้ำหนักที่ผู้ขายระบุ (0.575 กก./ม. ซึ่งรวมสารเคลือบแล้ว)
 * Profast: ผู้ขายระบุ สัน 20 สูง 27 ฐาน 61 หนา 0.55 (G330) — สมมติเอวตั้งดิ่งและไม่มีขอบพับ
 */
const HATS: Array<[string, number, number, number, number, number, number]> = [
  ['SCG/CPAC', 30, 65, 25, 35, 5, 0.55],
  ['SCG/CPAC', 30, 65, 25, 35, 5, 0.7],
  ['Profast', 27, 61, 20, 20, 0, 0.55],
]

/** มม. → ซม. */
const mm = (v: number) => v / 10

/** ตัดเลขศูนย์ท้ายทศนิยมออกเพื่อให้ชื่อหน้าตัดอ่านง่าย */
const n = (v: number) => String(Number(v.toFixed(2)))

function buildTable(): SectionEntry[] {
  const list: SectionEntry[] = []

  const addH = (rows: HRow[], category: SectionCategory, prefix: string) => {
    for (const [d, bf, tw, tf, r] of rows) {
      const name = `${prefix}${n(d)}×${n(bf)}×${n(tw)}×${n(tf)}`
      const dims = { d: mm(d), bf: mm(bf), tw: mm(tw), tf: mm(tf), r: mm(r) }
      list.push({
        id: `${category}:${name}`,
        name,
        category,
        taperedFlange: category === 'i-beam',
        props: () => iShapeProps(dims),
      })
    }
  }

  addH(H_WIDE, 'h-wide', 'H')
  addH(H_NARROW, 'h-narrow', 'H')
  addH(I_BEAM, 'i-beam', 'I')

  for (const [d, bf, tw, tf, r] of CHANNELS) {
    const name = `C${n(d)}×${n(bf)}×${n(tw)}×${n(tf)}`
    const dims = { d: mm(d), bf: mm(bf), tw: mm(tw), tf: mm(tf), r: mm(r) }
    list.push({
      id: `channel:${name}`,
      name,
      category: 'channel',
      taperedFlange: true,
      props: () => channelProps(dims),
    })
  }

  const addLipped = (
    rows: Array<[number, number, number, number]>,
    category: SectionCategory,
  ) => {
    for (const [d, bf, lip, t] of rows) {
      const name = `C${n(d)}×${n(bf)}×${n(lip)}×${n(t)}`
      const dims = { d: mm(d), bf: mm(bf), lip: mm(lip), t: mm(t) }
      list.push({
        id: `${category}:${name}`,
        name,
        category,
        props: () => lippedChannelProps(dims),
      })
    }
  }

  addLipped(LIPPED, 'lipped-channel')
  addLipped(G550_SECTIONS, 'g550')

  for (const [brand, d, bf, crown, webBottom, lip, t] of HATS) {
    const name = `Ω${n(bf)}×${n(d)}×${n(t)} (${brand})`
    const dims: HatDims = {
      d: mm(d),
      bf: mm(bf),
      crown: mm(crown),
      webBottom: mm(webBottom),
      lip: mm(lip),
      t: mm(t),
    }
    list.push({
      id: `hat:${name}`,
      name,
      category: 'hat',
      hatDims: dims,
      props: () => hatProps(dims),
    })
  }

  for (const [leg, t] of ANGLES_EQUAL) {
    const name = `L${n(leg)}×${n(leg)}×${n(t)}`
    const dims = { legLong: mm(leg), legShort: mm(leg), t: mm(t) }
    list.push({
      id: `angle-equal:${name}`,
      name,
      category: 'angle-equal',
      props: () => angleProps(dims),
    })
  }

  for (const [a, b, t] of ANGLES_UNEQUAL) {
    const name = `L${n(a)}×${n(b)}×${n(t)}`
    const dims = { legLong: mm(a), legShort: mm(b), t: mm(t) }
    list.push({
      id: `angle-unequal:${name}`,
      name,
      category: 'angle-unequal',
      props: () => angleProps(dims),
    })
  }

  for (const [side, thicknesses] of SQUARE_TUBES) {
    for (const t of thicknesses) {
      const name = `□${n(side)}×${n(side)}×${n(t)}`
      const dims = { d: mm(side), b: mm(side), t: mm(t) }
      list.push({
        id: `square-tube:${name}`,
        name,
        category: 'square-tube',
        props: () => boxProps(dims),
      })
    }
  }

  for (const [d, b, thicknesses] of RECT_TUBES) {
    for (const t of thicknesses) {
      const name = `▭${n(d)}×${n(b)}×${n(t)}`
      const dims = { d: mm(d), b: mm(b), t: mm(t) }
      list.push({
        id: `rect-tube:${name}`,
        name,
        category: 'rect-tube',
        props: () => boxProps(dims),
      })
    }
  }

  for (const [label, od, thicknesses] of PIPES) {
    for (const t of thicknesses) {
      const name = `Ø${label} (${n(od)}×${n(t)})`
      const dims = { D: mm(od), t: mm(t) }
      list.push({
        id: `pipe:${name}`,
        name,
        category: 'pipe',
        props: () => pipeProps(dims),
      })
    }
  }

  return list
}

export const SECTION_TABLE: SectionEntry[] = buildTable()

const BY_ID = new Map(SECTION_TABLE.map((e) => [e.id, e]))

export function getSection(id: string): SectionEntry | undefined {
  return BY_ID.get(id)
}

export function sectionsInCategory(category: SectionCategory): SectionEntry[] {
  return SECTION_TABLE.filter((e) => e.category === category)
}

export function categoryInfo(category: SectionCategory): CategoryInfo {
  const info = SECTION_CATEGORIES.find((c) => c.id === category)
  if (!info) throw new Error(`ไม่พบหมวดหน้าตัด: ${category}`)
  return info
}
