import { EncasedColumnDiagram } from '../../diagrams/EncasedColumnDiagram'
import { calcEncasedColumn, type EncasedColumnInput } from '../../engine/steel/encasedColumn'
import { resolveSection } from '../../engine/steel/section'
import { fmt, fmtInput, fmtSig, weightDecimals } from '../../engine/shared/units'
import { SteelSheetLayout, type Row } from '../../report/SteelSheetLayout'
import type { Project } from '../../engine/shared/types'

interface Props {
  project: Project
  title: string
  input: EncasedColumnInput
  remarks: string
  pageNumber: number
  totalPages: number
}

export function EncasedColumnSheet({ project, title, input, remarks, pageNumber, totalPages }: Props) {
  const result = calcEncasedColumn(input)
  const resolved = resolveSection(input.section)
  const p = resolved.props
  const enc = result.encasement

  const inputRows: Row[] = [
    ['แรงอัดตามแนวแกน, P', `${fmtInput(input.axial)} กก.`],
    ['ความสูงเสา, h', `${fmt(input.height, 2)} ม.`],
    ['ขนาดเสา b × t', `${fmtInput(input.width)} × ${fmtInput(input.depth)} ซม.`],
    ['กำลังอัดคอนกรีต, f′c', `${fmtInput(input.fc)} ksc`],
    [
      'เกรดเหล็ก',
      `${resolved.grade.id === 'custom' ? 'กำหนดเอง' : resolved.grade.id} · Fy = ${fmt(resolved.Fy, 0)} ksc`,
    ],
    [
      'ลวดตาข่าย',
      `${enc.meshLabel} @${fmtInput(enc.meshHoopSpacing)} (รอบ) / @${fmtInput(enc.meshVerticalSpacing)} (ตามยาว) ซม.`,
    ],
    ['ที่มาของคุณสมบัติหน้าตัด', resolved.propertySource],
  ]

  const propertyRows: Row[] = [
    ['พื้นที่หน้าตัดเหล็ก, Ar', `${fmtSig(p.A)} ตร.ซม.`],
    ['น้ำหนัก', `${fmt(p.weight, weightDecimals(p.weight))} กก./ม.`],
    ['rx / ry / Ks (ค่าน้อยสุด)', `${fmtSig(p.rx)} / ${fmtSig(p.ry)} / ${fmtSig(p.rmin)} ซม.`],
    ['ขนาดหน้าตัด (d × bf)', `${fmt(p.d, 1)} × ${fmt(p.bf, 1)} ซม.`],
    ['คอนกรีตหุ้ม cx / cy', `${fmt(enc.coverX, 2)} / ${fmt(enc.coverY, 2)} ซม.`],
    ['Ar / Ag', `${fmt((p.A / (input.width * input.depth)) * 100, 2)}%`],
  ]

  return (
    <SteelSheetLayout
      project={project}
      title={title}
      subtitle="เสาเหล็กหุ้มคอนกรีต — วิธีหน่วยแรงใช้งาน (มาตรฐาน วสท.)"
      inputRows={inputRows}
      propertyRows={propertyRows}
      steps={result.steps}
      checks={result.checks}
      overall={result.overall}
      detailing={result.detailing}
      figure={
        <>
          <EncasedColumnDiagram detailing={result.detailing} encasement={enc} labels={false} />
          <div className="sheet-figure-caption">
            {result.detailing.sectionName} · {result.detailing.gradeLabel.split(' ')[0]}
            <br />
            ลวดตาข่ายเบอร์ 10 @{fmtInput(enc.meshHoopSpacing)}/{fmtInput(enc.meshVerticalSpacing)} ซม. ทาบ ≥{' '}
            {enc.lapLength} ซม.
          </div>
        </>
      }
      warnings={result.warnings}
      remarks={remarks}
      pageNumber={pageNumber}
      totalPages={totalPages}
      conclusion={
        result.overall === 'pass'
          ? ` — ${result.summary.sectionName} หุ้มคอนกรีต ${fmtInput(input.width)} × ${fmtInput(input.depth)} ซม. ` +
            `รับน้ำหนักได้ ${fmt(result.summary.capacity, 0)} กก. ใช้กำลังไป ${fmt(result.summary.maxRatio * 100, 0)}%`
          : null
      }
    />
  )
}
