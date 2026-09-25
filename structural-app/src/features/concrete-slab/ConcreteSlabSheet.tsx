import { SlabPlan, SlabSection } from '@/components/concrete/slab/SlabDrawings'
import {
  dirSummary,
  EDGE_TH,
  pickPlanScale,
  pickSectionScale,
  sectionDirs,
  SLAB_TYPE_TH,
} from '@/components/concrete/slab/slabDrawingModel'
import { ACI318_WSD_SLAB } from '@/engine/concrete/codes/aci318Wsd'
import { fmt } from '@/engine/concrete/format'
import { analyzeSlab, type SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab'
import { slabDims } from '@/engine/concrete/slab/designSlab'
import type { SlabInput, SlabLayout } from '@/engine/concrete/slab/types'
import { validateSlabInput } from '@/engine/concrete/slab/validate'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { SLAB_PLAN_BOX, SLAB_SECTION_BOX } from '@/features/concrete/reportScale'
import type { SheetRenderProps } from '@/features/registry'
import { parseSlabProject } from '@/state/slabStore'

const m2 = (cm: number) => fmt(cm / 100, 2)

const BASE_NOTES = [
  'หน่วย kg, cm, ksc — น้ำหนักบรรทุกเป็นแรงใช้งาน ไม่คูณตัวประกอบ',
  'พื้นทางเดียวและพื้นยื่นใช้สัมประสิทธิ์โมเมนต์โดยประมาณ (วสท. ตรงกับ ACI 8.3.3: ต้องมี LL ≤ 3·DL และช่วงติดกันต่างกันไม่เกิน 20%)',
  'ควบคุมการโก่งตัวด้วยความหนาขั้นต่ำ ไม่ได้คำนวณค่าการโก่งตัวจริง',
]

const TWO_WAY_NOTE =
  'พื้นสองทางใช้ตารางสัมประสิทธิ์โมเมนต์ วิธีที่ 2 ตามมาตรฐาน วสท. (M = C·w·S², S = ช่วงสั้น) ออกแบบทีละแถบกว้าง 1 ม. ' +
  'ด้วยโมเมนต์ของแถบกลางทั้งแผ่น — ยังไม่ได้ออกแบบเหล็กกันบิดที่มุมแผ่น'

const ON_GROUND_NOTE =
  'กำหนดความหนาตามการใช้งานและเสริมเหล็กกันร้าวเท่านั้น — ยังไม่ได้ตรวจน้ำหนักกระทำเป็นจุดหรือล้อรถ ' +
  'ซึ่งต้องใช้ค่า modulus of subgrade reaction จากผลทดสอบดิน'

interface Analyzed {
  input: SlabInput
  layout: SlabLayout
  analysis: SlabAnalysis
  planDenom: number
  sectionDenom: number
}

export function analyzeSlabSheet(value: unknown): Analyzed | null {
  const file = parseSlabProject(value)
  if (typeof file === 'string') return null
  if (validateSlabInput(file.input).length > 0) return null
  try {
    const dims = slabDims(file.input)
    const analysis = analyzeSlab(file.input, dims, file.layout)
    // แปลนกับรูปตัดใช้คนละมาตราส่วน เพราะรูปตัดพื้นเป็นแถบยาวบาง
    // ถ้าบังคับให้เท่าแปลน ความหนาพื้นจะเหลือเป็นเส้นเดียวจนอ่านเหล็กไม่ออก — เขียนมาตราส่วนกำกับไว้ใต้รูปแต่ละรูปแล้ว
    return {
      input: file.input,
      layout: file.layout,
      analysis,
      planDenom: pickPlanScale(file.input, analysis, file.layout, SLAB_PLAN_BOX),
      sectionDenom: pickSectionScale(file.input, analysis, file.layout, SLAB_SECTION_BOX),
    }
  } catch {
    return null
  }
}

export function ConcreteSlabSheet({ project, title, input, remarks, pageNumber, totalPages }: SheetRenderProps) {
  const result = analyzeSlabSheet(input)

  if (!result) {
    return <ConcreteSheetFallback project={project} title={title} pageNumber={pageNumber} totalPages={totalPages} />
  }

  const { input: slab, layout, analysis, planDenom, sectionDenom } = result
  const { dims, loads, hMin } = analysis
  const onGround = slab.slabType === 'onGround'
  const cantilever = slab.slabType === 'cantilever'

  const spanText = cantilever
    ? `ระยะยื่น ${m2(dims.lx)} ม. × กว้าง ${m2(dims.ly)} ม.`
    : `lx × ly = ${m2(dims.lx)} × ${m2(dims.ly)} ม.`

  const edgeText = onGround
    ? 'วางบนดินโดยตรง'
    : `ขอบ x: ${EDGE_TH[slab.edgeX1]}–${EDGE_TH[slab.edgeX2]}, ขอบ y: ${EDGE_TH[slab.edgeY1]}–${EDGE_TH[slab.edgeY2]}`

  const inputRows: InputRow[] = [
    {
      label: 'พื้น',
      cells: [
        `${SLAB_TYPE_TH[slab.slabType]} — ${spanText}`,
        `หนา t = ${fmt(dims.t, 1)} ซม. (${slab.thicknessMode === 'auto' ? 'อัตโนมัติ' : 'กำหนดเอง'})`,
        `covering = ${fmt(slab.cover, 1)} ซม.`,
      ],
    },
    {
      label: 'ขอบรองรับ',
      cells: [edgeText, `f′c = ${fmt(slab.fc, 0)} ksc`, `fy = ${fmt(slab.fy, 0)} ksc`],
    },
    {
      label: 'น้ำหนักบรรทุก',
      cells: [
        `ตัวพื้น ${fmt(loads.wSelf, 0)} + ปูผิว ${fmt(slab.finishDL, 0)} กก./ตร.ม.`,
        `จร ${fmt(loads.wLive, 0)} กก./ตร.ม.`,
        `รวม w = ${fmt(loads.w, 0)} กก./ตร.ม.`,
      ],
    },
    {
      label: 'ผลออกแบบ',
      cells: [
        `h ขั้นต่ำ ${fmt(hMin.required, 1)} ซม. (${hMin.label})`,
        `เหล็กทิศ X: ${dirSummary(layout, 'x')}`,
        `เหล็กทิศ Y: ${dirSummary(layout, 'y')}`,
      ],
    },
  ]

  const figures = (
    <>
      <figure className="rc-plan">
        <SlabPlan input={slab} analysis={analysis} layout={layout} denom={planDenom} physicalSize />
      </figure>
      <div className="rc-sections">
        {sectionDirs(slab).map((dir) => (
          <figure key={dir}>
            <SlabSection
              input={slab}
              analysis={analysis}
              layout={layout}
              denom={sectionDenom}
              dir={dir}
              physicalSize
            />
          </figure>
        ))}
      </div>
    </>
  )

  const notes = onGround
    ? [BASE_NOTES[0], ON_GROUND_NOTE]
    : slab.slabType === 'twoWay'
      ? [...BASE_NOTES, TWO_WAY_NOTE]
      : BASE_NOTES

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="พื้นคอนกรีตเสริมเหล็กหล่อในที่"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${ACI318_WSD_SLAB.label}`}
      inputRows={inputRows}
      figureTitle="แปลนพื้น และรูปตัด"
      figures={figures}
      checks={analysis.checks}
      steps={analysis.steps.filter((s) => s.print)}
      status={analysis.status}
      notes={notes}
      remarks={remarks}
      pageNumber={pageNumber}
      totalPages={totalPages}
    />
  )
}
