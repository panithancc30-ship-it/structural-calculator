import { DIAGRAM_STYLE } from './svgLayout'

interface Props {
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  /** ระยะเยื้องของข้อความจากเส้น (หน่วย SVG) */
  offset?: number
  orientation: 'horizontal' | 'vertical'
}

export function DimensionLine({ x1, y1, x2, y2, label, offset = 12, orientation }: Props) {
  const tick = 5
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={DIAGRAM_STYLE.dimStroke} strokeWidth={1} />
      {orientation === 'horizontal' ? (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} stroke={DIAGRAM_STYLE.dimStroke} strokeWidth={1} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} stroke={DIAGRAM_STYLE.dimStroke} strokeWidth={1} />
          <text
            x={midX}
            y={midY - offset}
            textAnchor="middle"
            fontSize={DIAGRAM_STYLE.fontSize}
            fill={DIAGRAM_STYLE.textFill}
          >
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} stroke={DIAGRAM_STYLE.dimStroke} strokeWidth={1} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} stroke={DIAGRAM_STYLE.dimStroke} strokeWidth={1} />
          <text
            x={midX - offset}
            y={midY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={DIAGRAM_STYLE.fontSize}
            fill={DIAGRAM_STYLE.textFill}
            transform={`rotate(-90 ${midX - offset} ${midY})`}
          >
            {label}
          </text>
        </>
      )}
    </g>
  )
}
