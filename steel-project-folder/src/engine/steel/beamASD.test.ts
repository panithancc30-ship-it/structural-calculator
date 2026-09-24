import { describe, expect, it } from 'vitest'
import { calcSteelBeamASD, type SteelBeamInput } from './beamASD'
import { calcSteelColumnASD, type SteelColumnInput } from './columnASD'
import { suggestBeamSections } from './suggest'
import { DEFAULT_CUSTOM_SECTION, type SectionSelection } from './section'

const section: SectionSelection = {
  source: 'table',
  sectionId: 'h-narrow:H300×150×6.5×9',
  arrangement: 'single',
  gap: 0,
  connectorSpacing: 60,
  gradeId: 'SS400',
  customFy: 2400,
  custom: DEFAULT_CUSTOM_SECTION,
}

const flatBeam: SteelBeamInput = {
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
  section,
}

const check = (r: ReturnType<typeof calcSteelBeamASD>, id: string) =>
  r.checks.find((c) => c.id === id)
const step = (r: ReturnType<typeof calcSteelBeamASD>, symbol: string) =>
  r.steps.find((s) => s.symbol === symbol)!

describe('คานราบ (θm = 0°, θs = 0°)', () => {
  const r = calcSteelBeamASD(flatBeam)

  it('ไม่เกิดโมเมนต์รอบแกนอ่อน', () => {
    expect(step(r, 'My').value).toBeCloseTo(0, 6)
  })

  it('โมเมนต์ทั้งหมดลงแกนแข็ง', () => {
    expect(step(r, 'Mx').value).toBeCloseTo(3000, 6)
  })

  it('ไม่มีรายการตรวจการดัดสองแกน', () => {
    expect(check(r, 'bending-y')).toBeUndefined()
    expect(check(r, 'bending-combined')).toBeUndefined()
  })

  it('มีรายการตรวจการดัด เฉือน และการโก่งตัว', () => {
    expect(check(r, 'bending-x')).toBeDefined()
    expect(check(r, 'shear-y')).toBeDefined()
    expect(check(r, 'deflection')).toBeDefined()
  })

  it('fbx = Mx / Sx คำนวณถูกต้อง', () => {
    const Sx = step(r, 'Sx').value
    expect(check(r, 'bending-x')!.actual).toBeCloseTo((3000 * 100) / Sx, 3)
  })
})

describe('แป — หน้าตัดวางเอียงตามหลังคา (θs ≠ 0)', () => {
  // ความชันหลังคา 1:2 → 26.565°
  const purlin: SteelBeamInput = { ...flatBeam, sectionAngle: 26.565 }
  const r = calcSteelBeamASD(purlin)

  it('แยกโมเมนต์เป็นสองแกนตาม cos θs และ sin θs', () => {
    expect(step(r, 'Mx').value).toBeCloseTo(3000 * Math.cos((26.565 * Math.PI) / 180), 2)
    expect(step(r, 'My').value).toBeCloseTo(3000 * Math.sin((26.565 * Math.PI) / 180), 2)
  })

  it('ผลรวมกำลังสองของสองแกนต้องเท่ากับโมเมนต์เดิม', () => {
    const Mx = step(r, 'Mx').value
    const My = step(r, 'My').value
    expect(Math.sqrt(Mx ** 2 + My ** 2)).toBeCloseTo(3000, 2)
  })

  it('เพิ่มรายการตรวจการดัดรอบแกนอ่อนและการดัดสองแกน', () => {
    expect(check(r, 'bending-y')).toBeDefined()
    expect(check(r, 'bending-combined')).toBeDefined()
  })

  it('อัตราส่วนรวมสองแกนต้องเท่ากับผลบวกของอัตราส่วนแต่ละแกน', () => {
    const combined = check(r, 'bending-combined')!
    expect(combined.actual).toBeCloseTo(
      check(r, 'bending-x')!.ratio + check(r, 'bending-y')!.ratio,
      6,
    )
  })

  it('หน้าตัดเอียงทำให้วิกฤตกว่าคานราบเสมอ', () => {
    const flat = calcSteelBeamASD(flatBeam)
    expect(r.summary.maxRatio).toBeGreaterThan(flat.summary.maxRatio)
  })

  it('เพิ่มการตรวจแรงเฉือนในทิศขนานหลังคา', () => {
    expect(check(r, 'shear-x')).toBeDefined()
  })
})

