import { describe, expect, it } from 'vitest'
import {
  allowableAxial,
  allowableBendingStrong,
  allowableBendingWeak,
  allowableShear,
  allowableTension,
  classifySection,
  combinedStress,
  slendernessLimits,
  unbracedLimitLc,
} from './asd'
import { effectiveWidth, webBucklingCoef } from './coldFormed'
import { boxProps, channelProps, iShapeProps } from './geometry'

/** SS400 — เกรดที่ใช้มากที่สุดในไทย */
const FY = 2400

describe('slendernessLimits — เทียบตาราง AISC B5.1 ที่แปลงเป็นหน่วย ksc', () => {
  const lim = slendernessLimits(FY)

  it('ปีกหน้าตัด I ที่ถือว่าแน่นตัว bf/2tf ≤ 11.1', () => {
    expect(lim.flangeCompact).toBeCloseTo(11.13, 1)
  })

  it('เอวรับการดัดที่ถือว่าแน่นตัว h/tw ≤ 109.5', () => {
    expect(lim.webCompact).toBeCloseTo(109.5, 0)
  })

  it('เอวที่ยังใช้ Fv = 0.40Fy ได้เต็ม h/tw ≤ 65', () => {
    expect(lim.shearFull).toBeCloseTo(65.0, 0)
  })

  it('ปีกหน้าตัดกล่องที่ถือว่าแน่นตัว b/t ≤ 32.5', () => {
    expect(lim.boxFlangeCompact).toBeCloseTo(32.5, 0)
  })

  it('เหล็กกำลังสูงมีขีดจำกัดต่ำกว่า เพราะโก่งเดาะก่อนถึงกำลังคราก', () => {
    expect(slendernessLimits(3200).flangeCompact).toBeLessThan(lim.flangeCompact)
  })
})

describe('classifySection — หน้าตัดรีดร้อนทั่วไปต้องเป็น compact', () => {
  it('H400×200×8×13 เป็น compact', () => {
    const p = iShapeProps({ d: 40, bf: 20, tw: 0.8, tf: 1.3, r: 1.6 })
    expect(classifySection(p, FY)).toBe('compact')
  })

  it('H200×100×5.5×8 เป็น compact', () => {
    const p = iShapeProps({ d: 20, bf: 10, tw: 0.55, tf: 0.8, r: 1.1 })
    expect(classifySection(p, FY)).toBe('compact')
  })

  it('กล่อง 100×100×3.2 เป็น compact', () => {
    expect(classifySection(boxProps({ d: 10, b: 10, t: 0.32 }), FY)).toBe('compact')
  })

  it('กล่องผนังบางมาก 150×150×1.6 ต้องไม่ใช่ compact', () => {
    expect(classifySection(boxProps({ d: 15, b: 15, t: 0.16 }), FY)).not.toBe('compact')
  })
})

describe('allowableAxial — เทียบการคำนวณมือ AISC E2 (SS400)', () => {
  it('Cc = √(2π²E/Fy) ≈ 129.5', () => {
    expect(allowableAxial(FY, 100).Cc).toBeCloseTo(129.53, 1)
  })

  it('KL/r = 50 → Fa ≈ 1,231 ksc', () => {
    expect(allowableAxial(FY, 50).Fa).toBeCloseTo(1231, -1)
  })

  it('KL/r = 100 → Fa ≈ 887 ksc', () => {
    expect(allowableAxial(FY, 100).Fa).toBeCloseTo(887, -1)
  })

  it('KL/r = 150 → เสายาว ใช้สูตรยืดหยุ่น Fa ≈ 467 ksc', () => {
    const r = allowableAxial(FY, 150)
    expect(r.elastic).toBe(true)
    expect(r.Fa).toBeCloseTo(467, -1)
  })

  it('ที่ KL/r = Cc พอดี ตัวคูณความปลอดภัยต้องเท่ากับ 23/12', () => {
    const Cc = allowableAxial(FY, 1).Cc
    expect(allowableAxial(FY, Cc).FS).toBeCloseTo(23 / 12, 4)
  })

  it('ทั้งสองสูตรต้องต่อกันได้พอดีที่ KL/r = Cc', () => {
    const Cc = allowableAxial(FY, 1).Cc
    const below = allowableAxial(FY, Cc - 0.001).Fa
    const above = allowableAxial(FY, Cc + 0.001).Fa
    expect(Math.abs(below - above)).toBeLessThan(1)
  })

  it('Fa ต้องลดลงเสมอเมื่อความชะลูดเพิ่ม', () => {
    let previous = Infinity
    for (const s of [20, 40, 60, 80, 100, 120, 140, 160, 180, 200]) {
      const Fa = allowableAxial(FY, s).Fa
      expect(Fa).toBeLessThan(previous)
      previous = Fa
    }
  })
})

