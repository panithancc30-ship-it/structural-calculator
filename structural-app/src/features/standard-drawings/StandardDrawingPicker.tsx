import { useId } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { STANDARD_DRAWINGS, selectedStandardDrawings, toggleStandardDrawing } from './standardDrawings'

interface Props {
  /** รหัสแบบที่เลือกไว้ในโครงการ (โครงการเก่าไม่มีช่องนี้) */
  selected: readonly string[] | undefined
  onChange: (ids: string[]) => void
}

function DrawingOption({
  title,
  description,
  src,
  checked,
  onToggle,
}: {
  title: string
  description: string
  src: string
  checked: boolean
  onToggle: () => void
}) {
  const id = useId()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <label
          htmlFor={id}
          className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-2 pr-4 hover:bg-accent has-[:checked]:border-primary"
        >
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={onToggle}
            className="size-4 shrink-0 accent-primary"
          />
          <img src={src} alt="" className="h-12 w-16 shrink-0 rounded border bg-white object-contain" />
          <span className="text-sm font-medium">{title}</span>
        </label>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{description}</TooltipContent>
    </Tooltip>
  )
}

/** เลือกแบบมาตรฐานที่จะแนบท้ายรูปเล่ม — ไม่เลือกเลยคือไม่แนบ */
export function StandardDrawingPicker({ selected, onChange }: Props) {
  const chosen = new Set(selectedStandardDrawings(selected).map((d) => d.id))
  const count = chosen.size

  return (
    <Card className="no-print mb-5">
      <CardHeader>
        <CardTitle className="text-base">แนบแบบมาตรฐาน</CardTitle>
        <p className="text-sm text-muted-foreground">
          {count === 0
            ? 'ยังไม่แนบ — ติ๊กแบบที่ต้องการเพื่อต่อท้ายรายการคำนวณและใส่ในสารบัญ'
            : `แนบ ${count} หน้า ต่อท้ายรายการคำนวณ`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {STANDARD_DRAWINGS.map((drawing) => (
          <DrawingOption
            key={drawing.id}
            title={drawing.title}
            description={drawing.description}
            src={drawing.src}
            checked={chosen.has(drawing.id)}
            onToggle={() => onChange(toggleStandardDrawing(selected, drawing.id))}
          />
        ))}
      </CardContent>
    </Card>
  )
}
