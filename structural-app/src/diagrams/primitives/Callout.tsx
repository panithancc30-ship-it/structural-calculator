import { DIAGRAM_STYLE } from './svgLayout'

interface Props {
  /** จุดที่เส้นชี้ชี้ไป */
  targetX: number
  targetY: number
  /** จุดวางข้อความ */
  textX: number
  textY: number
  label: string
  anchor?: 'start' | 'middle' | 'end'
}

export function Callout({ targetX, targetY, textX, textY, label, anchor = 'start' }: Props) {
  return (
    <g>
      <line
        x1={targetX}
        y1={targetY}
        x2={textX}
        y2={textY}
        stroke={DIAGRAM_STYLE.dimStroke}
        strokeWidth={1}
      />
      <circle cx={targetX} cy={targetY} r={2} fill={DIAGRAM_STYLE.dimStroke} />
      <text
        x={anchor === 'end' ? textX - 4 : textX + 4}
        y={textY - 4}
        textAnchor={anchor}
        fontSize={DIAGRAM_STYLE.fontSize}
        fill={DIAGRAM_STYLE.textFill}
      >
        {label}
      </text>
    </g>
  )
}
