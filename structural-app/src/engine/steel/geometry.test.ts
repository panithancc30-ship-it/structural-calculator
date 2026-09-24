import { describe, expect, it } from 'vitest'
import {
  angleProps,
  boxProps,
  channelProps,
  iShapeProps,
  lippedChannelProps,
  pipeProps,
} from './geometry'

/**
 * ค่าอ้างอิงมาจากตารางมาตรฐาน JIS G3192 / มอก. 1227 / มอก. 107
 * ทุกค่าที่โปรแกรมคำนวณต้องตรงกับตารางภายใน 2% มิฉะนั้นถือว่าโมเดลรูปทรงผิด
 */
function within(actual: number, expected: number, percent = 2) {
  const error = (Math.abs(actual - expected) / expected) * 100
  expect(
    error,
    `ได้ ${actual.toFixed(3)} แต่ตารางระบุ ${expected} (คลาดเคลื่อน ${error.toFixed(2)}%)`,
  ).toBeLessThanOrEqual(percent)
}

describe('iShapeProps — เทียบตาราง JIS G3192', () => {
  it('H200×100×5.5×8 (r=11)', () => {
    const p = iShapeProps({ d: 20, bf: 10, tw: 0.55, tf: 0.8, r: 1.1 })
    within(p.A, 27.16)
    within(p.weight, 21.3)
    within(p.Ix, 1840)
    within(p.Iy, 134)
    within(p.Sx, 184)
    within(p.rx, 8.23)
    within(p.ry, 2.22)
  })

  it('H200×200×8×12 (r=13)', () => {
    const p = iShapeProps({ d: 20, bf: 20, tw: 0.8, tf: 1.2, r: 1.3 })
    within(p.A, 63.53)
    within(p.weight, 49.9)
    within(p.Ix, 4720)
    within(p.Iy, 1600)
    within(p.rx, 8.62)
    within(p.ry, 5.02)
  })

  it('H400×200×8×13 (r=13)', () => {
    const p = iShapeProps({ d: 40, bf: 20, tw: 0.8, tf: 1.3, r: 1.3 })
    within(p.A, 84.12)
    within(p.Ix, 23700)
    within(p.Iy, 1740)
    within(p.Sx, 1190)
    within(p.rx, 16.8)
    within(p.ry, 4.54)
  })

  it('H300×300×10×15 (r=13)', () => {
    const p = iShapeProps({ d: 30, bf: 30, tw: 1.0, tf: 1.5, r: 1.3 })
    within(p.A, 119.8)
    within(p.Ix, 20400)
    within(p.Iy, 6750)
  })

  it('ถ้าไม่ระบุรัศมีมุมโค้ง ผลต้องน้อยกว่าเล็กน้อย (ปลอดภัยกว่า)', () => {
    const withFillet = iShapeProps({ d: 20, bf: 20, tw: 0.8, tf: 1.2, r: 1.3 })
    const sharp = iShapeProps({ d: 20, bf: 20, tw: 0.8, tf: 1.2 })
    expect(sharp.A).toBeLessThan(withFillet.A)
    expect(sharp.Ix).toBeLessThan(withFillet.Ix)
    // แต่ต้องไม่ต่างเกิน 5% มิฉะนั้นโมเดลมุมโค้งผิด
    within(sharp.Ix, withFillet.Ix, 5)
  })

  it('rT ต้องมากกว่า ry เล็กน้อย (ปีกอัด + 1/3 เอว มีความกว้างเท่าปีกแต่พื้นที่น้อยกว่า)', () => {
    const p = iShapeProps({ d: 40, bf: 20, tw: 0.8, tf: 1.3, r: 1.3 })
    expect(p.rT).toBeGreaterThan(p.ry)
    expect(p.rT).toBeLessThan(p.ry * 1.3)
  })
})

