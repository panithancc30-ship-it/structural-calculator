import { describe, expect, it } from 'vitest'
import { webEffectiveParts } from './coldFormed'
import type { HatDims } from './geometry'
import { resolveSection, DEFAULT_CUSTOM_SECTION } from './section'
import { SECTION_TABLE } from './sectionTable'

const coldFormedIds = SECTION_TABLE.filter(
  (e) => e.category === 'lipped-channel' || e.category === 'g550',
).map((e) => e.id)

describe('หน้าตัดประสิทธิผล (AISI) ต้องไม่เกินหน้าตัดเต็มในทุกขนาดที่มีในตาราง', () => {
  for (const gradeId of ['SSC400', 'G550']) {
    it(`เกรด ${gradeId}: Se ≤ Sx และ Ae ≤ A ทุกหน้าตัด`, () => {
      for (const sectionId of coldFormedIds) {
        const r = resolveSection({
          source: 'table',
          sectionId,
          arrangement: 'single',
          gap: 0,
          connectorSpacing: 60,
          gradeId,
          customFy: 2400,
          custom: DEFAULT_CUSTOM_SECTION,
        })
        expect(r.effective.Se, `${sectionId} Se`).toBeLessThanOrEqual(r.props.Sx + 1e-9)
        expect(r.effective.Ae, `${sectionId} Ae`).toBeLessThanOrEqual(r.props.A + 1e-9)
        expect(r.effective.Se, `${sectionId} Se > 0`).toBeGreaterThan(0)
        expect(r.effective.ratioS, `${sectionId} ratioS`).toBeLessThanOrEqual(1 + 1e-9)
      }
    })
  }

  it('ตัวซี มอก. 1228 หนา 2.3 มม. ที่ Fy 2,400 ใช้หน้าตัดได้เต็ม (ไม่ชะลูด)', () => {
    const r = resolveSection({
      source: 'table',
      sectionId: 'lipped-channel:C150×50×20×2.3',
      arrangement: 'single',
      gap: 0,
      connectorSpacing: 60,
      gradeId: 'SSC400',
      customFy: 2400,
      custom: DEFAULT_CUSTOM_SECTION,
    })
    expect(r.effective.ratioS).toBeGreaterThan(0.97)
  })

  it('ตัวซีบาง 1 มม. G550 ต้องถูกลดหน้าตัดอย่างมีนัยสำคัญ', () => {
    const r = resolveSection({
      source: 'table',
      sectionId: 'g550:C100×40×10×1',
      arrangement: 'single',
      gap: 0,
      connectorSpacing: 60,
      gradeId: 'G550',
      customFy: 2400,
      custom: DEFAULT_CUSTOM_SECTION,
    })
    expect(r.effective.ratioA).toBeLessThan(0.9)
    expect(r.effective.fullyEffective).toBe(false)
  })
})

describe('AISI B2.3 — แบ่งส่วนประสิทธิผลของเอว', () => {
  it('ดัดล้วน (ψ = 1): b1 = be/4, b2 = be/2', () => {
    const p = webEffectiveParts(20, 0.1, 5000, -5000)
    expect(p.b1).toBeCloseTo(p.be / 4, 9)
    expect(p.b2).toBeCloseTo(p.be / 2, 9)
    expect(p.compression).toBeCloseTo(10, 9)
  })

  it('แรงดึงน้อย (ψ = 0.1 ≤ 0.236): b2 = be − b1', () => {
    const p = webEffectiveParts(20, 0.1, 5000, -500)
    expect(p.b2).toBeCloseTo(p.be - p.b1, 9)
  })

  it('ถ้า b1 + b2 ครอบคลุมช่วงรับแรงอัด เอวใช้ได้เต็ม', () => {
    expect(webEffectiveParts(5, 0.2, 2400, -2400).full).toBe(true)
  })
})

