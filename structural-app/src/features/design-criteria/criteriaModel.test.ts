import { describe, expect, it } from 'vitest'
import { CRITERIA_PRINT_PAGES, CRITERIA_SECTIONS, formula, type CriteriaBlock } from './criteriaModel'

describe('เกณฑ์การออกแบบ', () => {
  it('หน้าในรูปเล่มครอบคลุมทุกหมวด ครั้งเดียว ตามลำดับบนหน้าจอ', () => {
    expect(CRITERIA_PRINT_PAGES.flat()).toEqual(CRITERIA_SECTIONS.map((s) => s.id))
    for (const page of CRITERIA_PRINT_PAGES) expect(page.length).toBeGreaterThan(0)
  })

  it('ทุกแถวของตารางมีจำนวนช่องเท่ากับหัวตาราง', () => {
    const tables = (blocks: CriteriaBlock[]): Extract<CriteriaBlock, { type: 'table' }>[] =>
      blocks.flatMap((b) =>
        b.type === 'table' ? [b] : b.type === 'side-by-side' ? tables(b.blocks) : [],
      )
    for (const section of CRITERIA_SECTIONS) {
      for (const table of tables(section.blocks)) {
        expect(table.rows.length).toBeGreaterThan(0)
        for (const row of table.rows) expect(row).toHaveLength(table.columns.length)
      }
    }
  })

  it('เขียนสูตรจากไฟล์ข้อมูลให้อ่านง่าย', () => {
    expect(formula("0.29 * sqrt(fc')")).toBe('0.29√f′c')
    expect(formula("0.375 fc'")).toBe('0.375 f′c')
    expect(formula('1 / [1 + fs / (n * fc)]')).toBe('1 / [1 + fs / (n·fc)]')
  })
})
