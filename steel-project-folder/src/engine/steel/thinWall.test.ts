import { describe, expect, it } from 'vitest'
import {
  hatProps,
  lippedChannelProps,
  lippedPlates,
  platesFromPath,
  propsFromPlates,
} from './geometry'

describe('แบบจำลองแผ่นบาง — ตรวจกับสูตรที่สอบทานแล้ว', () => {
  it('ตัวซี C150×50×20×2.3 ให้ A และ Ix ตรงกับสูตรปิดภายใน 0.5%', () => {
    const dims = { d: 15, bf: 5, lip: 2, t: 0.23 }
    const closed = lippedChannelProps(dims)
    const plates = propsFromPlates(lippedPlates(dims), 0.23)
    expect(Math.abs(plates.A / closed.A - 1)).toBeLessThan(0.005)
    expect(Math.abs(plates.Ix / closed.Ix - 1)).toBeLessThan(0.005)
    expect(Math.abs(plates.Iy / closed.Iy - 1)).toBeLessThan(0.01)
  })

  it('ตัวซี C100×50×20×2.3 ให้ Ix ตรงกับสูตรปิดภายใน 0.5%', () => {
    const dims = { d: 10, bf: 5, lip: 2, t: 0.23 }
    const closed = lippedChannelProps(dims)
    const plates = propsFromPlates(lippedPlates(dims), 0.23)
    expect(Math.abs(plates.Ix / closed.Ix - 1)).toBeLessThan(0.005)
  })
})

describe('แปหมวก — เทียบการคำนวณมือ', () => {
  // สูง 3 · ฐาน 6.5 · สัน 2.5 · เอวตั้งดิ่ง · ไม่มีขอบพับ · หนา 0.05 ซม.
  // เส้นกึ่งกลางมุมแหลม: สันยาว 2.45 · เอวยาว 2.95 × 2 · ปีกยาว 2.0 × 2 → ยาวรวม 12.35 ซม.
  const t = 0.05
  const sharp = propsFromPlates(
    platesFromPath(
      [[-3.225, 0.025], [-1.225, 0.025], [-1.225, 2.975], [1.225, 2.975], [1.225, 0.025], [3.225, 0.025]],
      ['start', 'both', 'both', 'both', 'start'],
      0,
    ),
    t,
  )

  it('A = 12.35 × 0.05 = 0.6175 ตร.ซม.', () => {
    expect(sharp.A).toBeCloseTo(0.6175, 5)
  })

  it('เซนทรอยด์ห่างใต้ปีก 1.31488 ซม.', () => {
    expect(sharp.ybar).toBeCloseTo(1.31488, 4)
  })

  it('Ix = 0.89441 ซม.⁴', () => {
    expect(sharp.Ix).toBeCloseTo(0.89441, 4)
  })

  it('Iy = 1.56075 ซม.⁴', () => {
    expect(sharp.Iy).toBeCloseTo(1.56075, 4)
  })

  const p = hatProps({ d: 3, bf: 6.5, crown: 2.5, webBottom: 2.5, lip: 0, t, bendRadius: 0 })

  it('hatProps (มุมโค้งรัศมีกึ่งกลาง t/2) ต่างจากมุมแหลมไม่เกิน 1%', () => {
    expect(Math.abs(p.A / sharp.A - 1)).toBeLessThan(0.01)
    expect(Math.abs(p.Ix / sharp.Ix - 1)).toBeLessThan(0.01)
    expect(Math.abs(p.Iy / sharp.Iy - 1)).toBeLessThan(0.01)
  })

  it('หน้าตัดกว้างกว่าสูง Iy > Ix', () => {
    expect(p.Iy).toBeGreaterThan(p.Ix)
  })

  it('Sx ใช้ระยะผิวที่ไกลกว่าจากแกนสะเทิน (ผิวบนของสัน)', () => {
    expect(p.Sx).toBeCloseTo(p.Ix / (3 - p.ybar), 4)
  })

  it('ขอบพับที่ปลายปีกทำให้พื้นที่เพิ่มขึ้น', () => {
    const lipped = hatProps({ d: 3, bf: 6.5, crown: 2.5, webBottom: 2.5, lip: 0.5, t })
    expect(lipped.A).toBeGreaterThan(hatProps({ d: 3, bf: 6.5, crown: 2.5, webBottom: 2.5, lip: 0, t }).A)
  })
})
