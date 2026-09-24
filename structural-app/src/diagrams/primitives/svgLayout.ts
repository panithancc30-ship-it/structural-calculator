/** หน่วยภายใน SVG ต่อ 1 เซนติเมตรจริง */
export const UNITS_PER_CM = 10

export const DIAGRAM_STYLE = {
  concreteStroke: '#1f2937',
  concreteFill: '#f8fafc',
  stirrupStroke: '#0f766e',
  barFill: '#b91c1c',
  dimStroke: '#475569',
  textFill: '#1f2937',
  steelFill: '#cbd5e1',
  steelStroke: '#0f172a',
  roofLine: '#b45309',
  axisStroke: '#64748b',
  fontSize: 13,
  strokeWidth: 1.6,
} as const

export function cm(value: number): number {
  return value * UNITS_PER_CM
}

/**
 * กระจายตำแหน่งเหล็กตามแนวนอนภายในเหล็กปลอก
 * คืนค่าพิกัด x (หน่วย SVG) ของศูนย์กลางเหล็กแต่ละเส้น
 */
export function distributeBars(
  count: number,
  sectionWidth: number,
  cover: number,
  stirrupDiaCm: number,
  barDiaCm: number,
): number[] {
  if (count <= 0) return []
  const inset = cover + stirrupDiaCm + barDiaCm / 2
  const left = inset
  const right = sectionWidth - inset
  if (count === 1) return [cm((left + right) / 2)]
  const gap = (right - left) / (count - 1)
  return Array.from({ length: count }, (_, i) => cm(left + gap * i))
}

export interface ViewBox {
  width: number
  height: number
  value: string
}

export function makeViewBox(
  contentWidthCm: number,
  contentHeightCm: number,
  margin: { left: number; right: number; top: number; bottom: number },
): ViewBox {
  const width = cm(contentWidthCm) + margin.left + margin.right
  const height = cm(contentHeightCm) + margin.top + margin.bottom
  return { width, height, value: `0 0 ${width} ${height}` }
}
