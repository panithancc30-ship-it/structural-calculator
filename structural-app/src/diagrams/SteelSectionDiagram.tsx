import type { SteelDetailing } from '../engine/shared/types'
import { cm, DIAGRAM_STYLE } from './primitives/svgLayout'

/**
 * รูปตัดเหล็กรูปพรรณ — วาดตามรูปทรงจริงและ **หมุนตามมุมเอียงของหน้าตัด (θs)**
 * เพื่อให้เห็นทันทีว่าแรงในแนวดิ่งกระทำกับหน้าตัดในทิศใด
 * ซึ่งเป็นหัวใจของการออกแบบแปและจันทัน
 */

const PAD = { x: 120, y: 64 }

/** ขนาดรูปขั้นต่ำ (หน่วย SVG) — หน้าตัดเล็กอย่างแปหมวกจะถูกขยายให้ถึงขนาดนี้ */
const MIN_DRAWING = 220

/** เส้นขอบรูปตัด (จุดกึ่งกลางหน้าตัดอยู่ที่ 0,0) หน่วยเป็น ซม. คูณมาตราส่วนแล้ว */
interface Outline {
  path: string
  evenOdd: boolean
  /** วาดเป็นเส้นหนาตามแนวกึ่งกลางผนัง แทนการระบายพื้นที่ (ใช้กับแผ่นบางมาก) */
  strokeOnly?: number
}

