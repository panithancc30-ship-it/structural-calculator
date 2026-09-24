import { ColumnInputPanel } from '@/components/concrete/column/ColumnInputPanel'
import { Card, CardContent } from '@/components/ui/card'
import { useConcreteDraft } from '@/features/concrete/concreteDraft'
import { toColumnProjectFile, useColumnStore } from '@/state/columnStore'

interface Props {
  value: unknown
  onChange: (next: unknown) => void
}

export function ConcreteColumnForm({ value, onChange }: Props) {
  const error = useConcreteDraft(useColumnStore, value, onChange, toColumnProjectFile)

  return (
    <Card>
      <CardContent className="rc-scope">
        {error && <p className="mb-3 text-sm text-destructive">อ่านข้อมูลรายการนี้ไม่ได้: {error}</p>}
        <ColumnInputPanel />
      </CardContent>
    </Card>
  )
}
