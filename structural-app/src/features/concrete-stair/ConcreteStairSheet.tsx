import { StairSection } from '@/components/concrete/stair/StairDrawing'
import { END_TH, pickStairScale, stairRunText } from '@/components/concrete/stair/stairDrawingModel'
import { ACI318_WSD_STAIR } from '@/engine/concrete/codes/aci318Wsd'
import { fmt } from '@/engine/concrete/format'
import { analyzeStair, USAGE_TH, type StairAnalysis } from '@/engine/concrete/stair/analyzeStair'
import { stairDims } from '@/engine/concrete/stair/designStair'
import { degrees } from '@/engine/concrete/stair/geometry'
import type { StairInput, StairLayout } from '@/engine/concrete/stair/types'
import { validateStairInput } from '@/engine/concrete/stair/validate'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { STAIR_SECTION_BOX } from '@/features/concrete/reportScale'
import type { SheetRenderProps } from '@/features/registry'
import { parseStairProject } from '@/state/stairStore'

const m2 = (cm: number) => fmt(cm / 100, 2)

const NOTES = [
  'หน่วย kg, cm, ksc — แรงใช้งานต่อพื้นที่ฉายราบ ออกแบบเป็นพื้นทางเดียวแถบกว้าง 1 ม. พาดระหว่างศูนย์กลางคาน',
  'M ช่วงยึดหมุนจากสถิตศาสตร์ แล้วใช้สัมประสิทธิ์โมเมนต์โดยประมาณ (วสท. ตรงกับ ACI 8.3.3) กับ w เทียบเท่า 8M/L² · ปลายหล่อติดคานใส่เหล็กบนรับ w·L²/24',
  'คุมการโก่งตัวด้วยความหนาขั้นต่ำ · ขนาดขั้นบันไดตามกฎกระทรวงฉบับที่ 55 ควรทานกับฉบับปัจจุบัน',
]

interface Analyzed {
  input: StairInput
  layout: StairLayout
  analysis: StairAnalysis
  denom: number
}

export function analyzeStairSheet(value: unknown): Analyzed | null {
  const file = parseStairProject(value)
  if (typeof file === 'string') return null
  if (validateStairInput(file.input).length > 0) return null
  try {
    const dims = stairDims(file.input)
    const analysis = analyzeStair(file.input, dims, file.layout)
    return {
      input: file.input,
      layout: file.layout,
      analysis,
      denom: pickStairScale(file.input, analysis, file.layout, STAIR_SECTION_BOX),
    }
  } catch {
    return null
  }
}

export function ConcreteStairSheet({ project, title, input, remarks, pageNumber, totalPages }: SheetRenderProps) {
  const result = analyzeStairSheet(input)

  if (!result) {
    return <ConcreteSheetFallback project={project} title={title} pageNumber={pageNumber} totalPages={totalPages} />
  }

  const { input: stair, layout, analysis, denom } = result
  const { dims, loads, hMin, profile, reactions } = analysis

  const inputRows: InputRow[] = [
    {
      label: 'ขั้นบันได',
      cells: [
        `ลูกตั้ง ${stair.risers} × ${fmt(stair.riser, 1)} ซม. = ${m2(profile.rise)} ม.`,
        `ลูกนอน ${stair.risers - 1} × ${fmt(stair.tread, 1)} ซม. = ${m2(profile.run)} ม. · ลาด ${fmt(degrees(profile.theta), 1)}°`,
        `กว้าง ${m2(stair.width)} ม. · ${USAGE_TH[stair.usage]}`,
      ],
    },
    {
      label: 'ช่วงและปลาย',
      cells: [
        `L = ${m2(profile.L)} ม. (ราบล่าง ${m2(stair.landingLow)} · ราบบน ${m2(stair.landingHigh)})`,
        `ปลายล่าง ${END_TH[stair.endLow]} · ปลายบน ${END_TH[stair.endHigh]}`,
        `t = ${fmt(dims.t, 1)} ซม. (${stair.thicknessMode === 'auto' ? 'อัตโนมัติ' : 'กำหนดเอง'}) · covering ${fmt(stair.cover, 1)} ซม.`,
      ],
    },
    {
      label: 'น้ำหนักบรรทุก',
      cells: [
        `ช่วงลาด ${fmt(loads.wFlight, 0)} กก./ตร.ม.`,
        `ส่วนราบ ${fmt(loads.wLanding, 0)} กก./ตร.ม.`,
        `ปูผิว ${fmt(stair.finishDL, 0)} · จร ${fmt(stair.LL, 0)} กก./ตร.ม.`,
      ],
    },
    {
      label: 'ผลออกแบบ',
      cells: [
        `h ขั้นต่ำ ${fmt(hMin.required, 1)} ซม. · f′c ${fmt(stair.fc, 0)} · fy ${fmt(stair.fy, 0)} ksc`,
        `ล่าง ${stairRunText(layout, 'bottom')} · กระจาย ${stairRunText(layout, 'dist')}`,
        `บน ${stairRunText(layout, 'topLow')} · ${stairRunText(layout, 'topHigh')} · ลงคาน ${fmt(reactions.low, 0)} · ${fmt(reactions.high, 0)} กก./ม.`,
      ],
    },
  ]

  const figures = (
    <figure className="rc-plan">
      <StairSection input={stair} analysis={analysis} layout={layout} denom={denom} physicalSize />
    </figure>
  )

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="บันไดคอนกรีตเสริมเหล็ก"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${ACI318_WSD_STAIR.label}`}
      inputRows={inputRows}
      figureTitle="รูปตัดบันได"
      figures={figures}
      checks={analysis.checks}
      steps={analysis.steps.filter((s) => s.print)}
      status={analysis.status}
      notes={NOTES}
      remarks={remarks}
      pageNumber={pageNumber}
      totalPages={totalPages}
    />
  )
}
