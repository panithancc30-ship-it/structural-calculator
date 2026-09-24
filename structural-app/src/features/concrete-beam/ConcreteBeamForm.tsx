import { InputPanel } from '@/components/concrete/InputPanel/InputPanel'
import { Card, CardContent } from '@/components/ui/card'
import { useConcreteDraft } from '@/features/concrete/concreteDraft'
import { toProjectFile, useStore } from '@/state/store'

interface Props {
  value: unknown
  onChange: (next: unknown) => void
}

export function ConcreteBeamForm({ value, onChange }: Props) {
  const error = useConcreteDraft(useStore, value, onChange, toProjectFile)

  return (
    <Card>
      <CardContent className="rc-scope">
        {error && <p className="mb-3 text-sm text-destructive">อ่านข้อมูลรายการนี้ไม่ได้: {error}</p>}
        <InputPanel />
      </CardContent>
    </Card>
  )
}
