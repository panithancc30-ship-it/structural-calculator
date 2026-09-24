import { PileCapPlan, PileCapSection } from '@/components/concrete/pilecap/PileCapDrawings'
import { PILE_LENGTH_NOTE, pickDrawingScale, pileText } from '@/components/concrete/pilecap/pileCapDrawingModel'
import { fmt } from '@/engine/concrete/format'
import { analyzePileCap, type PileCapAnalysis } from '@/engine/concrete/pilecap/analyzePileCap'
import { pileCapDesign } from '@/engine/concrete/pilecap/designPileCap'
import type { PileCapInput } from '@/engine/concrete/pilecap/types'
import { validatePileCapInput } from '@/engine/concrete/pilecap/validate'
import { ACI318_WSD_PILECAP } from '@/engine/concrete/codes/aci318Wsd'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { PILECAP_PLAN_BOX, PILECAP_SECTION_BOX } from '@/features/concrete/reportScale'
import type { SheetRenderProps } from '@/features/registry'
import { parsePileCapProject } from '@/state/pileCapStore'

const m2 = (cm: number) => fmt(cm / 100, 2)

const NOTES = [
  'หน่วย kg, cm, ksc — ฐานรากแข็ง แรงในเข็มแปรผันเชิงเส้นรอบศูนย์ถ่วงกลุ่มเข็มจริง รวมผลเยื้องศูนย์ของเสาและเข็ม',
  'ออกแบบโครงสร้างด้วยแรงเข็มจาก P, M (น้ำหนักฐานรากถ่ายลงเข็มโดยตรง); เข็มคร่อมหน้าตัดวิกฤตคิดตามสัดส่วน (ACI 15.5.4)',
  PILE_LENGTH_NOTE,
]

interface Analyzed {
  input: PileCapInput
  analysis: PileCapAnalysis
  denom: number
}

export function analyzePileCapSheet(value: unknown): Analyzed | null {
  const file = parsePileCapProject(value)
  if (typeof file === 'string') return null
  if (validatePileCapInput(file.input).length > 0) return null
  try {
    const design = pileCapDesign(file.input)
    const analysis = analyzePileCap(file.input, design.arrangement, design.t, file.layout)
    return { input: file.input, analysis, denom: pickDrawingScale(file.input, analysis, PILECAP_PLAN_BOX, PILECAP_SECTION_BOX) }
  } catch {
    return null
  }
}

export function ConcretePileCapSheet({ project, title, input, remarks, pageNumber, totalPages }: SheetRenderProps) {
  const result = analyzePileCapSheet(input)

  if (!result) {
    return <ConcreteSheetFallback project={project} title={title} pageNumber={pageNumber} totalPages={totalPages} />
  }

  const { input: cap, analysis, denom } = result
  const { dims, loads, pile } = analysis
  const n = loads.piles.nominal.length

  const inputRows: InputRow[] = [
    {
      label: 'ฐานราก',
      cells: [
        `Bx × By × t = ${m2(dims.B)} × ${m2(dims.L)} × ${m2(dims.t)} ม.`,
        `เสา ${fmt(cap.cx, 0)} × ${fmt(cap.cy, 0)} ซม., เยื้อง ex = ${m2(cap.ex)}, ey = ${m2(cap.ey)} ม.`,
        `covering = ${fmt(cap.cover, 1)} ซม., Df = ${fmt(cap.Df, 2)} ม.`,
      ],
    },
    {
      label: 'เสาเข็ม',
      cells: [
        `${pileText(cap)} × ${n} ต้น`,
        `Pa = ${fmt(cap.pileCapacity, 2)} ตัน/ต้น, Ta = ${fmt(cap.pileTension, 2)} ตัน/ต้น`,
        `s = ${m2(cap.spacing)} ม., เยื้องหลังตอกสูงสุด ${fmt(pile.maxOffset, 1)} ซม.`,
      ],
    },
    {
      label: 'วัสดุ / แรง',
      cells: [
        `f′c = ${fmt(cap.fc, 0)} ksc, fy = ${fmt(cap.fy, 0)} ksc`,
        `P = ${fmt(cap.P / 1000, 2)} ตัน`,
        `Mx = ${fmt(cap.Mx / 1000, 2)}, My = ${fmt(cap.My / 1000, 2)} t·m`,
      ],
    },
    {
      label: 'ผลออกแบบ',
      cells: [
        `Rmax = ${fmt(pile.Rmax / 1000, 2)}, Rmin = ${fmt(pile.Rmin / 1000, 2)} ตัน/ต้น`,
        `R: ${loads.service.R.map((r) => fmt(r / 1000, 1)).join(', ')} ตัน`,
        `เหล็ก X ${analysis.x.count}-${analysis.x.size}, Y ${analysis.y.count}-${analysis.y.size}`,
      ],
    },
  ]

  const figures = (
    <>
      <figure className="rc-plan">
        <PileCapPlan input={cap} analysis={analysis} denom={denom} physicalSize />
      </figure>
      <div className="rc-sections">
        {(['x', 'y'] as const).map((dir) => (
          <figure key={dir}>
            <PileCapSection input={cap} analysis={analysis} denom={denom} dir={dir} physicalSize />
          </figure>
        ))}
      </div>
    </>
  )

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="ฐานรากเสาเข็มคอนกรีตเสริมเหล็ก"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${ACI318_WSD_PILECAP.label}`}
      inputRows={inputRows}
      figureTitle="แปลนฐานรากเสาเข็ม และรูปตัด"
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
