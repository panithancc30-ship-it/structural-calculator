import { CalcResultView } from '@/components/CalcResultView'
import { EncasedColumnDiagram } from '@/diagrams/EncasedColumnDiagram'
import type { EncasedColumnResult } from '@/engine/steel/encasedColumn'
import { fmt, weightDecimals } from '@/engine/shared/units'

export function EncasedColumnResultView({ result }: { result: EncasedColumnResult }) {
  const { summary } = result
  return (
    <CalcResultView
      overall={result.overall}
      checks={result.checks}
      steps={result.steps}
      warnings={result.warnings}
      diagramTitle="รูปตัดเสาเหล็กหุ้มคอนกรีต"
      diagram={<EncasedColumnDiagram detailing={result.detailing} encasement={result.encasement} />}
      summary={
        result.overall === 'pass'
          ? `${summary.sectionName} หุ้มคอนกรีต ${result.encasement.width} × ${result.encasement.depth} ซม. ` +
            `รับได้ ${fmt(summary.capacity, 0)} กก. ใช้กำลังไป ${fmt(summary.maxRatio * 100, 0)}% · ` +
            `เหล็กหนัก ${fmt(summary.weight, weightDecimals(summary.weight))} กก./ม.`
          : undefined
      }
    />
  )
}
