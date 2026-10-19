import { useMemo } from 'react'
import { PileCapInputPanel } from '@/components/concrete/pilecap/PileCapInputPanel'
import { Card, CardContent } from '@/components/ui/card'
import { pileCapDesign } from '@/engine/concrete/pilecap/designPileCap'
import { pileLayout } from '@/engine/concrete/pilecap/piles'
import { validatePileCapInput } from '@/engine/concrete/pilecap/validate'
import { useConcreteDraft } from '@/features/concrete/concreteDraft'
import { toPileCapProjectFile, usePileCapStore } from '@/state/pileCapStore'

interface Props {
  value: unknown
  onChange: (next: unknown) => void
}

export function ConcretePileCapForm({ value, onChange }: Props) {
  const error = useConcreteDraft(usePileCapStore, value, onChange, toPileCapProjectFile)
  const input = usePileCapStore((s) => s.input)
  // แผงกรอกข้อมูลแสดงจำนวนเข็ม ขนาดแปลน และความหนาที่โปรแกรมเลือกให้ เมื่อผู้ใช้ให้หาอัตโนมัติ
  const design = useMemo(() => {
    if (validatePileCapInput(input).length > 0) return null
    const d = pileCapDesign(input)
    return { ...d, ...pileLayout(input, d.arrangement).dims }
  }, [input])

  return (
    <Card>
      <CardContent className="rc-scope">
        {error && <p className="mb-3 text-sm text-destructive">อ่านข้อมูลรายการนี้ไม่ได้: {error}</p>}
        <PileCapInputPanel design={design} />
      </CardContent>
    </Card>
  )
}