describe('เหล็กยึดทางข้าง (sag rod) ลดโมเมนต์แกนอ่อน', () => {
  const base: SteelBeamInput = { ...flatBeam, sectionAngle: 30 }

  it('1 ตัวกลางช่วง ลดโมเมนต์แกนอ่อนเหลือ 1/4', () => {
    const none = calcSteelBeamASD({ ...base, sagRods: 'none' })
    const one = calcSteelBeamASD({ ...base, sagRods: 'one' })
    expect(step(one, 'My').value).toBeCloseTo(step(none, 'My').value * 0.25, 4)
  })

  it('2 ตัวที่จุด 1/3 ลดเหลือ 1/9', () => {
    const none = calcSteelBeamASD({ ...base, sagRods: 'none' })
    const two = calcSteelBeamASD({ ...base, sagRods: 'two' })
    expect(step(two, 'My').value).toBeCloseTo(step(none, 'My').value / 9, 4)
  })

  it('ไม่กระทบโมเมนต์รอบแกนแข็ง', () => {
    const none = calcSteelBeamASD({ ...base, sagRods: 'none' })
    const one = calcSteelBeamASD({ ...base, sagRods: 'one' })
    expect(step(one, 'Mx').value).toBeCloseTo(step(none, 'Mx').value, 6)
  })

  it('ทำให้อัตราส่วนกำลังที่ใช้ไปลดลง', () => {
    const none = calcSteelBeamASD({ ...base, sagRods: 'none' })
    const one = calcSteelBeamASD({ ...base, sagRods: 'one' })
    expect(one.summary.maxRatio).toBeLessThan(none.summary.maxRatio)
  })
})

describe('จันทัน — ชิ้นส่วนวางเอียง (θm ≠ 0)', () => {
  it('ช่วงที่ป้อนแบบแนวราบถูกแปลงเป็นช่วงตามความลาด', () => {
    const r = calcSteelBeamASD({
      ...flatBeam,
      memberAngle: 30,
      spanBasis: 'horizontal',
      span: 4,
    })
    expect(step(r, 'L').value).toBeCloseTo(4 / Math.cos((30 * Math.PI) / 180), 4)
  })

  it('ถ้าป้อนช่วงตามความลาดอยู่แล้ว ไม่ต้องแปลง', () => {
    const r = calcSteelBeamASD({
      ...flatBeam,
      memberAngle: 30,
      spanBasis: 'slope',
      span: 4,
    })
    expect(step(r, 'L').value).toBeCloseTo(4, 6)
  })

  it('มุมชิ้นส่วนอย่างเดียวไม่ทำให้เกิดการดัดสองแกน', () => {
    const r = calcSteelBeamASD({ ...flatBeam, memberAngle: 30 })
    expect(check(r, 'bending-y')).toBeUndefined()
  })

  it('มีแรงตามแกนร่วมด้วย → เปลี่ยนไปใช้สมการแรงร่วม AISC H1', () => {
    const r = calcSteelBeamASD({ ...flatBeam, memberAngle: 30, axial: 5000 })
    expect(check(r, 'bending-x')).toBeUndefined()
    const combined = r.checks.filter((c) => c.id.startsWith('combined-'))
    expect(combined.length).toBeGreaterThan(0)
    expect(check(r, 'slenderness')).toBeDefined()
  })
})

describe('การโก่งตัวย้อนคำนวณจากโมเมนต์', () => {
  it('แรงกระจายสม่ำเสมอ: δ = 5ML²/(48EI)', () => {
    const r = calcSteelBeamASD(flatBeam)
    const Ix = 7210 // H300×150×6.5×9 โดยประมาณ
    const expected = ((5 / 48) * 3000 * 100 * 600 ** 2) / (2_040_000 * Ix)
    expect(check(r, 'deflection')!.actual).toBeCloseTo(expected, 0)
  })

  it('เกณฑ์ที่ยอมให้คือ L / ตัวเลขที่เลือก', () => {
    const r = calcSteelBeamASD({ ...flatBeam, deflectionLimit: 360 })
    expect(check(r, 'deflection')!.allowable).toBeCloseTo(600 / 360, 6)
  })

  it('เลือก "ไม่ตรวจ" แล้วต้องไม่มีรายการโก่งตัว', () => {
    const r = calcSteelBeamASD({ ...flatBeam, deflectionPattern: 'none' })
    expect(check(r, 'deflection')).toBeUndefined()
  })

  it('คานยื่นโก่งตัวมากกว่าคานช่วงเดียวที่โมเมนต์เท่ากัน', () => {
    const simple = calcSteelBeamASD(flatBeam)
    const canti = calcSteelBeamASD({ ...flatBeam, deflectionPattern: 'cantilever' })
    expect(check(canti, 'deflection')!.actual).toBeGreaterThan(
      check(simple, 'deflection')!.actual,
    )
  })

  it('หน้าตัดเอียงทำให้การโก่งตัวเป็นผลลัพธ์ของสองทิศทาง', () => {
    const r = calcSteelBeamASD({ ...flatBeam, sectionAngle: 30 })
    const flat = calcSteelBeamASD(flatBeam)
    expect(check(r, 'deflection')!.actual).toBeGreaterThan(check(flat, 'deflection')!.actual)
    expect(check(r, 'deflection')!.note).toContain('ขนานหลังคา')
  })
})

