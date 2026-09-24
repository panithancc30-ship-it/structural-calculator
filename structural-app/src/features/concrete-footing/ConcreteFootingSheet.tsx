import { FootingPlan, FootingSection } from '@/components/concrete/footing/FootingDrawings'
import {
  POSITION_TH,
  pickPlanScale,
  pickSectionScale,
  planTitle,
  sectionTitle,
} from '@/components/concrete/footing/footingDrawingModel'
import { ACI318_WSD_FOOTING } from '@/engine/concrete/codes/aci318Wsd'
import { analyzeFooting, type FootingAnalysis } from '@/engine/concrete/footing/analyzeFooting'
import { footingDims } from '@/engine/concrete/footing/designFooting'
import type { FootingInput } from '@/engine/concrete/footing/types'
import { validateFootingInput } from '@/engine/concrete/footing/validate'
import { fmt } from '@/engine/concrete/format'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { FOOTING_PLAN_BOX, FOOTING_SECTION_BOX } from '@/features/concrete/reportScale'
import type { SheetRenderProps } from '@/features/registry'
import { parseFootingProject } from '@/state/footingStore'

const m2 = (cm: number) => fmt(cm / 100, 2)

const NOTES = [
  'หน่วย kg, cm, ksc — แรงดันดินจากแรงใช้งาน ฐานรากแข็ง ดินไม่รับแรงดึง; qa เทียบแรงดันรวมน้ำหนักฐานรากและดินถม',
  'ออกแบบโครงสร้างด้วยแรงดันสุทธิ (q − w); เฉือนทะลุรวมผลโมเมนต์ถ่ายเท γv·M·c/J',
  'ฐานรากตีนเป็ดให้ดินรับโมเมนต์จากการเยื้องศูนย์ทั้งหมด (ไม่มีคานยึด)',
]

interface Analyzed {
  input: FootingInput
  analysis: FootingAnalysis
  denom: number
}

export function analyzeFootingSheet(value: unknown): Analyzed | null {
  const file = parseFootingProject(value)
  if (typeof file === 'string') return null
  if (validateFootingInput(file.input).length > 0) return null
  try {
    const analysis = analyzeFooting(file.input, footingDims(file.input), file.layout)
    // แปลนและรูปตัดใช้มาตราส่วนเดียวกันทั้งแผ่น ตามแบบวิศวกรรมทั่วไป
    // เลือกค่าที่หยาบกว่าของสองรูป จึงมั่นใจได้ว่าทั้งคู่ลงในกรอบ
    const denom = Math.max(
      pickPlanScale(file.input, analysis, FOOTING_PLAN_BOX),
      pickSectionScale(file.input, analysis, FOOTING_SECTION_BOX),
    )
    return { input: file.input, analysis, denom }
  } catch {
    return null
  }
}

export function ConcreteFootingSheet({ project, title, input, remarks, pageNumber, totalPages }: SheetRenderProps) {
  const result = analyzeFootingSheet(input)

  if (!result) {
    return <ConcreteSheetFallback project={project} title={title} pageNumber={pageNumber} totalPages={totalPages} />
  }

  const { input: footing, analysis, denom } = result
  const { dims, loads } = analysis
  const p = loads.pressure

  const inputRows: InputRow[] = [
    {
      label: 'ฐานราก',
      cells: [
        `B × L × t = ${m2(dims.B)} × ${m2(dims.L)} × ${m2(dims.t)} ม. (${footing.sizeMode === 'auto' ? 'อัตโนมัติ' : 'กำหนดเอง'})`,
        `เสา ${fmt(footing.cx, 0)} × ${fmt(footing.cy, 0)} ซม. — ${POSITION_TH[footing.position]}`,
        `covering = ${fmt(footing.cover, 1)} ซม., Df = ${fmt(footing.Df, 2)} ม.`,
      ],
    },
    {
      label: 'ดิน / วัสดุ',
      cells: [
        `qa = ${fmt(footing.qa, 2)} t/m², γs = ${fmt(footing.gammaSoil, 2)} t/m³`,
        `f′c = ${fmt(footing.fc, 0)} ksc`,
        `fy = ${fmt(footing.fy, 0)} ksc`,
      ],
    },
    {
      label: 'แรงใช้งาน',
      cells: [
        `P = ${fmt(footing.P / 1000, 2)} ตัน`,
        `Mx = ${fmt(footing.Mx / 1000, 2)} t·m`,
        `My = ${fmt(footing.My / 1000, 2)} t·m`,
      ],
    },
    {
      label: 'ผลออกแบบ',
      cells: [
        `qmax = ${fmt(p.qmax * 10, 2)} t/m² (ดินรับแรง ${fmt(p.contactRatio * 100, 0)}%)`,
        `ex = ${m2(loads.ex)}, ey = ${m2(loads.ey)} ม.`,
        `เหล็ก X ${analysis.x.count}-${analysis.x.size}, Y ${analysis.y.count}-${analysis.y.size}`,
      ],
    },
  ]

  const figures = (
    <>
      <figure className="rc-plan">
        <FootingPlan
          input={footing}
          analysis={analysis}
          denom={denom}
          title={planTitle(footing)}
          physicalSize
        />
      </figure>
      <div className="rc-sections">
        {(['x', 'y'] as const).map((dir) => (
          <figure key={dir}>
            <FootingSection
              input={footing}
              analysis={analysis}
              denom={denom}
              dir={dir}
              title={sectionTitle(dir)}
              physicalSize
            />
          </figure>
        ))}
      </div>
    </>
  )

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="ฐานรากแผ่คอนกรีตเสริมเหล็ก"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${ACI318_WSD_FOOTING.label}`}
      inputRows={inputRows}
      figureTitle="แปลนฐานราก และรูปตัด"
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
