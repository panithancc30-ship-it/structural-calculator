import { calcSteelColumnASD, type SteelColumnInput } from '../../engine/steel/columnASD'
import { resolveSection } from '../../engine/steel/section'
import { fmt, fmtInput, fmtSig, weightDecimals } from '../../engine/shared/units'
import { SteelSheetLayout, type Row } from '../../report/SteelSheetLayout'
import type { Project } from '../../engine/shared/types'

interface Props {
  project: Project
  title: string
  input: SteelColumnInput
  remarks: string
  pageNumber: number
  totalPages: number
}

export function SteelColumnSheet({
  project,
  title,
  input,
  remarks,
  pageNumber,
  totalPages,
}: Props) {
  const result = calcSteelColumnASD(input)
  const resolved = resolveSection(input.section)
  const p = resolved.props

  // รวมค่าที่เป็นคู่กันไว้ในแถวเดียว เพื่อให้รายการทั้งหมดลงพอดี 1 หน้า A4
  const inputRows: Row[] = [
    [
      'แรงตามแกน, P',
      `${fmtInput(Math.abs(input.axial))} กก. (${input.axial >= 0 ? 'อัด' : 'ดึง'})`,
    ],
    ['แรงเฉือน, V', `${fmtInput(input.shear)} กก.`],
    ['โมเมนต์ Mx / My', `${fmtInput(input.momentX)} / ${fmtInput(input.momentY)} กก.-ม.`],
    ['ความยาว Lx / Ly', `${fmt(input.lengthX, 2)} / ${fmt(input.lengthY, 2)} ม.`],
    ['Kx / Ky', `${fmt(input.Kx, 2)} / ${fmt(input.Ky, 2)}`],
    ['Cmx / Cmy / Cb', `${fmt(input.Cmx, 2)} / ${fmt(input.Cmy, 2)} / ${fmt(input.Cb, 2)}`],
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
    ['rx / ry / rmin', `${fmtSig(p.rx)} / ${fmtSig(p.ry)} / ${fmtSig(p.rmin)} ซม.`],
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
      `${fmtSig(resolved.effective.Se)} ซม.³ / ${fmtSig(resolved.effective.Ae)} ตร.ซม.`,
    ])
  }

  return (
    <SteelSheetLayout
      project={project}
      title={title}
      subtitle="เสาเหล็กรูปพรรณ — วิธีหน่วยแรงใช้งาน (AISC ASD)"
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
