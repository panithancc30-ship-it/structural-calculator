import { ColumnDrawing } from '@/components/concrete/column/ColumnDrawing'
import { InteractionChart } from '@/components/concrete/column/InteractionChart'
import { pickColumnScale } from '@/components/concrete/column/columnDrawingModel'
import { METHOD_TH, analyzeColumn, type ColumnAnalysis } from '@/engine/concrete/column/analyzeColumn'
import { validateColumnInput } from '@/engine/concrete/column/validate'
import { ACI318_WSD_COLUMN } from '@/engine/concrete/codes/aci318Wsd'
import { fmt } from '@/engine/concrete/format'
import { ConcreteSheetLayout, type InputRow } from '@/features/concrete/ConcreteSheetLayout'
import { COLUMN_BOX } from '@/features/concrete/reportScale'
import { ConcreteSheetFallback } from '@/features/concrete/ConcreteSheetFallback'
import type { SheetRenderProps } from '@/features/registry'
import { parseColumnProject, type ColumnProjectFile } from '@/state/columnStore'
import { columnTitles } from './concreteColumnDefaults'

const NOTES = [
  'หน่วย kg, cm, ksc — กำลังยอมให้ = 0.4 × กำลังออกแบบ SDM (φ = 0.70 ปลอกเดี่ยว, 0.75 ปลอกเกลียว)',
  'ผลความชะลูดใช้วิธีขยายโมเมนต์ โดยแทน Pu ด้วย 2.5P',
  'แรงดัดสองแกนตรวจด้วยวิธี Bresler / load contour',
]

interface Analyzed {
  file: ColumnProjectFile
  analysis: ColumnAnalysis
  denom: number
  title: string
  subtitle: string
}

export function analyzeColumnSheet(input: unknown): Analyzed | null {
  const file = parseColumnProject(input)
  if (typeof file === 'string') return null
  if (validateColumnInput(file.input).length > 0 || file.layout.kind !== file.input.shape) return null
  const { title, subtitle } = columnTitles(file.input.columnName, file.input.shape)
  try {
    return {
      file,
      analysis: analyzeColumn(file.input, file.layout),
      denom: pickColumnScale(file.input, file.layout, title, COLUMN_BOX.w, COLUMN_BOX.h),
      title,
      subtitle,
    }
  } catch {
    return null
  }
}

export function ConcreteColumnSheet({ project, title, input, remarks, pageNumber, totalPages }: SheetRenderProps) {
  const result = analyzeColumnSheet(input)

  if (!result) {
    return (
      <ConcreteSheetFallback project={project} title={title} pageNumber={pageNumber} totalPages={totalPages} />
    )
  }

  const { file, analysis, denom, title: figTitle, subtitle } = result
  const col = file.input
  const util = Number.isFinite(analysis.utilization) ? fmt(analysis.utilization, 2) : '—'

  const inputRows: InputRow[] = [
    {
      label: 'หน้าตัด',
      cells: [
        col.shape === 'rect'
          ? `b × h = ${fmt(col.b, 0)} × ${fmt(col.h, 0)} ซม.`
          : `D = ${fmt(col.D, 0)} ซม.`,
        `covering = ${fmt(col.cover, 1)} ซม.`,
        `Lu = ${fmt(col.Lu, 2)} ม. (k = ${ACI318_WSD_COLUMN.autoK.toFixed(1)}, M1/M2 = ${ACI318_WSD_COLUMN.autoM1M2.toFixed(1)}, βd = ${ACI318_WSD_COLUMN.autoBetaD})`,
      ],
    },
    {
      label: 'วัสดุ',
      cells: [
        `f′c = ${fmt(col.fc, 0)} ksc`,
        `fy เหล็กยืน = ${fmt(col.fy, 0)} ksc`,
        `fy ${col.shape === 'rect' ? 'ปลอก' : 'เกลียว'} = ${fmt(col.fyv, 0)} ksc`,
      ],
    },
    {
      label: 'แรงใช้งาน',
      cells: [
        `P = ${fmt(col.P / 1000, 2)} ตัน`,
        `Mx = ${fmt(col.Mx / 1000, 2)} t·m`,
        `My = ${fmt(col.My / 1000, 2)} t·m`,
      ],
    },
    {
      label: 'ผลออกแบบ',
      cells: [
        `อัตราส่วนใช้งาน = ${util} (${METHOD_TH[analysis.method]})`,
        `P ยอมให้ = ${fmt(analysis.curveX.Pmax / 1000, 2)} ตัน`,
        `ρg = ${fmt(analysis.rho * 100)} %, φ = ${analysis.phi}`,
      ],
    },
  ]

  const figures = (
    <>
      <figure>
        <ColumnDrawing
          input={col}
          layout={file.layout}
          denom={denom}
          title={figTitle}
          subtitle={subtitle}
          physicalSize
        />
      </figure>
      <figure>
        <InteractionChart analysis={analysis} P={col.P} />
        <figcaption>แผนภาพ P–M กำลังยอมให้ (0.4φ) และจุดแรงใช้งาน</figcaption>
      </figure>
    </>
  )

  return (
    <ConcreteSheetLayout
      project={project}
      title={title}
      docTitle="เสาคอนกรีตเสริมเหล็ก"
      subtitle={`วิธีหน่วยแรงใช้งาน (WSD) — ${ACI318_WSD_COLUMN.label}`}
      inputRows={inputRows}
      figureTitle="หน้าตัดเสา และแผนภาพ P–M"
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