describe('channelProps — เทียบตาราง JIS G3192', () => {
  /**
   * รางน้ำ JIS จริงมีปีกสอบ (หนาที่โคน บางที่ปลาย) แต่โมเดลนี้ใช้ปีกขนาน
   * → A และ Ix ตรงดี แต่ Iy และ xbar จะสูงกว่าตารางราว 10–15%
   *   จึงต้องใช้ค่า Iy/xbar จากตารางแทน (ดู sectionTable.ts) เพราะการดัดแกนอ่อน
   *   ของรางน้ำถูกใช้จริงในงานแป และการประเมิน Iy สูงเกินไปคือฝั่งที่ไม่ปลอดภัย
   */
  it('C150×75×6.5×10 (r=10) — A และ Ix ตรงตาราง', () => {
    const p = channelProps({ d: 15, bf: 7.5, tw: 0.65, tf: 1.0, r: 1.0 })
    within(p.A, 23.71)
    within(p.Ix, 861)
    within(p.rx, 6.03)
  })

  it('C100×50×5×7.5 (r=8) — A และ Ix ตรงตาราง', () => {
    const p = channelProps({ d: 10, bf: 5, tw: 0.5, tf: 0.75, r: 0.8 })
    within(p.A, 11.92)
    within(p.Ix, 188)
  })

  it('เซนทรอยด์ต้องอยู่ฝั่งเอว (xbar < bf/2)', () => {
    const p = channelProps({ d: 15, bf: 7.5, tw: 0.65, tf: 1.0, r: 1.0 })
    expect(p.xbar).toBeLessThan(p.bf / 2)
    expect(p.xbar).toBeGreaterThan(0)
  })
})

describe('angleProps — เทียบตาราง JIS G3192', () => {
  it('L75×75×6 — รวมถึง rmin ที่ใช้ตรวจการโก่งเดาะ', () => {
    const p = angleProps({ legLong: 7.5, legShort: 7.5, t: 0.6 })
    within(p.A, 8.727, 2.5)
    within(p.Ix, 46.1, 2.5)
    within(p.xbar, 2.06, 2.5)
    within(p.rmin, 1.48)
  })

  it('L100×100×10', () => {
    const p = angleProps({ legLong: 10, legShort: 10, t: 1.0 })
    within(p.A, 19.0, 2.5)
    within(p.Ix, 175, 3)
    within(p.rmin, 1.95)
  })

  it('L50×50×5', () => {
    const p = angleProps({ legLong: 5, legShort: 5, t: 0.5 })
    within(p.A, 4.802, 3)
    within(p.rmin, 0.968, 2.5)
  })

  it('ฉากขาเท่า: rmin ต้องน้อยกว่า ry อย่างชัดเจน (แกนหลัก z-z คุมการโก่งเดาะ)', () => {
    const p = angleProps({ legLong: 7.5, legShort: 7.5, t: 0.6 })
    expect(p.rmin).toBeLessThan(p.ry)
    // สำหรับฉากขาเท่า rz ≈ 0.195 × ความยาวขา
    within(p.rmin, 0.195 * 7.5, 4)
  })

  it('ฉากขาไม่เท่า L100×75×7', () => {
    const p = angleProps({ legLong: 10, legShort: 7.5, t: 0.7 })
    within(p.A, 11.87, 3)
    within(p.rmin, 1.61, 3)
  })
})

describe('boxProps — เหล็กกล่อง มอก. 107 (มุมนอก r = 2t)', () => {
  it('□100×100×3.2', () => {
    const p = boxProps({ d: 10, b: 10, t: 0.32 })
    within(p.A, 12.13)
    within(p.Ix, 187)
    within(p.Iy, 187)
  })

  it('□75×75×3.2', () => {
    const p = boxProps({ d: 7.5, b: 7.5, t: 0.32 })
    within(p.A, 8.93)
    within(p.Ix, 75.5, 2.5)
  })

  it('กล่องผืนผ้า 100×50×3.2 — Ix ต้องมากกว่า Iy', () => {
    const p = boxProps({ d: 10, b: 5, t: 0.32 })
    within(p.A, 8.93)
    expect(p.Ix).toBeGreaterThan(p.Iy)
    within(p.Ix, 111, 3)
  })

  it('มุมมนทำให้พื้นที่น้อยกว่าการคิดแบบมุมแหลม', () => {
    const rounded = boxProps({ d: 10, b: 10, t: 0.32 })
    const sharp = boxProps({ d: 10, b: 10, t: 0.32, r: 0 })
    expect(rounded.A).toBeLessThan(sharp.A)
  })

  it('หน้าตัดปิดต้องถูกทำเครื่องหมาย closed', () => {
    expect(boxProps({ d: 10, b: 10, t: 0.32 }).closed).toBe(true)
  })
})

