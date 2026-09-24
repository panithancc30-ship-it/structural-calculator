import { useMemo } from 'react'
import { FootingInputPanel } from '@/components/concrete/footing/FootingInputPanel'
import { Card, CardContent } from '@/components/ui/card'
import { footingDims } from '@/engine/concrete/footing/designFooting'
import { validateFootingInput } from '@/engine/concrete/footing/validate'
import { useConcreteDraft } from '@/features/concrete/concreteDraft'
import { toFootingProjectFile, useFootingStore } from '@/state/footingStore'

interface Props {
  value: unknown
  onChange: (next: unknown) => void
}

export function ConcreteFootingForm({ value, onChange }: Props) {
  const error = useConcreteDraft(useFootingStore, value, onChange, toFootingProjectFile)
  const input = useFootingStore((s) => s.input)
  // แผงกรอกข้อมูลแสดงขนาดที่โปรแกรมเลือกให้ เมื่อผู้ใช้ให้หาขนาดอัตโนมัติ
  const dims = useMemo(
    () => (validateFootingInput(input).length === 0 ? footingDims(input) : null),
    [input],
  )

  return (
    <Card>
      <CardContent className="rc-scope">
        {error && <p className="mb-3 text-sm text-destructive">อ่านข้อมูลรายการนี้ไม่ได้: {error}</p>}
        <FootingInputPanel dims={dims} />
      </CardContent>
    </Card>
  )
}