describe('แปหมวก — หน้าตัดประสิทธิผลและกำลังคราก', () => {
  const hatIds = SECTION_TABLE.filter((e) => e.category === 'hat').map((e) => e.id)
  const select = (sectionId: string, gradeId: string, hat?: HatDims) => ({
    source: 'table' as const,
    sectionId,
    arrangement: 'single' as const,
    gap: 0,
    connectorSpacing: 60,
    gradeId,
    customFy: 2400,
    custom: DEFAULT_CUSTOM_SECTION,
    hat,
  })
  const scg055 = hatIds.find((id) => id.includes('65×30×0.55'))!
  const scg070 = hatIds.find((id) => id.includes('65×30×0.7'))!
  const profast = hatIds.find((id) => id.includes('Profast'))!

  it('Se ≤ Sx และ Ae ≤ A ทุกขนาด ทุกเกรด ทั้งแรงกดและแรงยก', () => {
    for (const id of hatIds) {
      for (const gradeId of ['G300', 'G550']) {
        for (const bendingSign of [1, -1] as const) {
          const r = resolveSection(select(id, gradeId), { bendingSign })
          expect(r.effective.Se, id).toBeLessThanOrEqual(r.props.Sx + 1e-12)
          expect(r.effective.Ae, id).toBeLessThanOrEqual(r.props.A + 1e-12)
          expect(r.effective.Ie, id).toBeLessThanOrEqual(r.props.Ix + 1e-12)
          expect(r.effective.Se, id).toBeGreaterThan(0)
        }
      }
    }
  })

  it('น้ำหนักเหล็กเปลือยของแป SCG 0.55 ต่ำกว่าน้ำหนักที่ผู้ขายระบุรวมสารเคลือบ (0.575) ไม่เกิน 10%', () => {
    const w = resolveSection(select(scg055, 'G300')).props.weight
    expect(w).toBeLessThan(0.575)
    expect(w).toBeGreaterThan(0.575 * 0.9)
  })

  it('แรงกดลง: สันรับแรงอัดทำให้แปบาง 0.55 ถูกลดหน้าตัด แต่แปหนา 0.70 ถูกลดน้อยกว่า', () => {
    const thin = resolveSection(select(scg055, 'G300')).effective.ratioS
    const thick = resolveSection(select(scg070, 'G300')).effective.ratioS
    expect(thin).toBeLessThan(1)
    expect(thick).toBeGreaterThanOrEqual(thin)
  })

  it('แรงยก: แปที่ไม่มีขอบพับปลายปีกถูกลดหน้าตัดมากกว่าแรงกด', () => {
    const down = resolveSection(select(profast, 'G300'), { bendingSign: 1 }).effective.ratioS
    const up = resolveSection(select(profast, 'G300'), { bendingSign: -1 }).effective.ratioS
    expect(up).toBeLessThan(down)
  })

  it('G550 หนา 0.55 มม. ใช้กำลังครากออกแบบ 4,125 ksc พร้อมคำเตือน', () => {
    const r = resolveSection(select(scg055, 'G550'))
    expect(r.Fy).toBeCloseTo(4125, 6)
    expect(r.yieldReduced).toBe(true)
    expect(r.warnings.join(' ')).toContain('A2.3.2')
  })

  it('G550 หนา 1.0 มม. ไม่ถูกลดกำลังคราก', () => {
    const id = SECTION_TABLE.find((e) => e.id === 'g550:C100×40×10×1')!.id
    expect(resolveSection(select(id, 'G550')).Fy).toBe(5500)
  })

  it('แก้มิติแปหมวกเองแล้ว ชื่อหน้าตัดต้องระบุว่ากำหนดเอง และคุณสมบัติเปลี่ยนตาม', () => {
    const base = resolveSection(select(scg055, 'G300'))
    const dims = { ...SECTION_TABLE.find((e) => e.id === scg055)!.hatDims!, t: 0.1 }
    const edited = resolveSection(select(scg055, 'G300', dims))
    expect(edited.name).toContain('มิติกำหนดเอง')
    expect(edited.props.A).toBeGreaterThan(base.props.A * 1.7)
  })
})