describe('การค้ำยันปีกอัด', () => {
  it('ช่วงไร้การค้ำยันยาวขึ้นทำให้หน่วยแรงดัดที่ยอมให้ลดลง', () => {
    const braced = calcSteelBeamASD({ ...flatBeam, unbracedLength: 1 })
    const free = calcSteelBeamASD({ ...flatBeam, unbracedLength: 6 })
    expect(check(free, 'bending-x')!.allowable).toBeLessThan(
      check(braced, 'bending-x')!.allowable,
    )
  })

  it('เมื่อเกิน Lc ต้องมีคำเตือนเรื่องการโก่งเดาะด้านข้าง', () => {
    const r = calcSteelBeamASD({ ...flatBeam, unbracedLength: 8 })
    expect(r.warnings.join(' ')).toContain('โก่งเดาะด้านข้าง')
  })
})

describe('หน้าตัดประกอบ', () => {
  const twoChannels: SteelBeamInput = {
    ...flatBeam,
    sectionAngle: 30,
    section: {
      ...section,
      sectionId: 'channel:C150×75×6.5×10',
      arrangement: '2c-back',
      gap: 0,
    },
  }

  it('ประกบสองท่อนทำให้แข็งแรงรอบแกนอ่อนขึ้นมาก', () => {
    const single = calcSteelBeamASD({
      ...twoChannels,
      section: { ...twoChannels.section, arrangement: 'single' },
    })
    const built = calcSteelBeamASD(twoChannels)
    expect(check(built, 'bending-y')!.actual).toBeLessThan(check(single, 'bending-y')!.actual)
  })

  it('เพิ่มรายการตรวจระยะห่างจุดยึด', () => {
    expect(check(calcSteelBeamASD(twoChannels), 'connector-spacing')).toBeDefined()
  })

  it('จุดยึดห่างเกินไปต้องไม่ผ่าน', () => {
    const r = calcSteelBeamASD({
      ...twoChannels,
      axial: 5000,
      section: { ...twoChannels.section, connectorSpacing: 400 },
    })
    expect(check(r, 'connector-spacing')!.status).toBe('fail')
  })

  it('รางน้ำปีกสอบต้องมีคำเตือนเรื่องค่าแกนอ่อน', () => {
    expect(calcSteelBeamASD(twoChannels).warnings.join(' ')).toContain('ปีกสอบ')
  })
})

describe('เหล็กขึ้นรูปเย็น G550', () => {
  const g550: SteelBeamInput = {
    ...flatBeam,
    moment: 200,
    shear: 200,
    span: 1.2,
    unbracedLength: 1.2,
    section: {
      ...section,
      sectionId: 'g550:C100×40×10×1',
      gradeId: 'G550',
    },
  }

  it('ใช้โมดูลัสหน้าตัดประสิทธิผลที่น้อยกว่าหน้าตัดเต็ม', () => {
    const r = calcSteelBeamASD(g550)
    expect(step(r, 'Sx').label).toContain('ประสิทธิผล')
    expect(step(r, 'Sx').value).toBeLessThan(10)
  })

  it('มีคำเตือนว่าหน้าตัดโก่งเดาะเฉพาะที่', () => {
    expect(calcSteelBeamASD(g550).warnings.join(' ')).toMatch(/โก่งเดาะเฉพาะที่|ขอบพับ/)
  })

  it('หน่วยแรงดัดที่ยอมให้ต้องไม่เกิน 0.60Fy ตาม AISI', () => {
    const r = calcSteelBeamASD(g550)
    expect(check(r, 'bending-x')!.allowable).toBeLessThanOrEqual(0.6 * 5500 + 1)
  })
})

