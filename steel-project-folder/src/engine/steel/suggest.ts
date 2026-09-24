/**
 * แนะนำหน้าตัดที่เบาที่สุดที่ยังผ่านทุกเกณฑ์
 *
 * ไล่ตรวจทุกหน้าตัดในหมวดที่ผู้ใช้ยอมรับได้ด้วยเอนจินตัวเดียวกับที่ใช้ตรวจจริง
 * จึงไม่มีทางที่ผลแนะนำจะขัดกับผลตรวจสอบ
 */

import { calcSteelBeamASD, type SteelBeamInput } from './beamASD'
import { calcSteelColumnASD, type SteelColumnInput } from './columnASD'
import { SECTION_TABLE, type SectionCategory } from './sectionTable'

export interface Suggestion {
  sectionId: string
  name: string
  categoryLabel: string
  /** น้ำหนัก (กก./ม.) */
  weight: number
  /** อัตราส่วนกำลังที่ใช้ไปสูงสุด — ใกล้ 1.00 คือประหยัดที่สุด */
  maxRatio: number
  /** มีรายการที่ต้องระวัง แม้จะไม่ถึงกับไม่ผ่าน */
  hasWarning: boolean
}

const MAX_RESULTS = 6

function collect(
  categories: SectionCategory[],
  run: (sectionId: string) => { weight: number; maxRatio: number; pass: boolean; warn: boolean },
): Suggestion[] {
  const pool = SECTION_TABLE.filter((e) => categories.includes(e.category))
  const passing: Suggestion[] = []

  for (const entry of pool) {
    let outcome
    try {
      outcome = run(entry.id)
    } catch {
      continue
    }
    if (!outcome.pass || !Number.isFinite(outcome.maxRatio)) continue
    passing.push({
      sectionId: entry.id,
      name: entry.name,
      categoryLabel: entry.category,
      weight: outcome.weight,
      maxRatio: outcome.maxRatio,
      hasWarning: outcome.warn,
    })
  }

  return passing.sort((a, b) => a.weight - b.weight).slice(0, MAX_RESULTS)
}

export function suggestBeamSections(
  input: SteelBeamInput,
  categories: SectionCategory[],
): Suggestion[] {
  return collect(categories, (sectionId) => {
    const result = calcSteelBeamASD({
      ...input,
      // ใช้มิติตามตารางเสมอ ไม่ใช้มิติแปหมวกที่ผู้ใช้แก้ไว้กับหน้าตัดที่เลือกอยู่
      section: { ...input.section, source: 'table', sectionId, hat: undefined },
    })
    return {
      weight: result.summary.weight,
      maxRatio: result.summary.maxRatio,
      pass: result.overall !== 'fail',
      warn: result.overall === 'warn',
    }
  })
}

export function suggestColumnSections(
  input: SteelColumnInput,
  categories: SectionCategory[],
): Suggestion[] {
  return collect(categories, (sectionId) => {
    const result = calcSteelColumnASD({
      ...input,
      // ใช้มิติตามตารางเสมอ ไม่ใช้มิติแปหมวกที่ผู้ใช้แก้ไว้กับหน้าตัดที่เลือกอยู่
      section: { ...input.section, source: 'table', sectionId, hat: undefined },
    })
    return {
      weight: result.summary.weight,
      maxRatio: result.summary.maxRatio,
      pass: result.overall !== 'fail',
      warn: result.overall === 'warn',
    }
  })
}