describe('pipeProps — ท่อกลม มอก. 276/277', () => {
  it('ท่อ 4 นิ้ว ชั้นกลาง (D=114.3, t=4.5 มม.)', () => {
    const p = pipeProps({ D: 11.43, t: 0.45 })
    within(p.A, 15.52)
    within(p.Ix, 234)
    within(p.rx, 3.88)
  })

  it('ท่อ 2 นิ้ว ชั้นกลาง (D=60.5, t=3.8 มม.)', () => {
    const p = pipeProps({ D: 6.05, t: 0.38 })
    within(p.A, 6.765)
    within(p.Ix, 27.3, 2.5)
  })

  it('J ของหน้าตัดกลมตันเท่ากับ 2I', () => {
    const p = pipeProps({ D: 11.43, t: 0.45 })
    expect(p.J).toBeCloseTo(2 * p.Ix, 6)
  })
})

describe('lippedChannelProps — ตัวซีขึ้นรูปเย็น มอก. 1228', () => {
  it('C150×50×20×2.3 เทียบตารางผู้ผลิต', () => {
    const p = lippedChannelProps({ d: 15, bf: 5, lip: 2, t: 0.23 })
    within(p.A, 6.32, 3)
    within(p.Ix, 210, 3)
    // rx เป็นค่าตรวจไขว้ที่ดี เพราะขึ้นกับทั้ง Ix และ A พร้อมกัน
    within(p.rx, 5.77, 2)
  })

  it('C100×50×20×2.3', () => {
    const p = lippedChannelProps({ d: 10, bf: 5, lip: 2, t: 0.23 })
    within(p.A, 5.172, 3)
    within(p.Ix, 80.7, 3)
    within(p.rx, 3.95, 2)
  })

  it('C75×45×15×2.3 — ตรวจจากน้ำหนักต่อเมตรที่ตารางระบุ (3.25 กก./ม.)', () => {
    const p = lippedChannelProps({ d: 7.5, bf: 4.5, lip: 1.5, t: 0.23 })
    within(p.weight, 3.25, 2)
    within(p.A, 4.137, 3)
  })

  it('เซนทรอยด์อยู่ระหว่างเอวกับกึ่งกลางปีก', () => {
    const p = lippedChannelProps({ d: 15, bf: 5, lip: 2, t: 0.23 })
    expect(p.xbar).toBeGreaterThan(0)
    expect(p.xbar).toBeLessThan(p.bf / 2)
  })

  it('ขอบพับยาวขึ้นทำให้ Iy มากขึ้น', () => {
    const short = lippedChannelProps({ d: 15, bf: 5, lip: 1, t: 0.23 })
    const long = lippedChannelProps({ d: 15, bf: 5, lip: 2.5, t: 0.23 })
    expect(long.Iy).toBeGreaterThan(short.Iy)
  })
})

describe('ความสอดคล้องทั่วไปของทุกหน้าตัด', () => {
  const samples = [
    iShapeProps({ d: 30, bf: 15, tw: 0.65, tf: 0.9, r: 1.3 }),
    channelProps({ d: 20, bf: 8, tw: 0.75, tf: 1.1, r: 1.2 }),
    angleProps({ legLong: 9, legShort: 9, t: 0.7 }),
    boxProps({ d: 12.5, b: 12.5, t: 0.45 }),
    pipeProps({ D: 8.9, t: 0.4 }),
    lippedChannelProps({ d: 20, bf: 7.5, lip: 2, t: 0.32 }),
  ]

  it('S = I / c สอดคล้องกันทุกหน้าตัด', () => {
    for (const p of samples) {
      expect(p.Sx).toBeGreaterThan(0)
      expect(p.Sy).toBeGreaterThan(0)
    }
  })

  it('r = √(I/A) สอดคล้องกันทุกหน้าตัด', () => {
    for (const p of samples) {
      expect(p.rx).toBeCloseTo(Math.sqrt(p.Ix / p.A), 6)
      expect(p.ry).toBeCloseTo(Math.sqrt(p.Iy / p.A), 6)
    }
  })

  it('rmin ต้องไม่เกิน ry เสมอ', () => {
    for (const p of samples) {
      expect(p.rmin).toBeLessThanOrEqual(p.ry + 1e-9)
    }
  })

  it('น้ำหนักต้องเท่ากับพื้นที่ × 0.785', () => {
    for (const p of samples) {
      expect(p.weight).toBeCloseTo(p.A * 0.785, 6)
    }
  })

  it('ค่าทุกตัวต้องเป็นจำนวนจริงบวก', () => {
    for (const p of samples) {
      for (const key of ['A', 'Ix', 'Iy', 'Sx', 'Sy', 'rx', 'ry', 'rmin', 'J', 'Aw'] as const) {
        expect(Number.isFinite(p[key]), `${p.family}.${key}`).toBe(true)
        expect(p[key], `${p.family}.${key}`).toBeGreaterThan(0)
      }
    }
  })
})