describe('เสาเหล็ก', () => {
  const column: SteelColumnInput = {
    axial: 40000,
    momentX: 1500,
    momentY: 300,
    shear: 1000,
    lengthX: 4,
    lengthY: 4,
    Kx: 1,
    Ky: 1,
    Cmx: 0.85,
    Cmy: 0.85,
    Cb: 1,
    section: { ...section, sectionId: 'h-wide:H200×200×8×12' },
  }

  const colCheck = (r: ReturnType<typeof calcSteelColumnASD>, id: string) =>
    r.checks.find((c) => c.id === id)

  it('ตรวจทั้ง H1-1 และ H1-2 เมื่อแรงอัดมีนัยสำคัญ', () => {
    const r = calcSteelColumnASD(column)
    expect(colCheck(r, 'combined-H1-1')).toBeDefined()
    expect(colCheck(r, 'combined-H1-2')).toBeDefined()
  })

  it('ความชะลูดควบคุมโดยแกนอ่อนเมื่อความยาวสองแกนเท่ากัน', () => {
    const r = calcSteelColumnASD(column)
    expect(colCheck(r, 'slenderness')!.label).toContain('แกนอ่อน')
  })

  it('เสายาวขึ้นทำให้หน่วยแรงอัดที่ยอมให้ลดลง', () => {
    const short = calcSteelColumnASD({ ...column, lengthX: 2, lengthY: 2 })
    const tall = calcSteelColumnASD({ ...column, lengthX: 8, lengthY: 8 })
    expect(colCheck(tall, 'axial')!.allowable).toBeLessThan(
      colCheck(short, 'axial')!.allowable,
    )
  })

  it('เสาชะลูดเกิน KL/r = 200 ต้องไม่ผ่าน', () => {
    const r = calcSteelColumnASD({ ...column, lengthX: 12, lengthY: 12, Ky: 2.1 })
    expect(colCheck(r, 'slenderness')!.status).toBe('fail')
  })

  it('แรงดึงใช้ Ft = 0.60Fy และขีดจำกัดความชะลูด 300', () => {
    const r = calcSteelColumnASD({ ...column, axial: -40000 })
    expect(colCheck(r, 'tension')!.allowable).toBeCloseTo(1440, 0)
    expect(colCheck(r, 'slenderness')!.allowable).toBe(300)
  })
})

describe('แนะนำหน้าตัดประหยัดสุด', () => {
  it('คืนหน้าตัดที่ผ่านจริง เรียงจากเบาไปหนัก', () => {
    const list = suggestBeamSections(flatBeam, ['h-narrow', 'h-wide'])
    expect(list.length).toBeGreaterThan(0)
    for (let i = 1; i < list.length; i++) {
      expect(list[i].weight).toBeGreaterThanOrEqual(list[i - 1].weight)
    }
  })

  it('ทุกหน้าตัดที่แนะนำต้องผ่านเมื่อนำไปตรวจซ้ำ', () => {
    for (const s of suggestBeamSections(flatBeam, ['h-narrow'])) {
      const verify = calcSteelBeamASD({
        ...flatBeam,
        section: { ...section, sectionId: s.sectionId },
      })
      expect(verify.overall, s.name).not.toBe('fail')
    }
  })

  it('แรงมากขึ้นต้องได้หน้าตัดที่หนักขึ้น', () => {
    const light = suggestBeamSections(flatBeam, ['h-narrow'])
    const heavy = suggestBeamSections({ ...flatBeam, moment: 20000 }, ['h-narrow'])
    expect(heavy[0].weight).toBeGreaterThan(light[0].weight)
  })

  it('ถ้าไม่มีหน้าตัดใดผ่านเลย ต้องคืนรายการว่าง', () => {
    expect(suggestBeamSections({ ...flatBeam, moment: 5_000_000 }, ['h-narrow'])).toEqual([])
  })
})

describe('รายการตรวจความชะลูดขององค์ประกอบหน้าตัด', () => {
  it('แสดงขีดจำกัดจริง ไม่ใช่ค่าเดียวกับที่เกิดขึ้น', () => {
    const r = calcSteelBeamASD({
      ...flatBeam,
      section: { ...section, sectionId: 'square-tube:□150×150×3.2' },
    })
    // □150×150×3.2: ผนังราบ b/t ≈ 42.9 เกินขีดจำกัด 40.7 ของ SS400
    const c = check(r, 'local-buckling')!
    expect(c).toBeDefined()
    expect(c.allowable).toBeCloseTo(40.7, 0)
    expect(c.ratio).toBeGreaterThan(1)
  })

  it('เหล็กขึ้นรูปเย็นไม่เตือนซ้ำ เพราะคิดไว้แล้วในหน้าตัดประสิทธิผล', () => {
    const r = calcSteelBeamASD({
      ...flatBeam,
      moment: 50,
      shear: 50,
      span: 1,
      unbracedLength: 0.3,
      section: { ...section, sectionId: 'g550:C100×40×10×1', gradeId: 'G550' },
    })
    expect(check(r, 'local-buckling')).toBeUndefined()
  })
})

