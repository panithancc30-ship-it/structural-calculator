import { describe, expect, it } from 'vitest'
import { STANDARD_DRAWINGS, selectedStandardDrawings, toggleStandardDrawing } from './standardDrawings'

const [first, second] = STANDARD_DRAWINGS.map((d) => d.id)

describe('แบบมาตรฐานแนบท้ายรูปเล่ม', () => {
  it('รหัสไม่ซ้ำกัน และส่วนที่ตัดอยู่ในกรอบภาพ', () => {
    expect(new Set(STANDARD_DRAWINGS.map((d) => d.id)).size).toBe(STANDARD_DRAWINGS.length)
    for (const { crop, width, height } of STANDARD_DRAWINGS) {
      if (!crop) continue
      expect(crop.x).toBeGreaterThanOrEqual(0)
      expect(crop.y).toBeGreaterThanOrEqual(0)
      expect(crop.x + crop.width).toBeLessThanOrEqual(width)
      expect(crop.y + crop.height).toBeLessThanOrEqual(height)
    }
  })

  it('โครงการเก่าที่ไม่มีช่องนี้ ไม่แนบแบบใดเลย', () => {
    expect(selectedStandardDrawings(undefined)).toEqual([])
    expect(selectedStandardDrawings([])).toEqual([])
  })

  it('เรียงตามทะเบียน ตัดรหัสที่ไม่รู้จักและรหัสซ้ำทิ้ง', () => {
    const picked = selectedStandardDrawings([second, 'ไม่มีแบบนี้', first, second])
    expect(picked.map((d) => d.id)).toEqual([first, second])
  })

  it('สลับเลือกแล้วได้รหัสตามลำดับทะเบียน ไม่ขึ้นกับลำดับที่คลิก', () => {
    const afterSecond = toggleStandardDrawing([], second)
    expect(afterSecond).toEqual([second])
    expect(toggleStandardDrawing(afterSecond, first)).toEqual([first, second])
    expect(toggleStandardDrawing([first, second], first)).toEqual([second])
    expect(toggleStandardDrawing([first], first)).toEqual([])
  })
})
