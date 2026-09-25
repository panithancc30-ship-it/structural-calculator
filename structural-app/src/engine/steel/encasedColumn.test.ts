import { describe, expect, it } from 'vitest'
import { DEFAULT_ENCASED_COLUMN_INPUT } from '@/features/steel-encased-column/encasedColumnDefaults'
import {
  calcEncasedColumn,
  encasedCapacity,
  encasedSteelStress,
  minimumEncasement,
  type EncasedColumnInput,
} from './encasedColumn'
import { DEFAULT_CUSTOM_SECTION } from './section'
import { suggestEncasedColumnSections } from './suggest'

function within(actual: number, expected: number, percent: number) {
  const error = (Math.abs(actual - expected) / expected) * 100
  expect(error, `ได้ ${actual.toFixed(3)} แต่คาดว่า ${expected}`).toBeLessThanOrEqual(percent)
}

function check(input: EncasedColumnInput, id: string) {
  const found = calcEncasedColumn(input).checks.find((c) => c.id === id)
  if (!found) throw new Error(`ไม่พบรายการตรวจสอบ ${id}`)
  return found
}

/**
 * ตัวอย่าง 6.4 — เสา 0.25 × 0.25 ม. สูง 3.50 ม. P = 25,000 กก. f′c = 180 ksc เลือก WF125×23.3
 * ใช้คุณสมบัติหน้าตัดตามตารางในตำรา (Ar = 30.31 ตร.ซม., Ksy = 3.11 ซม.)
 */
const TEXTBOOK_H125 = {
  ...DEFAULT_CUSTOM_SECTION,
  name: 'WF125×23.3 (ตามตำรา)',
  d: 12.5,
  bf: 12.5,
  tw: 0.65,
  tf: 0.9,
  A: 30.31,
  Ix: 839,
  Iy: 3.11 ** 2 * 30.31,
}

const EXAMPLE_6_4: EncasedColumnInput = {
  ...DEFAULT_ENCASED_COLUMN_INPUT,
  axial: 25000,
  height: 3.5,
  width: 25,
  depth: 25,
  fc: 180,
  section: { ...DEFAULT_ENCASED_COLUMN_INPUT.section, source: 'custom', custom: TEXTBOOK_H125 },
}

describe('สูตรเสาเหล็กหุ้มคอนกรีต', () => {
  it('fr′ = 1,195 − 0.0342(h/Ks)²', () => {
    expect(encasedSteelStress(0)).toBe(1195)
    expect(encasedSteelStress(112.54)).toBeCloseTo(761.84, 1)
    // ไม่ให้ค่าติดลบเมื่อชะลูดมาก
    expect(encasedSteelStress(250)).toBe(0)
  })

  it('P = Ar·fr′·(1 + Ag/(100·Ar))', () => {
    expect(encasedCapacity(30.31, 761.84, 625)).toBeCloseTo(27852.87, 0)
    expect(encasedCapacity(0, 761.84, 625)).toBe(0)
  })

  it('ขนาดเสาเล็กสุดที่หุ้มได้ — ปัดขึ้นทีละ 5 ซม. และไม่เล็กกว่า 20 ซม.', () => {
    expect(minimumEncasement(12.5, 12.5)).toEqual({ width: 25, depth: 25 })
    expect(minimumEncasement(10, 10)).toEqual({ width: 25, depth: 25 })
    expect(minimumEncasement(15, 30)).toEqual({ width: 30, depth: 45 })
    expect(minimumEncasement(5, 5)).toEqual({ width: 20, depth: 20 })
  })
})

