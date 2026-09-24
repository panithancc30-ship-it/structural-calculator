import { calcSteelBeamASD, DEFLECTION_PATTERNS, SAG_ROD_OPTIONS, type SteelBeamInput } from '../../engine/steel/beamASD'
import { resolveSection } from '../../engine/steel/section'
import { fmt, fmtInput, fmtSig, weightDecimals } from '../../engine/shared/units'
import { SteelSheetLayout, type Row } from '../../report/SteelSheetLayout'
import type { Project } from '../../engine/shared/types'

interface Props {
  project: Project
  title: string
  input: SteelBeamInput
  remarks: string
  pageNumber: number
  totalPages: number
}

export function SteelBeamSheet({
  project,
  title,
  input,
  remarks,
  pageNumber,
  totalPages,
}: Props) {
  const result = calcSteelBeamASD(input)
  const resolved = resolveSection(input.section)
  const p = resolved.props

  const pattern = DEFLECTION_PATTERNS.find((d) => d.id === input.deflectionPattern)
  const sag = SAG_ROD_OPTIONS.find((s) => s.id === input.sagRods)

  // รวมค่าที่เป็นคู่กันไว้ในแถวเดียว เพื่อให้รายการทั้งหมดลงพอดี 1 หน้า A4
  const inputRows: Row[] = [
    ['โมเมนต์ดัดใช้งาน, M', `${fmtInput(input.moment)} กก.-ม.`],
    ['แรงเฉือนใช้งาน, V', `${fmtInput(input.shear)} กก.`],
    [
      'แรงตามแกน, P',
      input.axial === 0
        ? 'ไม่มี'
        : `${fmtInput(Math.abs(input.axial))} กก. (${input.axial > 0 ? 'อัด' : 'ดึง'})`,
    ],
    [
      'ช่วงคาน, L',
      `${fmt(input.span, 2)} ม. (${input.spanBasis === 'slope' ? 'ตามความลาด' : 'ตามแนวราบ'})`,
    ],
    [
      'มุมเอียง θm / θs',
      `${fmt(input.memberAngle, 2)}° / ${fmt(input.sectionAngle, 2)}°`,
    ],
    ['ค้ำยัน Lb / Cb', `${fmt(input.unbracedLength, 2)} ม. / ${fmt(input.Cb, 2)}`],
    ['เหล็กยึดทางข้าง', sag?.label ?? '-'],
    ['การโก่งตัว', pattern?.id === 'none' ? 'ไม่ตรวจ' : `L/${input.deflectionLimit} · ${pattern?.formula ?? '-'}`],
    [
      'เกรดเหล็ก',
      `${resolved.grade.id === 'custom' ? 'กำหนดเอง' : resolved.grade.id} · Fy = ${fmt(resolved.Fy, 0)} ksc${resolved.yieldReduced ? ' (ลด 75% ตาม AISI)' : ''}`,
    ],
    ['ที่มาของคุณสมบัติหน้าตัด', resolved.propertySource],
  ]

  const propertyRows: Row[] = [
    ['พื้นที่หน้าตัด, A', `${fmtSig(p.A)} ตร.ซม.`],
    ['น้ำหนัก', `${fmt(p.weight, weightDecimals(p.weight))} กก./ม.`],
    ['Ix / Iy', `${fmtSig(p.Ix)} / ${fmtSig(p.Iy)} ซม.⁴`],
    ['Sx / Sy', `${fmtSig(p.Sx)} / ${fmtSig(p.Sy)} ซม.³`],
    ['rx / ry', `${fmtSig(p.rx)} / ${fmtSig(p.ry)} ซม.`],
    ['พื้นที่เอวรับเฉือน, Aw', `${fmtSig(p.Aw)} ตร.ซม.`],
    p.family === 'hat'
      ? [
          'มิติ สูง × ฐาน / สัน / เอว / ขอบพับ / หนา',
          `${fmt(p.d * 10, 0)} × ${fmt(p.bf * 10, 0)} / ${fmt((p.crown ?? 0) * 10, 0)} / ` +
            `${fmt((p.webBottom ?? 0) * 10, 0)} / ${fmt((p.lip ?? 0) * 10, 0)} / ${fmt(p.tw * 10, 2)} มม.`,
        ]
      : ['ขนาดหน้าตัด (d × bf)', `${fmt(p.d, 1)} × ${fmt(p.bf, 1)} ซม.`],
  ]

  if (resolved.grade.coldFormed && !resolved.effective.fullyEffective) {
    propertyRows.push([
      'หน้าตัดประสิทธิผล Se / Ae',
      `${fmtSig(resolved.effective.Se)} ซม.³ / ${fmtSig(resolved.effective.Ae)} ตร.ซม. ` +
        `(${fmt(resolved.effective.ratioS * 100, 0)}% ของหน้าตัดเต็ม)`,
    ])
  }

  return (
    <SteelSheetLayout
      project={project}
      title={title}
      subtitle="คานเหล็กรูปพรรณ — วิธีหน่วยแรงใช้งาน (AISC ASD)"
      inputRows={inputRows}
      propertyRows={propertyRows}
      steps={result.steps}
      checks={result.checks}
      overall={result.overall}
      detailing={result.detailing}
      warnings={result.warnings}
      remarks={remarks}
      pageNumber={pageNumber}
      totalPages={totalPages}
      conclusion={
        result.overall === 'pass'
          ? ` — ${result.summary.sectionName} รับแรงได้อย่างปลอดภัย ใช้กำลังไป ${fmt(result.summary.maxRatio * 100, 0)}%`
          : null
      }
    />
  )
}
