import { describe, expect, it } from 'vitest'
import {
  CRITERIA_PRINT_PAGES,
  CRITERIA_SECTIONS,
  factor,
  formula,
  printBlocks,
  resolvePrintPart,
  type CriteriaBlock,
} from './criteriaModel'
import data from './designCriteria.json'

describe('เกณฑ์การออกแบบ', () => {
  it('หน้าในรูปเล่มครอบคลุมทุกบล็อกของทุกหมวด ครั้งเดียว ตามลำดับบนหน้าจอ', () => {
    const covered = CRITERIA_PRINT_PAGES.flat().flatMap((part) => {
      const p = resolvePrintPart(part)
      if (!p) throw new Error(`ไม่รู้จักหมวด ${JSON.stringify(part)}`)
      expect(p.from).toBeLessThan(p.to)
      return Array.from({ length: p.to - p.from }, (_, i) => `${p.section.id}:${p.from + i}`)
    })
    const expected = CRITERIA_SECTIONS.flatMap((s) => printBlocks(s).map((_, i) => `${s.id}:${i}`))
    expect(covered).toEqual(expected)
    for (const page of CRITERIA_PRINT_PAGES) expect(page.length).toBeGreaterThan(0)
  })

  it('ทุกแถวของตารางมีจำนวนช่องเท่ากับหัวตาราง หรือเป็นแถวหัวข้อช่องเดียว', () => {
    const tables = (blocks: CriteriaBlock[]): Extract<CriteriaBlock, { type: 'table' }>[] =>
      blocks.flatMap((b) =>
        b.type === 'table' ? [b] : b.type === 'side-by-side' ? tables(b.blocks) : [],
      )
    for (const section of CRITERIA_SECTIONS) {
      for (const table of tables(section.blocks)) {
        expect(table.rows.length).toBeGreaterThan(0)
        for (const row of table.rows) {
          expect([1, table.columns.length]).toContain(row.length)
        }
        // แถวหัวข้ออย่างเดียวโดยไม่มีข้อมูลตามมาไม่มีความหมาย
        expect(table.rows.at(-1)?.length).toBe(table.columns.length)
      }
    }
  })

  it('ตัวคูณแสดงสองตำแหน่ง เว้นแต่มีหลักที่สาม', () => {
    expect(factor(0.9)).toBe('0.90')
    expect(factor(0.6)).toBe('0.60')
    expect(factor(0.625)).toBe('0.625')
  })

  it('ตารางแรงลมมีค่าครบทุกระดับความสูงในทุกภูมิประเทศ', () => {
    const { heights, terrains } = data.design_criteria.wind_load
    for (const t of terrains) expect(t.values).toHaveLength(heights.length)
  })

  it('น้ำหนักบรรทุกจรตามกฎกระทรวง พ.ศ. 2566 ครบทุกกลุ่ม และไม่ต่ำกว่าค่าหลังคา', () => {
    const { groups } = data.design_criteria.live_load
    expect(groups).toHaveLength(7)
    const areas = groups.flatMap((g) => g.occupancies.flatMap((o) => o.areas))
    for (const a of areas) expect(a.value).toBeGreaterThanOrEqual(50)
    const house = groups[5].occupancies.find((o) => o.occupancy === 'บ้านพักอาศัย')
    expect(house?.areas.map((a) => a.value)).toEqual([200, 200])
  })

  it('เขียนสูตรจากไฟล์ข้อมูลให้อ่านง่าย', () => {
    expect(formula("0.29 * sqrt(fc')")).toBe('0.29√f′c')
    expect(formula("0.375 fc'")).toBe('0.375 f′c')
    expect(formula('1 / [1 + fs / (n * fc)]')).toBe('1 / [1 + fs / (n·fc)]')
  })
})
