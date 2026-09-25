import { useMemo } from 'react'
import { LedgeInputPanel } from '@/components/concrete/ledge/LedgeInputPanel'
import { Card, CardContent } from '@/components/ui/card'
import { ledgeLoads } from '@/engine/concrete/ledge/loads'
import { validateLedgeInput } from '@/engine/concrete/ledge/validate'
import { useConcreteDraft } from '@/features/concrete/concreteDraft'
import { toLedgeProjectFile, useLedgeStore } from '@/state/ledgeStore'

interface Props {
  value: unknown
  onChange: (next: unknown) => void
}

export function ConcreteLedgeBeamForm({ value, onChange }: Props) {
  const error = useConcreteDraft(useLedgeStore, value, onChange, toLedgeProjectFile)
  const input = useLedgeStore((s) => s.input)
  // แผงกรอกข้อมูลแสดงน้ำหนักลงคานและแรงบิดที่คิดได้ทันที
  const loads = useMemo(() => (validateLedgeInput(input).length === 0 ? ledgeLoads(input) : null), [input])

  return (
    <Card>
      <CardContent className="rc-scope">
        {error && <p className="mb-3 text-sm text-destructive">อ่านข้อมูลรายการนี้ไม่ได้: {error}</p>}
        <LedgeInputPanel loads={loads} />
      </CardContent>
    </Card>
  )
}