describe('ความชะลูดของคานที่มีแรงอัด ตรวจทั้งสองแกน', () => {
  it('จันทันที่ค้ำยันแกนอ่อนถี่ ยังถูกควบคุมด้วยความชะลูดรอบแกนแข็งตลอดช่วง', () => {
    const r = calcSteelBeamASD({
      ...flatBeam,
      axial: 3000,
      memberAngle: 26.57,
      span: 8,
      unbracedLength: 0.5,
    })
    const s = check(r, 'slenderness')!
    const rx = 12.4 // H300×150×6.5×9 โดยประมาณ
    expect(s.actual).toBeCloseTo(800 / rx, -1)
    expect(s.note).toContain('แกนแข็ง')
  })
})

describe('โมเมนต์ติดลบ (แรงยก)', () => {
  it('หน้าตัดสมมาตรให้อัตราส่วนเท่ากับโมเมนต์บวก — ต้องไม่ผ่านโดยอัตโนมัติ', () => {
    const up = calcSteelBeamASD({ ...flatBeam, moment: -3000, shear: -2000 })
    const down = calcSteelBeamASD(flatBeam)
    expect(check(up, 'bending-x')!.ratio).toBeCloseTo(check(down, 'bending-x')!.ratio, 9)
    expect(check(up, 'shear-y')!.ratio).toBeCloseTo(check(down, 'shear-y')!.ratio, 9)
    expect(check(up, 'bending-x')!.actual).toBeGreaterThan(0)
  })

  it('โมเมนต์มหาศาลติดลบต้องไม่ผ่าน', () => {
    expect(calcSteelBeamASD({ ...flatBeam, moment: -500000 }).overall).toBe('fail')
  })
})

describe('แปหมวกในคานเหล็ก', () => {
  const hat = {
    ...flatBeam,
    moment: 3.3,
    shear: 20,
    span: 1,
    unbracedLength: 1,
    sectionAngle: 26.57,
    deflectionLimit: 200,
    section: { ...section, sectionId: 'hat:Ω65×30×0.55 (SCG/CPAC)', gradeId: 'G300' },
  }

  it('ใช้งานแปรับกระเบื้องตามจริง (จันทันห่าง 1 ม.) ผ่านทุกเกณฑ์', () => {
    expect(calcSteelBeamASD(hat).overall).not.toBe('fail')
  })

  it('หน้าตัดกว้างกว่าสูง (Iy ≥ Ix) หน่วยแรงดัดไม่ลดลงเมื่อช่วงไร้การค้ำยันยาวขึ้น', () => {
    const short = check(calcSteelBeamASD({ ...hat, unbracedLength: 0.3 }), 'bending-x')!.allowable
    const long = check(calcSteelBeamASD({ ...hat, unbracedLength: 3 }), 'bending-x')!.allowable
    expect(long).toBe(short)
  })

  it('แรงยกกับแรงกดขนาดเท่ากันให้ผลต่างกัน เพราะหน้าตัดไม่สมมาตรรอบแกนนอน', () => {
    const profast = { ...hat.section, sectionId: 'hat:Ω61×27×0.55 (Profast)' }
    const down = calcSteelBeamASD({ ...hat, section: profast })
    const up = calcSteelBeamASD({ ...hat, moment: -3.3, section: profast })
    expect(check(up, 'bending-x')!.actual).toBeGreaterThan(check(down, 'bending-x')!.actual)
  })

  it('ตัวช่วยแนะนำหน้าตัดใช้มิติในตาราง ไม่ใช่มิติที่ผู้ใช้แก้ไว้', () => {
    const edited = {
      ...hat,
      section: { ...hat.section, hat: { d: 1, bf: 2, crown: 0.8, webBottom: 0.8, lip: 0, t: 0.03 } },
    }
    const list = suggestBeamSections(edited, ['hat'])
    expect(list.length).toBeGreaterThan(0)
    for (const s of list) {
      expect(s.weight).toBeGreaterThan(0.4)
    }
  })
})