function outlinePath(d: SteelDetailing, u: (v: number) => number): Outline {
  const { family, d: H, bf: B, tw, tf } = d
  const hx = B / 2
  const hy = H / 2
  const p = (x: number, y: number) => `${u(x).toFixed(2)},${u(y).toFixed(2)}`

  switch (family) {
    case 'i-shape':
    case 'built-up':
    case 'custom':
      return {
        path:
          `M${p(-hx, -hy)} L${p(hx, -hy)} L${p(hx, -hy + tf)} L${p(tw / 2, -hy + tf)} ` +
          `L${p(tw / 2, hy - tf)} L${p(hx, hy - tf)} L${p(hx, hy)} L${p(-hx, hy)} ` +
          `L${p(-hx, hy - tf)} L${p(-tw / 2, hy - tf)} L${p(-tw / 2, -hy + tf)} ` +
          `L${p(-hx, -hy + tf)} Z`,
        evenOdd: false,
      }

    case 'channel':
      return {
        path:
          `M${p(-hx, -hy)} L${p(hx, -hy)} L${p(hx, -hy + tf)} L${p(-hx + tw, -hy + tf)} ` +
          `L${p(-hx + tw, hy - tf)} L${p(hx, hy - tf)} L${p(hx, hy)} L${p(-hx, hy)} Z`,
        evenOdd: false,
      }

    case 'lipped-channel': {
      const c = d.lip ?? Math.min(B / 3, 2)
      const t = tw
      return {
        path:
          `M${p(-hx, -hy)} L${p(hx, -hy)} L${p(hx, -hy + c)} L${p(hx - t, -hy + c)} ` +
          `L${p(hx - t, -hy + t)} L${p(-hx + t, -hy + t)} L${p(-hx + t, hy - t)} ` +
          `L${p(hx - t, hy - t)} L${p(hx - t, hy - c)} L${p(hx, hy - c)} L${p(hx, hy)} ` +
          `L${p(-hx, hy)} Z`,
        evenOdd: false,
      }
    }

    case 'hat': {
      // แนวกึ่งกลางผนัง: ปลายขอบพับ → ปีก → เอว → สัน (y ของ SVG ชี้ลง สันจึงอยู่ด้านบน)
      const t = tw
      const xCrown = (d.crown ?? B / 3) / 2 - t / 2
      const xWeb = (d.webBottom ?? d.crown ?? B / 3) / 2 - t / 2
      const xEdge = hx - t / 2
      const yTop = -hy + t / 2
      const yBase = hy - t / 2
      const lip = d.lip ?? 0
      const points: Array<[number, number]> = []
      if (lip > t) points.push([-xEdge, hy - lip])
      points.push([-xEdge, yBase], [-xWeb, yBase], [-xCrown, yTop], [xCrown, yTop], [xWeb, yBase], [xEdge, yBase])
      if (lip > t) points.push([xEdge, hy - lip])
      return {
        path: points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${p(x, y)}`).join(' '),
        evenOdd: false,
        strokeOnly: Math.max(u(t), 3),
      }
    }

    case 'angle': {
      const t = tw
      return {
        path:
          `M${p(-hx, -hy)} L${p(-hx + t, -hy)} L${p(-hx + t, hy - t)} L${p(hx, hy - t)} ` +
          `L${p(hx, hy)} L${p(-hx, hy)} Z`,
        evenOdd: false,
      }
    }

    case 'box': {
      const t = tw
      return {
        path:
          `M${p(-hx, -hy)} L${p(hx, -hy)} L${p(hx, hy)} L${p(-hx, hy)} Z ` +
          `M${p(-hx + t, -hy + t)} L${p(hx - t, -hy + t)} L${p(hx - t, hy - t)} ` +
          `L${p(-hx + t, hy - t)} Z`,
        evenOdd: true,
      }
    }

    case 'pipe': {
      const r = H / 2
      const ri = Math.max(r - tw, 0)
      const circle = (rad: number) =>
        `M${u(-rad).toFixed(2)},0 a${u(rad).toFixed(2)},${u(rad).toFixed(2)} 0 1,0 ${u(2 * rad).toFixed(2)},0 ` +
        `a${u(rad).toFixed(2)},${u(rad).toFixed(2)} 0 1,0 ${u(-2 * rad).toFixed(2)},0 Z`
      return { path: `${circle(r)} ${circle(ri)}`, evenOdd: true }
    }

    default:
      return {
        path: `M${p(-hx, -hy)} L${p(hx, -hy)} L${p(hx, hy)} L${p(-hx, hy)} Z`,
        evenOdd: false,
      }
  }
}

/** ตำแหน่งและการพลิกของเหล็กแต่ละท่อนในหน้าตัดประกอบ */
function piecePlacement(d: SteelDetailing): Array<{ dx: number; flip: boolean }> {
  const half = d.bf / 2 + d.gap / 2
  switch (d.arrangement) {
    case 'single':
      return [{ dx: 0, flip: false }]
    case '2c-back':
      // เอวชนกันตรงกลาง ปีกหันออกสองข้าง
      return [
        { dx: -half, flip: true },
        { dx: half, flip: false },
      ]
    case '2c-box':
      // ปีกหันเข้าหากัน เอวอยู่ผิวนอก
      return [
        { dx: -half, flip: false },
        { dx: half, flip: true },
      ]
    case '2l-back':
      return [
        { dx: -half, flip: true },
        { dx: half, flip: false },
      ]
    case '2tube':
      return [
        { dx: -half, flip: false },
        { dx: half, flip: false },
      ]
  }
}

interface Props {
  detailing: SteelDetailing
  /** แสดงชื่อหน้าตัดและมุมใต้รูป — รายงานพิมพ์ปิดไว้แล้วเขียนเป็นข้อความ HTML แทน เพราะรูปถูกย่อจนอ่านไม่ออก */
  caption?: boolean
}

export function SteelSectionDiagram({ detailing, caption = true }: Props) {
  const pieces = piecePlacement(detailing)

  const totalW =
    detailing.arrangement === 'single' ? detailing.bf : 2 * detailing.bf + detailing.gap
  const totalH = detailing.d

  // หน้าตัดที่หมุนแล้วกินพื้นที่มากขึ้น จึงต้องคำนวณกรอบใหม่
  const rad = (detailing.sectionAngle * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const naturalW = cm(totalW * c + totalH * s)
  const naturalH = cm(totalW * s + totalH * c)

  /** มาตราส่วนขยาย — ขยายเฉพาะหน้าตัดที่เล็กมาก ไม่ย่อหน้าตัดใหญ่ */
  const scale = Math.max(1, MIN_DRAWING / Math.max(naturalW, naturalH, 1e-6))
  const u = (v: number) => cm(v) * scale
  const { path, evenOdd, strokeOnly } = outlinePath(detailing, u)

  const boxW = naturalW * scale
  const boxH = naturalH * scale

  const tilted = Math.abs(detailing.sectionAngle) > 0.01
  const sloped = Math.abs(detailing.memberAngle) > 0.01
  const roofHalf = boxW / 2 + 42
  /** ขนาดตัวอักษรตามขนาดรูป เพื่อให้ยังอ่านได้เมื่อรูปถูกย่อลงในหน้ารายงาน */
  const labelSize = Math.max(DIAGRAM_STYLE.fontSize, (boxW + PAD.x * 2) / 16)

  // แนวหลังคาอยู่ใต้ผิวล่างของหน้าตัด เพราะแปวางบนจันทันซึ่งอยู่ในระนาบหลังคา
  const baseOffset = u(totalH / 2)
  const cosS = Math.cos(rad)
  const sinS = Math.sin(rad)
  /** หมุนจุดจากพิกัดของหน้าตัดมาเป็นพิกัดรูป (ก่อนเลื่อนไปจุดกึ่งกลาง) */
  const turn = (x: number, y: number): [number, number] => [x * cosS - y * sinS, x * sinS + y * cosS]
  const roofEnds = tilted
    ? [turn(-roofHalf, baseOffset), turn(roofHalf, baseOffset), turn(roofHalf, baseOffset + labelSize * 1.2)]
    : []
  /** จุดที่แนวหลังคาตัดแนวดิ่งผ่านกึ่งกลาง — ใช้ลากเส้นระดับอ้างอิงเทียบมุม */
  const pivot = turn(0, baseOffset)

  // ขยายกรอบรูปให้ครอบคลุมทั้งหน้าตัดและแนวหลังคา ไม่ให้เส้นถูกตัดเมื่อมุมชัน
  const xs = [-boxW / 2, boxW / 2, ...roofEnds.map(([x]) => x)]
  const ys = [-boxH / 2, boxH / 2, ...roofEnds.map(([, y]) => y)]
  const topSpace = PAD.y
  const bottomSpace = caption ? PAD.y : 16
  const viewW = Math.max(...xs) - Math.min(...xs) + PAD.x * 2
  const viewH = Math.max(...ys) - Math.min(...ys) + topSpace + bottomSpace
  const originX = PAD.x - Math.min(...xs)
  const originY = topSpace - Math.min(...ys)

  return (
    <svg
      viewBox={`0 0 ${viewW.toFixed(0)} ${viewH.toFixed(0)}`}
      className="section-diagram"
      role="img"
      aria-label={`รูปตัด ${detailing.sectionName}`}
    >
      {/* แนวหลังคา — ผิวล่างของหน้าตัดที่เอียงวางอยู่บนเส้นนี้ */}
      {tilted && (
        <g transform={`translate(${originX} ${originY}) rotate(${detailing.sectionAngle})`}>
          <line
            x1={-roofHalf}
            y1={baseOffset}
            x2={roofHalf}
            y2={baseOffset}
            stroke={DIAGRAM_STYLE.roofLine}
            strokeWidth={1.2}
            strokeDasharray="7 4"
          />
          <text
            x={roofHalf}
            y={baseOffset + labelSize}
            textAnchor="end"
            fontSize={labelSize}
            fill={DIAGRAM_STYLE.roofLine}
          >
            แนวหลังคา
          </text>
        </g>
      )}

      {/* เส้นระดับอ้างอิง ใช้เทียบมุมเอียง */}
      {tilted && (
        <line
          x1={originX + pivot[0] - roofHalf}
          y1={originY + pivot[1]}
          x2={originX + pivot[0] + roofHalf}
          y2={originY + pivot[1]}
          stroke={DIAGRAM_STYLE.axisStroke}
          strokeWidth={0.8}
          strokeDasharray="2 4"
        />
      )}

      <g transform={`translate(${originX} ${originY}) rotate(${detailing.sectionAngle})`}>
        {pieces.map((piece, i) => (
          <g
            key={i}
            transform={`translate(${u(piece.dx)} 0)${piece.flip ? ' scale(-1 1)' : ''}`}
          >
            <path
              d={path}
              fill={strokeOnly ? 'none' : DIAGRAM_STYLE.steelFill}
              fillRule={evenOdd ? 'evenodd' : 'nonzero'}
              stroke={DIAGRAM_STYLE.steelStroke}
              strokeWidth={strokeOnly ?? DIAGRAM_STYLE.strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>

      {/* ลูกศรแรงในแนวดิ่ง — แสดงว่าแรงไม่ได้ตั้งฉากกับหน้าตัดเมื่อหน้าตัดเอียง */}
      <g>
        <defs>
          <marker
            id="steel-load-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={DIAGRAM_STYLE.barFill} />
          </marker>
        </defs>
        <line
          x1={originX}
          y1={PAD.y / 2 - 16}
          x2={originX}
          y2={PAD.y / 2 + 10}
          stroke={DIAGRAM_STYLE.barFill}
          strokeWidth={1.6}
          markerEnd="url(#steel-load-arrow)"
        />
        <text
          x={originX + 8}
          y={PAD.y / 2}
          fontSize={labelSize}
          fill={DIAGRAM_STYLE.barFill}
        >
          แรงในแนวดิ่ง
        </text>
      </g>

      {caption && (
        <>
          <text
            x={10}
            y={viewH - 24}
            fontSize={DIAGRAM_STYLE.fontSize}
            fill={DIAGRAM_STYLE.textFill}
            fontWeight={700}
          >
            {detailing.sectionName}
            {scale > 1.01 ? ` (ขยาย ${scale.toFixed(1)} เท่า)` : ''}
          </text>
          <text x={10} y={viewH - 9} fontSize={DIAGRAM_STYLE.fontSize} fill="#475569">
            {tilted ? `หน้าตัดเอียง θs = ${detailing.sectionAngle}°` : 'หน้าตัดวางตั้งฉาก'}
            {sloped ? ` · ชิ้นส่วนเอียง θm = ${detailing.memberAngle}°` : ''}
            {` · ${detailing.gradeLabel.split(' ')[0]}`}
          </text>
        </>
      )}
    </svg>
  )
}
