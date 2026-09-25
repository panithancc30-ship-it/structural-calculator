import { SectionDrawing } from '@/components/concrete/drawing/SectionDrawing'
import { pickScale } from '@/components/concrete/drawing/drawingModel'
import { SECTION_TITLES, SUPPORT_TH } from '@/components/concrete/labels'
import { ACI318_WSD } from '@/engine/concrete/codes/aci318Wsd'
import { fmt } from '@/engine/concrete/format'
import { analyzeLedgeBeam, type LedgeAnalysis } from '@/engine/concrete/ledge/analyzeLedge'
import { validateLedgeInput } from '@/engine/concrete/ledge/validate'
import type { SectionKey } from '@/engine/concrete/types'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { BEAM_BOX } from '@/features/concrete/reportScale'
import type { SheetRenderProps } from '@/features/registry'
import { parseLedgeProject, type LedgeProjectFile } from '@/state/ledgeStore'

const KEYS: SectionKey[] = ['A', 'B']

const NOTES = [
  'หน่วย kg, cm, ksc — น้ำหนักใช้งาน ความยาวพื้นยื่นวัดจากศูนย์กลางคาน · ปลายคานยึดไม่ให้บิด T = t·L/2 · V และ T ที่ระยะ d จากที่รองรับใช้ตรวจทั้งสองหน้าตัด (ปลอดภัยไว้ก่อน)',
  'แรงบิดตาม วสท.: vt = 3.5T/Σx²y ≤ 1.32√f′c, v + vt ≤ 1.65√f′c, vt > 0.29√f′c เหล็กปลอกปิดรับแรงบิดทั้งหมด',
]
const CONTINUOUS_NOTE = 'ช่วงต่อเนื่องใช้สัมประสิทธิ์โมเมนต์โดยประมาณ (วสท. ตรงกับ ACI 8.3.3) ต้องมีช่วงใกล้เคียงกันและ LL ≤ 3DL'

/** ขั้นตอนของหน้าตัดที่พิมพ์ต่อจากน้ำหนัก — เหล็กรับแรงบิดคือสิ่งที่คานรับพื้นยื่นต่างจากคานทั่วไป */
const TORSION_STEPS = ['At/s', 'Al']

interface Analyzed {
  file: LedgeProjectFile
  analysis: LedgeAnalysis
  denom: number
}

/** คำนวณจากข้อมูลของรายการล้วน ๆ เพื่อให้รูปเล่มและสารบัญใช้ได้โดยไม่พึ่ง store */
export function analyzeLedgeBeamSheet(input: unknown): Analyzed | null {
  const file = parseLedgeProject(input)
  if (typeof file === 'string') return null
  if (validateLedgeInput(file.input).length > 0) return null
  try {
    const analysis = analyzeLedgeBeam(file.input, file.layouts)
    return { file, analysis, denom: pickScale(analysis.sections.A, file.layouts, BEAM_BOX.w, BEAM_BOX.h) }
  } catch {
    return null
  }
}

export function ConcreteLedgeBeamSheet({ project, title, input, remarks, pageNumber, totalPages }: SheetRenderProps) {
  const result = analyzeLedgeBeamSheet(input)

  if (!result) {
    return <ConcreteSheetFallback project={project} title={title} pageNumber={pageNumber} totalPages={totalPages} />
  }

  const { file, analysis, denom } = result
  const { input: beam, layouts } = file
  const { loads } = analysis
  const p = analysis.params

  const tipWall =
    beam.tipWallH > 0
      ? `ผนังปลายพื้น ${fmt(beam.tipWallH, 2)} ม. × ${fmt(beam.tipWallW, 0)} กก./ตร.ม.`
      : 'ไม่มีผนังที่ปลายพื้น'
  const extras = [
    beam.beamWallH > 0 ? `ผนังบนคาน ${fmt(beam.beamWallH, 2)} ม. × ${fmt(beam.beamWallW, 0)} กก./ตร.ม.` : null,
    beam.otherLoad > 0 ? `อื่น ${fmt(beam.otherLoad, 0)} กก./ม.` : null,
  ].filter(Boolean)

  const inputRows: InputRow[] = [
    {
      label: 'พื้นยื่น',
      cells: [
        `Lc = ${fmt(beam.slabLength, 2)} ม. · t = ${fmt(beam.slabT, 0)} ซม.`,
        `ปูผิว ${fmt(beam.finishDL, 0)} · จร ${fmt(beam.LL, 0)} กก./ตร.ม.`,
        tipWall,
      ],
    },
    {
      label: 'คาน',
      cells: [
        `b × h = ${fmt(beam.b, 0)} × ${fmt(beam.h, 0)} ซม. · covering ${fmt(beam.cover, 1)} ซม.`,
        `L = ${fmt(beam.L, 2)} ม. (${SUPPORT_TH[beam.support]})`,
        extras.length ? extras.join(' · ') : 'ไม่มีน้ำหนักอื่นลงคาน',
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
      label: 'ค่าออกแบบ',
      cells: [
        `n = ${p.n}, k = ${fmt(p.k, 3)}, j = ${fmt(p.j, 3)}, R = ${fmt(p.R, 2)}`,
        `fc = ${fmt(p.fcAllow, 1)}, fs = ${fmt(p.fsAllow, 0)}, fv = ${fmt(p.fvAllow, 0)} ksc`,
        `d ≈ ${fmt(loads.dCrit, 1)} ซม. (ตำแหน่งหน้าตัดวิกฤต)`,
      ],
    },
  ]

  const figures = KEYS.map((key) => (
    <figure key={key}>
      <SectionDrawing
        input={analysis.sections[key]}
        layout={layouts[key]}
        denom={denom}
        title={SECTION_TITLES[key].title}
        subtitle={SECTION_TITLES[key].subtitle}
        physicalSize
      />
    </figure>
  ))

  const steps = [
    ...analysis.loadSteps.filter((s) => s.print),
    ...analysis.A.steps.filter((s) => TORSION_STEPS.includes(s.label)),
  ]

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="คานรับพื้นยื่น คอนกรีตเสริมเหล็ก"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${ACI318_WSD.label}`}
      inputRows={inputRows}
      figureTitle="หน้าตัดและการเสริมเหล็ก"
      figures={figures}
      checks={analysis.checks}
      steps={steps}
      status={analysis.status}
      notes={loads.divisors.neg === null ? NOTES : [...NOTES, CONTINUOUS_NOTE]}
      remarks={remarks}
      pageNumber={pageNumber}
      totalPages={totalPages}
    />
  )
}
