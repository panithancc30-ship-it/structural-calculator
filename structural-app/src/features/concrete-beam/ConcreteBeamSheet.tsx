import { SectionDrawing } from '@/components/concrete/drawing/SectionDrawing'
import { pickScale } from '@/components/concrete/drawing/drawingModel'
import { SECTION_TITLES, SUPPORT_TH } from '@/components/concrete/labels'
import { ACI318_WSD } from '@/engine/concrete/codes/aci318Wsd'
import { analyzeBeam, type BeamAnalysis } from '@/engine/concrete/design/designBeam'
import { worstStatus } from '@/engine/concrete/design/sectionCheck'
import { fmt } from '@/engine/concrete/format'
import type { CheckStatus, SectionKey } from '@/engine/concrete/types'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { BEAM_BOX } from '@/features/concrete/reportScale'
import type { SheetRenderProps } from '@/features/registry'
import { parseProject, type ProjectFile } from '@/state/store'

const KEYS: SectionKey[] = ['A', 'B']

const NOTES = [
  'หน่วย kg, cm, ksc — ใช้ M ค่าเดียวออกแบบทั้ง M+ (หน้าตัด A-A) และ M− (หน้าตัด B-B)',
  'V และ T ใช้ตรวจสอบทั้งสองหน้าตัด',
]

interface Analyzed {
  file: ProjectFile
  analysis: BeamAnalysis
  denom: number
  status: CheckStatus
}

/** คำนวณจากข้อมูลของรายการล้วน ๆ เพื่อให้รูปเล่มและสารบัญใช้ได้โดยไม่พึ่ง store */
export function analyzeBeamSheet(input: unknown): Analyzed | null {
  const file = parseProject(input)
  if (typeof file === 'string') return null
  try {
    const analysis = analyzeBeam(file.input, file.layouts)
    return {
      file,
      analysis,
      denom: pickScale(file.input, file.layouts, BEAM_BOX.w, BEAM_BOX.h),
      status: worstStatus([...analysis.A.checks, ...analysis.B.checks, ...analysis.beamChecks]),
    }
  } catch {
    return null
  }
}

export function ConcreteBeamSheet({ project, title, input, remarks, pageNumber, totalPages }: SheetRenderProps) {
  const result = analyzeBeamSheet(input)

  if (!result) {
    return (
      <ConcreteSheetFallback project={project} title={title} pageNumber={pageNumber} totalPages={totalPages} />
    )
  }

  const { file, analysis, denom, status } = result
  const { input: beam, layouts } = file
  const p = analysis.params

  const inputRows: InputRow[] = [
    {
      label: 'หน้าตัด',
      cells: [
        `b × h = ${fmt(beam.b, 0)} × ${fmt(beam.h, 0)} ซม.`,
        `L = ${fmt(beam.L, 2)} ม. (${SUPPORT_TH[beam.support]})`,
        `covering = ${fmt(beam.cover, 1)} ซม.`,
      ],
    },
    {
      label: 'วัสดุ',
      cells: [
        `f′c = ${fmt(beam.fc, 0)} ksc`,
        `fy เหล็กยืน = ${fmt(beam.fy, 0)} ksc`,
        `fy เหล็กปลอก = ${fmt(beam.fyv, 0)} ksc`,
      ],
    },
    {
      label: 'แรงภายใน',
      cells: [`M = ±${fmt(beam.M, 0)} kg·m`, `V = ${fmt(beam.V, 0)} kg`, `T = ${fmt(beam.T, 0)} kg·m`],
    },
    {
      label: 'ค่าออกแบบ',
      cells: [
        `n = ${p.n}, k = ${fmt(p.k, 3)}, j = ${fmt(p.j, 3)}`,
        `fc = ${fmt(p.fcAllow, 1)}, fs = ${fmt(p.fsAllow, 0)}, fv = ${fmt(p.fvAllow, 0)} ksc`,
        `R = ${fmt(p.R, 2)} ksc`,
      ],
    },
  ]

  const figures = KEYS.map((key) => (
    <figure key={key}>
      <SectionDrawing
        input={beam}
        layout={layouts[key]}
        denom={denom}
        title={SECTION_TITLES[key].title}
        subtitle={SECTION_TITLES[key].subtitle}
        physicalSize
      />
    </figure>
  ))

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="คานคอนกรีตเสริมเหล็ก"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${ACI318_WSD.label}`}
      inputRows={inputRows}
      figureTitle="หน้าตัดและการเสริมเหล็ก"
      figures={figures}
      checks={[...analysis.A.checks, ...analysis.B.checks, ...analysis.beamChecks]}
      steps={analysis.paramSteps.filter((s) => s.print)}
      status={status}
      notes={NOTES}
      remarks={remarks}
      pageNumber={pageNumber}
      totalPages={totalPages}
    />
  )
}