describe('allowableBendingStrong — AISC F1', () => {
  const h400 = iShapeProps({ d: 40, bf: 20, tw: 0.8, tf: 1.3, r: 1.6 })

  it('Lc ของ H400×200×8×13 ≈ 2.60 ม.', () => {
    expect(unbracedLimitLc(h400, FY)).toBeCloseTo(260, -1)
  })

  it('ค้ำยันเพียงพอ + แน่นตัว → Fb = 0.66Fy = 1,584 ksc', () => {
    const r = allowableBendingStrong(h400, FY, 200, 1)
    expect(r.Fb).toBeCloseTo(1584, 0)
    expect(r.formula).toBe('Fb = 0.66Fy')
  })

  it('Lb = 6 ม. เกิน Lc มาก → ลดเหลือประมาณ 915 ksc', () => {
    const r = allowableBendingStrong(h400, FY, 600, 1)
    expect(r.Fb).toBeCloseTo(915, -1)
    expect(r.mode).toContain('LTB')
  })

  it('Cb ที่สูงขึ้นทำให้ Fb สูงขึ้น แต่ไม่เกิน 0.60Fy', () => {
    const cb1 = allowableBendingStrong(h400, FY, 600, 1).Fb
    const cb23 = allowableBendingStrong(h400, FY, 600, 2.3).Fb
    expect(cb23).toBeGreaterThan(cb1)
    expect(cb23).toBeLessThanOrEqual(0.6 * FY + 1e-6)
  })

  it('Fb ต้องลดลงต่อเนื่องเมื่อความยาวไร้การค้ำยันเพิ่ม', () => {
    let previous = Infinity
    for (const Lb of [300, 400, 500, 600, 800, 1000]) {
      const Fb = allowableBendingStrong(h400, FY, Lb, 1).Fb
      expect(Fb).toBeLessThanOrEqual(previous)
      previous = Fb
    }
  })

  it('หน้าตัดปิดไม่ถูกลดจากการโก่งเดาะด้านข้าง แม้ช่วงยาวมาก', () => {
    const box = boxProps({ d: 15, b: 15, t: 0.45 })
    const short = allowableBendingStrong(box, FY, 100, 1).Fb
    const long = allowableBendingStrong(box, FY, 2000, 1).Fb
    expect(long).toBe(short)
  })
})

describe('allowableBendingWeak — AISC F2', () => {
  it('หน้าตัด I ปีกแน่นตัว ดัดรอบแกนอ่อน → Fb = 0.75Fy', () => {
    const p = iShapeProps({ d: 20, bf: 20, tw: 0.8, tf: 1.2, r: 1.3 })
    expect(allowableBendingWeak(p, FY).Fb).toBeCloseTo(0.75 * FY, 0)
  })

  it('แกนอ่อนไม่ขึ้นกับความยาวไร้การค้ำยัน', () => {
    const p = iShapeProps({ d: 20, bf: 20, tw: 0.8, tf: 1.2, r: 1.3 })
    expect(allowableBendingWeak(p, FY).Lc).toBe(Infinity)
  })
})

describe('allowableShear และ allowableTension', () => {
  it('เอวไม่ชะลูด → Fv = 0.40Fy = 960 ksc', () => {
    const p = iShapeProps({ d: 40, bf: 20, tw: 0.8, tf: 1.3, r: 1.6 })
    const r = allowableShear(p, FY)
    expect(r.Fv).toBeCloseTo(960, 0)
    expect(r.reduced).toBe(false)
  })

  it('เอวชะลูดมากต้องถูกลด', () => {
    const p = iShapeProps({ d: 100, bf: 20, tw: 0.5, tf: 1.0 })
    const r = allowableShear(p, FY)
    expect(r.reduced).toBe(true)
    expect(r.Fv).toBeLessThan(0.4 * FY)
  })

  it('Ft = 0.60Fy = 1,440 ksc', () => {
    expect(allowableTension(FY)).toBeCloseTo(1440, 0)
  })
})