describe('ตัวอย่าง 6.4 — เสาเหล็กหุ้มคอนกรีต', () => {
  const result = calcEncasedColumn(EXAMPLE_6_4)
  const step = (symbol: string) => result.steps.find((s) => s.symbol === symbol)?.value ?? NaN

  it('ได้ค่าตรงกับตำรา', () => {
    expect(step('h/Ks')).toBeCloseTo(112.54, 2)
    within(step('fr′'), 761.84, 0.01)
    expect(step('Ag')).toBe(625)
    within(result.summary.capacity, 27852.87, 0.01)
  })

  it('รับแรง 25,000 กก. ได้ และระยะหุ้ม 6.25 ซม. ผ่าน', () => {
    expect(check(EXAMPLE_6_4, 'capacity').status).toBe('pass')
    expect(check(EXAMPLE_6_4, 'slenderness').status).toBe('pass')
    expect(check(EXAMPLE_6_4, 'cover').actual).toBeCloseTo(6.25, 2)
    expect(check(EXAMPLE_6_4, 'cover').status).toBe('pass')
  })

  it('f′c = 180 ต่ำกว่าเกณฑ์ขั้นต่ำ 200 ksc', () => {
    expect(check(EXAMPLE_6_4, 'fc-min').status).toBe('fail')
    expect(calcEncasedColumn({ ...EXAMPLE_6_4, fc: 240 }).overall).toBe('pass')
  })

  it('หน้าตัด H125×125 จากตาราง มอก. ให้ผลใกล้เคียงตำราภายใน 0.5%', () => {
    const table = calcEncasedColumn({ ...DEFAULT_ENCASED_COLUMN_INPUT, fc: 180 })
    within(table.summary.capacity, 27852.87, 0.5)
    expect(table.summary.sectionName).toBe('H125×125×6.5×9')
  })

  it('ตัวช่วยแนะนำเลือก H125×125 เป็นหน้าตัดที่เบาที่สุด แม้ f′c ยังไม่ผ่าน', () => {
    const list = suggestEncasedColumnSections({ ...DEFAULT_ENCASED_COLUMN_INPUT, fc: 180 }, [
      'h-wide',
      'h-narrow',
    ])
    expect(list[0]?.name).toBe('H125×125×6.5×9')
    // H100×100 ชะลูดเกิน 120 จึงไม่อยู่ในรายการ
    expect(list.some((s) => s.name.startsWith('H100'))).toBe(false)
  })
})

describe('เงื่อนไขที่ไม่ผ่าน', () => {
  const base = DEFAULT_ENCASED_COLUMN_INPUT

  it('h/Ks เกิน 120 — นอกขอบเขตของสูตร fr′', () => {
    const input = { ...base, section: { ...base.section, sectionId: 'h-wide:H100×100×6×8' } }
    const c = check(input, 'slenderness')
    expect(c.actual).toBeGreaterThan(120)
    expect(c.status).toBe('fail')
  })

  it('คอนกรีตหุ้มบางกว่า 6 ซม. — แนะนำขนาดเสาที่พอ', () => {
    const c = check({ ...base, width: 20, depth: 20 }, 'cover')
    expect(c.actual).toBeCloseTo(3.75, 2)
    expect(c.status).toBe('fail')
    expect(c.note).toContain('25 × 25')
  })

  it('เสาแคบกว่า 20 ซม.', () => {
    expect(check({ ...base, width: 18 }, 'min-dimension').status).toBe('fail')
  })

  it('แรงเกินกำลัง', () => {
    const c = check({ ...base, axial: 30000 }, 'capacity')
    expect(c.ratio).toBeGreaterThan(1)
    expect(c.status).toBe('fail')
  })

  it('ระยะลวดตาข่ายเกิน 10 / 20 ซม.', () => {
    expect(check({ ...base, meshHoopSpacing: 12.5 }, 'mesh-hoop').status).toBe('fail')
    expect(check({ ...base, meshVerticalSpacing: 25 }, 'mesh-vertical').status).toBe('fail')
  })

  it('แรงดึงไม่ใช้สูตรนี้ — เตือนและคิดแรงอัดเป็นศูนย์', () => {
    const result = calcEncasedColumn({ ...base, axial: -5000 })
    expect(result.warnings[0]).toContain('แรงอัดเท่านั้น')
    expect(check({ ...base, axial: -5000 }, 'capacity').actual).toBe(0)
  })
})
