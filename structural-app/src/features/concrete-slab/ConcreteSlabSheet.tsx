import { GroundSlabDetail } from '@/components/concrete/slab/GroundSlabDrawings'
import { GROUND_DETAILS, meshSummary, pickGroundScale } from '@/components/concrete/slab/groundSlabDrawingModel'
import { SlabDetailDrawing } from '@/components/concrete/slab/SlabDetailDrawing'
import { detailSummary, LEVEL_SUFFIX, pickDetailScale } from '@/components/concrete/slab/slabDetailModel'
import { SlabPlan, SlabSection } from '@/components/concrete/slab/SlabDrawings'
import {
  dirSummary,
  EDGE_TH,
  pickPlanScale,
  pickSectionScale,
  sectionDirs,
  SLAB_TYPE_TH,
} from '@/components/concrete/slab/slabDrawingModel'
import { codeLabel, codeOf } from '@/engine/concrete/codes/designCode'
import { fmt } from '@/engine/concrete/format'
import { analyzeSlab, type SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab'
import { slabDims } from '@/engine/concrete/slab/designSlab'
import type { SlabInput, SlabLayout } from '@/engine/concrete/slab/types'
import { validateSlabInput } from '@/engine/concrete/slab/validate'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { SLAB_DETAIL_BOX, SLAB_GROUND_BOX, SLAB_PLAN_BOX, SLAB_SECTION_BOX } from '@/features/concrete/reportScale'
import type { SheetRenderProps } from '@/features/registry'
import { parseSlabProject } from '@/state/slabStore'

const m2 = (cm: number) => fmt(cm / 100, 2)

const BASE_NOTES = [
  'หน่วย kg, cm, ksc — น้ำหนักบรรทุกเป็นแรงใช้งาน ไม่คูณตัวประกอบ',
  'พื้นทางเดียวและพื้นยื่นใช้สัมประสิทธิ์โมเมนต์โดยประมาณ (วสท. ตรงกับ ACI 8.3.3: ต้องมี LL ≤ 3·DL และช่วงติดกันต่างกันไม่เกิน 20%)',
  'ควบคุมการโก่งตัวด้วยความหนาขั้นต่ำ ไม่ได้คำนวณค่าการโก่งตัวจริง',
]

const DETAIL_NOTE =
  'เสริมเหล็กตามแบบขยายพื้น S1: เหล็กล่างคอม้าเว้นเส้น งอขึ้นที่ L/5 จากศูนย์กลางคานแล้วผ่านที่รองรับไปเป็นเหล็กบน ' +
  'และเหล็กเสริมพิเศษยื่น L/4 (L = ช่วงสั้น) — As− ที่ขอบ = คอม้า/2 + เสริมพิเศษ'

const DETAIL_NOTE_TWO_WAY = 'พื้นสองทาง: ด้านยาวเสริมแบบเดียวกัน (คอม้าเว้นเส้น) และใช้เหล็กเสริมพิเศษชุดเดียวกับด้านสั้น'

const TWO_WAY_NOTE =
  'พื้นสองทางใช้ตารางสัมประสิทธิ์โมเมนต์ วิธีที่ 2 ตามมาตรฐาน วสท. (M = C·w·S², S = ช่วงสั้น) ออกแบบทีละแถบกว้าง 1 ม. ' +
  'ด้วยโมเมนต์ของแถบกลางทั้งแผ่น — ยังไม่ได้ออกแบบเหล็กกันบิดที่มุมแผ่น'

const TWO_WAY_NOTE_ACI =
  'พื้นสองทางแบ่งน้ำหนักด้วยวิธี Rankine–Grashof (wx = w·ly⁴/(lx⁴+ly⁴)) แล้วออกแบบแต่ละทิศเป็นแถบทางเดียวกว้าง 1 ม. ' +
  'ด้วยสัมประสิทธิ์โมเมนต์ ACI 8.3.3 — ยังไม่ได้ออกแบบเหล็กกันบิดที่มุมแผ่น'

const ON_GROUND_NOTES = [
  'หน่วย kg, cm, ksc, t/m² — น้ำหนักบรรทุกเป็นแรงใช้งาน ไม่คูณตัวประกอบ',
  'พื้นวางบนดินตามแบบขยายพื้น GS: แยกจากคานด้วยร่องยาแนว ห้ามฝังเหล็กเข้าคาน น้ำหนักทั้งหมดลงทรายรองพื้นโดยตรง ' +
    'ความหนาขั้นต่ำตามการใช้งาน แรงดันใต้พื้น q = น้ำหนักคงที่ + จร ต้องไม่เกิน qa',
  'เหล็กตะแกรงกันร้าวคิดด้วยสูตร subgrade drag As = F·L·W/(2fs) (F = 1.5, L = ความยาวแผ่นระหว่างรอยต่อ, ' +
    'W = น้ำหนักตัวพื้น + ปูผิว) — ACI 318 ไม่ครอบคลุมพื้นวางบนดินที่ไม่ได้รับน้ำหนักจากโครงสร้างส่วนอื่น',
  'ไม่ได้ตรวจน้ำหนักกระทำเป็นจุดหรือเป็นแนว (ล้อรถ ผนัง) ซึ่งต้องใช้ค่า modulus of subgrade reaction จากผลทดสอบดิน — ผนังให้วางบนคาน',
]

interface Analyzed {
  input: SlabInput
  layout: SlabLayout
  analysis: SlabAnalysis
  planDenom: number
  sectionDenom: number
  /** มาตราส่วนแบบขยายพื้น GS (พื้นวางบนดิน) */
  groundDenom: number
  /** มาตราส่วนแบบขยายพื้น S1 (พื้นทางเดียว/สองทาง) */
  detailDenom: number
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
      groundDenom: analysis.ground ? pickGroundScale(file.input, analysis, file.layout, SLAB_GROUND_BOX) : 20,
      detailDenom: analysis.detail ? pickDetailScale(file.input, analysis, file.layout, SLAB_DETAIL_BOX) : 20,
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

  const { input: slab, layout, analysis, planDenom, sectionDenom, groundDenom, detailDenom } = result
  const { dims, loads, hMin, ground, detail } = analysis
  const onGround = slab.slabType === 'onGround'
  const cantilever = slab.slabType === 'cantilever'

  const spanText = cantilever
    ? `ระยะยื่น ${m2(dims.lx)} ม. × กว้าง ${m2(dims.ly)} ม.`
    : onGround
      ? `แผ่นระหว่างรอยต่อ ${m2(dims.lx)} × ${m2(dims.ly)} ม.`
      : `lx × ly = ${m2(dims.lx)} × ${m2(dims.ly)} ม.`

  const edgeText = ground
    ? `ทรายอัดแน่นบนดิน qa = ${fmt(ground.qa)} t/m²`
    : `ขอบ x: ${EDGE_TH[slab.edgeX1]}–${EDGE_TH[slab.edgeX2]}, ขอบ y: ${EDGE_TH[slab.edgeY1]}–${EDGE_TH[slab.edgeY2]}`

  const bars = detail ? detailSummary(slab, layout, analysis) : []
  const inputRows: InputRow[] = [
    {
      label: 'พื้น',
      cells: [
        `${SLAB_TYPE_TH[slab.slabType]}${detail && slab.level === 'dropped' ? ` ${LEVEL_SUFFIX.dropped}` : ''} — ${spanText}`,
        `หนา t = ${fmt(dims.t, 1)} ซม. (${slab.thicknessMode === 'auto' ? 'อัตโนมัติ' : 'กำหนดเอง'})`,
        `covering = ${fmt(slab.cover, 1)} ซม.`,
      ],
    },
    {
      label: ground ? 'รองรับด้วย' : 'ขอบรองรับ',
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
    ground
      ? {
          label: 'ผลออกแบบ',
          cells: [
            `h ขั้นต่ำ ${fmt(hMin.required, 1)} ซม. (${hMin.label})`,
            `เหล็กตะแกรง ${meshSummary(layout)}`,
            `q = ${fmt(ground.q)} ≤ qa · รับจรได้ ${fmt(ground.liveCapacity, 0)} กก./ตร.ม.`,
          ],
        }
      : detail
        ? {
            label: 'ผลออกแบบ',
            cells: [
              `h ขั้นต่ำ ${fmt(hMin.required, 1)} ซม. (${hMin.label})`,
              bars.slice(0, 2).map((b) => `${b.label} ${b.text}`).join(' · '),
              `${bars[2].label} ${bars[2].text}`,
            ],
          }
        : {
          label: 'ผลออกแบบ',
          cells: [
            `h ขั้นต่ำ ${fmt(hMin.required, 1)} ซม. (${hMin.label})`,
            `เหล็กทิศ X: ${dirSummary(layout, 'x')}`,
            `เหล็กทิศ Y: ${dirSummary(layout, 'y')}`,
          ],
        },
  ]

  // พื้นวางบนดินใช้แบบขยายพื้น GS และพื้นทางเดียว/สองทางใช้แบบขยายพื้น S1 แบบเดียว แทนแปลนและรูปตัด
  const figures = detail ? (
    <figure>
      <SlabDetailDrawing input={slab} analysis={analysis} layout={layout} denom={detailDenom} physicalSize />
    </figure>
  ) : ground ? (
    <>
      {GROUND_DETAILS.map((kind) => (
        <figure key={kind}>
          <GroundSlabDetail input={slab} analysis={analysis} layout={layout} kind={kind} denom={groundDenom} physicalSize />
        </figure>
      ))}
    </>
  ) : (
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
    ? ON_GROUND_NOTES
    : slab.slabType === 'twoWay'
      ? [...BASE_NOTES, codeOf(slab) === 'aci' ? TWO_WAY_NOTE_ACI : TWO_WAY_NOTE, DETAIL_NOTE, DETAIL_NOTE_TWO_WAY]
      : detail
        ? [...BASE_NOTES, DETAIL_NOTE]
        : BASE_NOTES

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="พื้นคอนกรีตเสริมเหล็กหล่อในที่"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${codeLabel(codeOf(slab), 'พื้นหล่อในที่')}`}
      inputRows={inputRows}
      figureTitle={
        ground
          ? `แบบขยายพื้น ${slab.slabName || 'GS'}`
          : detail
            ? `แบบขยายพื้น ${slab.slabName || 'S1'}`
            : 'แปลนพื้น และรูปตัด'
      }
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
