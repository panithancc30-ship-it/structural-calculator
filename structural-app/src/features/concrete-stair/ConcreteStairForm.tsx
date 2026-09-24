import { useMemo } from 'react'
import { StairInputPanel } from '@/components/concrete/stair/StairInputPanel'
import { Card, CardContent } from '@/components/ui/card'
import { stairDims } from '@/engine/concrete/stair/designStair'
import { validateStairInput } from '@/engine/concrete/stair/validate'
import { useConcreteDraft } from '@/features/concrete/concreteDraft'
import { toStairProjectFile, useStairStore } from '@/state/stairStore'

interface Props {
  value: unknown
  onChange: (next: unknown) => void
}

export function ConcreteStairForm({ value, onChange }: Props) {
  const error = useConcreteDraft(useStairStore, value, onChange, toStairProjectFile)
  const input = useStairStore((s) => s.input)
  // แผงกรอกข้อมูลแสดงความหนาที่โปรแกรมเลือกให้ เมื่อผู้ใช้ให้หาอัตโนมัติ
  const dims = useMemo(() => (validateStairInput(input).length === 0 ? stairDims(input) : null), [input])

  return (
    <Card>
      <CardContent className="rc-scope">
        {error && <p className="mb-3 text-sm text-destructive">อ่านข้อมูลรายการนี้ไม่ได้: {error}</p>}
        <StairInputPanel dims={dims} />
      </CardContent>
    </Card>
  )
}
