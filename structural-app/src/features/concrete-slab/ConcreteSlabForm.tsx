import { useMemo } from 'react'
import { SlabInputPanel } from '@/components/concrete/slab/SlabInputPanel'
import { Card, CardContent } from '@/components/ui/card'
import { slabDims } from '@/engine/concrete/slab/designSlab'
import { validateSlabInput } from '@/engine/concrete/slab/validate'
import { useConcreteDraft } from '@/features/concrete/concreteDraft'
import { toSlabProjectFile, useSlabStore } from '@/state/slabStore'

interface Props {
  value: unknown
  onChange: (next: unknown) => void
}

export function ConcreteSlabForm({ value, onChange }: Props) {
  const error = useConcreteDraft(useSlabStore, value, onChange, toSlabProjectFile)
  const input = useSlabStore((s) => s.input)
  // แผงกรอกข้อมูลแสดงความหนาที่โปรแกรมเลือกให้ เมื่อผู้ใช้ให้หาอัตโนมัติ
  const dims = useMemo(() => (validateSlabInput(input).length === 0 ? slabDims(input) : null), [input])

  return (
    <Card>
      <CardContent className="rc-scope">
        {error && <p className="mb-3 text-sm text-destructive">อ่านข้อมูลรายการนี้ไม่ได้: {error}</p>}
        <SlabInputPanel dims={dims} />
      </CardContent>
    </Card>
  )
}