describe('combinedStress — AISC H1', () => {
  it('แรงอัดน้อย (fa/Fa ≤ 0.15) ใช้สมการรวมอย่างง่าย H1-3', () => {
    const r = combinedStress(100, 1000, 500, 1584, 0, 1800, FY, 0.85, 0.85, 2000, 2000)
    expect(r).toHaveLength(1)
    expect(r[0].equation).toBe('H1-3')
    expect(r[0].ratio).toBeCloseTo(0.1 + 500 / 1584, 4)
  })

  it('แรงอัดมากต้องตรวจทั้ง H1-1 และ H1-2', () => {
    const r = combinedStress(300, 1000, 500, 1584, 0, 1800, FY, 0.85, 0.85, 2000, 2000)
    expect(r.map((x) => x.equation)).toEqual(['H1-1', 'H1-2'])
  })

  it('H1-1 มีตัวคูณขยายโมเมนต์ 1/(1 − fa/F\'e)', () => {
    const r = combinedStress(300, 1000, 500, 1584, 0, 1800, FY, 0.85, 0.85, 2000, 2000)
    // 0.30 + 0.85 × (500/1584) × 1/(1 − 300/2000)
    const expected = 0.3 + 0.85 * (500 / 1584) * (1 / (1 - 300 / 2000))
    expect(r[0].ratio).toBeCloseTo(expected, 4)
  })

  it('H1-2 ใช้ 0.60Fy เป็นตัวหารของแรงอัด', () => {
    const r = combinedStress(300, 1000, 500, 1584, 0, 1800, FY, 0.85, 0.85, 2000, 2000)
    expect(r[1].ratio).toBeCloseTo(300 / 1440 + 500 / 1584, 4)
  })

  it('การดัดสองแกนพร้อมกันต้องรวมอัตราส่วนทั้งสอง', () => {
    const one = combinedStress(50, 1000, 500, 1584, 0, 1800, FY, 1, 1, 9999, 9999)[0].ratio
    const two = combinedStress(50, 1000, 500, 1584, 400, 1800, FY, 1, 1, 9999, 9999)[0].ratio
    expect(two - one).toBeCloseTo(400 / 1800, 6)
  })
})

describe('effectiveWidth — AISI B2.1 สำหรับเหล็กขึ้นรูปเย็น', () => {
  it('แผ่นที่ไม่ชะลูดใช้ได้เต็มความกว้าง', () => {
    // ตัวซี SSC400 ทั่วไป: ปีกราบ 4.08 ซม. หนา 0.23 ซม.
    expect(effectiveWidth(4.08, 0.23, 2400, 4)).toBeCloseTo(4.08, 6)
  })

  it('ตัวซี G550 ผนังบาง 1 มม. ต้องถูกลดลงเหลือราว 72%', () => {
    const b = effectiveWidth(4.1, 0.1, 5500, 4)
    expect(b / 4.1).toBeCloseTo(0.7175, 3)
  })

  it('ความกว้างประสิทธิผลต้องไม่เกินความกว้างจริง', () => {
    for (const w of [1, 2, 5, 10, 20]) {
      expect(effectiveWidth(w, 0.1, 5500, 4)).toBeLessThanOrEqual(w)
    }
  })

  it('แผ่นขอบอิสระ (k = 0.43) ถูกลดมากกว่าแผ่นที่ยึดสองขอบ (k = 4)', () => {
    expect(effectiveWidth(4.1, 0.1, 5500, 0.43)).toBeLessThan(
      effectiveWidth(4.1, 0.1, 5500, 4),
    )
  })

  it('หน่วยแรงสูงขึ้นทำให้ความกว้างประสิทธิผลลดลง', () => {
    expect(effectiveWidth(5, 0.1, 5500, 4)).toBeLessThan(effectiveWidth(5, 0.1, 2400, 4))
  })

  it('เอวที่รับการดัดล้วน (ψ = −1) ต้องได้ k = 24', () => {
    expect(webBucklingCoef(-1)).toBeCloseTo(24, 6)
  })
})

describe('รางน้ำรับการดัดรอบแกนแข็ง — AISC F1.3 ใช้สูตร F1-8 เท่านั้น', () => {
  const c150 = channelProps({ d: 15, bf: 7.5, tw: 0.65, tf: 1.0, r: 1.0 })

  it('เมื่อเกิน Lc หน่วยแรงที่ยอมให้ต้องเท่ากับ F1-8 พอดี', () => {
    const Lb = 400
    const r = allowableBendingStrong(c150, FY, Lb, 1)
    const f18 = ((12000 / 29000) * 2_040_000) / (Lb * c150.dAf)
    expect(r.Fb).toBeCloseTo(Math.min(f18, 0.6 * FY), 3)
    expect(r.formula).toContain('F1-8')
  })

  it('ต้องไม่เกินค่าที่หน้าตัด I ได้จากสูตร F1-6/F1-7 ภายใต้เงื่อนไขเดียวกัน', () => {
    const asI = allowableBendingStrong({ ...c150, family: 'i-shape' }, FY, 400, 1)
    expect(allowableBendingStrong(c150, FY, 400, 1).Fb).toBeLessThanOrEqual(asI.Fb)
  })
})
