import type { EncasementDetailing } from '../engine/steel/encasedColumn'
import type { SteelDetailing } from '../engine/shared/types'
import { fmt, fmtInput } from '../engine/shared/units'
import { SteelShape } from './SteelSectionDiagram'
import { cm, DIAGRAM_STYLE } from './primitives/svgLayout'

const CONCRETE_FILL = '#f1f1ef'

interface Props {
  detailing: SteelDetailing
  encasement: EncasementDetailing
  /** ป้ายชี้ส่วนประกอบ — รายงานพิมพ์ปิดไว้แล้วเขียนเป็นข้อความใต้รูปแทน เพราะรูปถูกย่อจนอ่านไม่ออก */
  labels?: boolean
}

/**
 * รูปตัดเสาเหล็กหุ้มคอนกรีต — เหล็กรูปพรรณอยู่กึ่งกลาง ลวดตาข่ายเป็นเส้นประห่างผิว 2.5 ซม.
 * บอกขนาดเสาและระยะคอนกรีตหุ้มทั้งสองด้าน
 */
export function EncasedColumnDiagram({ detailing, encasement, labels = true }: Props) {
  const { width: b, depth: t } = encasement
  const W = cm(b)
  const H = cm(t)
  const steelW = cm(detailing.arrangement === 'single' ? detailing.bf : 2 * detailing.bf + detailing.gap)
  const steelH = cm(detailing.d)
  const mesh = cm(encasement.meshInset)

  /** ตัวอักษรตามขนาดรูป เพื่อให้ยังอ่านได้เมื่อรูปถูกย่อ */
  const F = Math.max(DIAGRAM_STYLE.fontSize, Math.max(W, H) / (labels ? 14 : 7.5))
  const gap = F * 1.3
  const tick = F * 0.35

  const padL = gap + F * 1.4
  const padT = gap + F * 1.4
  const padB = gap + F * 1.9
  const padR = labels ? gap + F * 17 : gap + F * 1.9

  const dimStroke = { stroke: DIAGRAM_STYLE.dimStroke, strokeWidth: 1 }
  const slash = (x: number, y: number) => `M${x - tick},${y + tick} L${x + tick},${y - tick}`
  const text = { fontSize: F, fill: DIAGRAM_STYLE.textFill }

  // เส้นบอกขนาด
  const yTop = -H / 2 - gap
  const xLeft = -W / 2 - gap
  const yBottom = H / 2 + gap
  const xRight = W / 2 + gap
  const showCoverX = encasement.coverX > 0.05
  const showCoverY = encasement.coverY > 0.05
  /** ระยะหุ้มแสดงตามจริง ไม่ปัดเศษ เพราะใช้เทียบกับเกณฑ์ 6 ซม. */
  const coverText = (v: number) => fmtInput(Math.round(v * 100) / 100)

  // ป้ายชี้ส่วนประกอบ เรียงลงมาทางขวาของรูป
  const labelX = W / 2 + gap + F * 2.2
  const lineHeight = F * 1.2
  const calloutItems: Array<{ tx: number; ty: number; lines: string[] }> = [
    {
      tx: W / 2 - mesh,
      ty: -H / 2 + mesh + F * 0.6,
      lines: [
        encasement.meshLabel,
        `Ø${fmt(encasement.wireDia * 10, 1)} มม. ห่างผิว ${fmtInput(encasement.meshInset)} ซม.`,
        `รอบเสา @${fmtInput(encasement.meshHoopSpacing)} · ตามยาว @${fmtInput(encasement.meshVerticalSpacing)} ซม.`,
      ],
    },
    {
      tx: steelW / 2 - Math.min(steelW * 0.15, F),
      ty: -steelH / 2 + cm(detailing.tf) / 2,
      lines: [detailing.sectionName, detailing.gradeLabel.split(' ')[0]],
    },
    {
      tx: (W / 2 + steelW / 2) / 2,
      ty: H / 4,
      lines: [`คอนกรีต f′c = ${fmtInput(encasement.fc)} ksc`, `ทาบลวด ≥ ${encasement.lapLength} ซม.`],
    },
  ]
  let nextY = -H / 2 + F
  const callouts = calloutItems.map((item) => {
    const y = nextY
    nextY += item.lines.length * lineHeight + F
    return { ...item, y }
  })

  // เสาแบนมากป้ายอาจยาวเลยขอบล่างของเสา จึงขยายกรอบรูปตามป้าย
  const bottom = Math.max(H / 2 + padB, labels ? nextY : 0)
  const view = { x: -W / 2 - padL, y: -H / 2 - padT, w: W + padL + padR, h: bottom + H / 2 + padT }

  return (
    <svg
      viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
      className="section-diagram"
      style={labels ? { maxWidth: 520 } : undefined}
      role="img"
      aria-label={`รูปตัดเสาเหล็กหุ้มคอนกรีต ${fmtInput(b)} × ${fmtInput(t)} ซม. แกนเหล็ก ${detailing.sectionName}`}
    >
      {/* คอนกรีตหุ้ม */}
      <rect
        x={-W / 2}
        y={-H / 2}
        width={W}
        height={H}
        fill={CONCRETE_FILL}
        stroke={DIAGRAM_STYLE.concreteStroke}
        strokeWidth={DIAGRAM_STYLE.strokeWidth * 1.2}
      />

      {/* ลวดตาข่าย */}
      <rect
        x={-W / 2 + mesh}
        y={-H / 2 + mesh}
        width={Math.max(W - 2 * mesh, 0)}
        height={Math.max(H - 2 * mesh, 0)}
        fill="none"
        stroke={DIAGRAM_STYLE.stirrupStroke}
        strokeWidth={1.4}
        strokeDasharray={`${(F * 0.5).toFixed(1)} ${(F * 0.3).toFixed(1)}`}
      />

      {/* เส้นศูนย์กลาง */}
      <path
        d={`M${-W / 2 - gap * 0.5},0 H${W / 2 + gap * 0.5} M0,${-H / 2 - gap * 0.5} V${H / 2 + gap * 0.5}`}
        stroke={DIAGRAM_STYLE.axisStroke}
        strokeWidth={0.8}
        strokeDasharray={`${(F * 1.2).toFixed(1)} ${(F * 0.3).toFixed(1)} ${(F * 0.2).toFixed(1)} ${(F * 0.3).toFixed(1)}`}
      />

      <SteelShape detailing={detailing} u={cm} />

      {/* ขนาดเสา b (บน) และ t (ซ้าย) */}
      <g {...dimStroke} fill="none">
        <path d={`M${-W / 2},${-H / 2} V${yTop - tick} M${W / 2},${-H / 2} V${yTop - tick}`} />
        <path d={`M${-W / 2},${yTop} H${W / 2}`} />
        <path d={`${slash(-W / 2, yTop)} ${slash(W / 2, yTop)}`} strokeWidth={1.6} />
        <path d={`M${-W / 2},${-H / 2} H${xLeft - tick} M${-W / 2},${H / 2} H${xLeft - tick}`} />
        <path d={`M${xLeft},${-H / 2} V${H / 2}`} />
        <path d={`${slash(xLeft, -H / 2)} ${slash(xLeft, H / 2)}`} strokeWidth={1.6} />
      </g>
      <text x={0} y={yTop - F * 0.45} textAnchor="middle" {...text}>
        b = {fmtInput(b)} ซม.
      </text>
      <text
        x={xLeft - F * 0.45}
        y={0}
        textAnchor="middle"
        transform={`rotate(-90 ${xLeft - F * 0.45} 0)`}
        {...text}
      >
        t = {fmtInput(t)} ซม.
      </text>

      {/* ระยะหุ้มด้านปลายปีก (ล่าง) */}
      {showCoverX && (
        <>
          <g {...dimStroke} fill="none">
            <path d={`M${steelW / 2},${steelH / 2} V${yBottom + tick} M${W / 2},${H / 2} V${yBottom + tick}`} />
            <path d={`M${steelW / 2},${yBottom} H${W / 2}`} />
            <path d={`${slash(steelW / 2, yBottom)} ${slash(W / 2, yBottom)}`} strokeWidth={1.6} />
          </g>
          <text x={(steelW / 2 + W / 2) / 2} y={yBottom + F * 1.25} textAnchor="middle" {...text}>
            {coverText(encasement.coverX)}
          </text>
        </>
      )}

      {/* ระยะหุ้มด้านหน้าปีก (ขวา) */}
      {showCoverY && (
        <>
          <g {...dimStroke} fill="none">
            <path d={`M${steelW / 2},${steelH / 2} H${xRight + tick} M${W / 2},${H / 2} H${xRight + tick}`} />
            <path d={`M${xRight},${steelH / 2} V${H / 2}`} />
            <path d={`${slash(xRight, steelH / 2)} ${slash(xRight, H / 2)}`} strokeWidth={1.6} />
          </g>
          <text
            x={xRight + F * 1.1}
            y={(steelH / 2 + H / 2) / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${xRight + F * 1.1} ${(steelH / 2 + H / 2) / 2})`}
            {...text}
          >
            {coverText(encasement.coverY)}
          </text>
        </>
      )}

      {labels &&
        callouts.map(({ tx, ty, lines, y }, i) => {
          return (
            <g key={i}>
              <path
                d={`M${tx},${ty} L${labelX - F * 0.8},${y} H${labelX - F * 0.2}`}
                fill="none"
                {...dimStroke}
              />
              <circle cx={tx} cy={ty} r={2.2} fill={DIAGRAM_STYLE.dimStroke} />
              {lines.map((line, j) => (
                <text
                  key={j}
                  x={labelX}
                  y={y + F * 0.35 + j * lineHeight}
                  {...text}
                  fontSize={j === 0 ? F : F * 0.85}
                  fontWeight={j === 0 ? 600 : 400}
                  fill={j === 0 ? DIAGRAM_STYLE.textFill : '#475569'}
                >
                  {line}
                </text>
              ))}
            </g>
          )
        })}
    </svg>
  )
}
