import { CalcResultView } from '@/components/CalcResultView'
import { SteelSectionDiagram } from '@/diagrams/SteelSectionDiagram'
import type { SteelColumnResult } from '@/engine/steel/columnASD'
import { fmt, weightDecimals } from '@/engine/shared/units'

export function SteelColumnResultView({ result }: { result: SteelColumnResult }) {
  return (
    <CalcResultView
      overall={result.overall}
      checks={result.checks}
      steps={result.steps}
      warnings={result.warnings}
      diagramTitle="รูปตัดเสาเหล็ก"
      diagram={<SteelSectionDiagram detailing={result.detailing} />}
      summary={
        result.overall === 'pass'
          ? `${result.summary.sectionName} รับแรงได้ ใช้กำลังไป ${fmt(result.summary.maxRatio * 100, 0)}% · น้ำหนัก ${fmt(result.summary.weight, weightDecimals(result.summary.weight))} กก./ม.`
          : undefined
      }
    />
  )
}
