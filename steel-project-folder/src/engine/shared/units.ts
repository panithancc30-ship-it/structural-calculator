export const UNITS = {
  stress: 'ksc',
  force: 'kg',
  moment: 'kg-m',
  length: 'cm',
  area: 'ตร.ซม.',
  pressure: 'ksc',
} as const

export function kgmToKgcm(moment: number): number {
  return moment * 100
}

export function kgcmToKgm(moment: number): number {
  return moment / 100
}

/**
 * จำนวนทศนิยมที่ให้ตัวเลขมีนัยสำคัญอย่างน้อย 3 หลัก (สูงสุด 4 ตำแหน่ง)
 * หน้าตัดเล็กอย่างแปหมวกมีค่า Sx ≈ 0.5 ซม.³ ถ้าปัดเป็นทศนิยม 1 ตำแหน่ง ตัวเลขในการแทนค่าจะคำนวณตามไม่ได้
 */
export function sigDecimals(value: number, significant = 3): number {
  if (!Number.isFinite(value) || value === 0) return 0
  const magnitude = Math.floor(Math.log10(Math.abs(value)))
  return Math.min(Math.max(significant - 1 - magnitude, 0), 4)
}

/** ตัวเลขนัยสำคัญอย่างน้อย 3 หลัก พร้อมตัวคั่นหลักพัน */
export function fmtSig(value: number, significant = 3): string {
  return fmt(value, sigDecimals(value, significant))
}

/** ค่าที่ผู้ใช้ป้อน — แสดงตามที่ป้อน ตัดศูนย์ท้ายทศนิยมออก (สูงสุด 3 ตำแหน่ง) */
export function fmtInput(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('en-US', { maximumFractionDigits: 3 })
}

/** ทศนิยมของน้ำหนักต่อเมตร — เหล็กเบาอย่างแปหมวกต้องแสดง 2 ตำแหน่งจึงจะเห็นความต่าง */
export function weightDecimals(weight: number): number {
  return weight < 5 ? 2 : 1
}

/** ตัวเลขพร้อมหน่วย — ไม่แสดงหน่วยสำหรับค่าไร้หน่วย ('-') */
export function fmtUnit(value: number, unit: string, decimals = 2): string {
  const text = fmt(value, decimals)
  return unit && unit !== '-' ? `${text} ${unit}` : text
}

/** "สัญลักษณ์ = ค่า หน่วย" แต่ถ้าสัญลักษณ์คือตัวเลขเดียวกันอยู่แล้ว (เช่น 1.00) แสดงแค่ค่า */
export function fmtSymbolValue(symbol: string, value: number, unit: string, decimals = 2): string {
  const valueText = fmtUnit(value, unit, decimals)
  return symbol === fmt(value, decimals) ? valueText : `${symbol} = ${valueText}`
}

export function fmt(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
