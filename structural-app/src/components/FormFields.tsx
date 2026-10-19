import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import { Info } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface NumberFieldProps {
  label: string
  value: number
  unit?: string
  step?: number
  min?: number
  max?: number
  hint?: string
  onChange: (value: number) => void
}

export function NumberField({ label, value, unit, step = 1, min, max, hint, onChange }: NumberFieldProps) {
  const id = useId()
  const [showHint, setShowHint] = useState(false)
  const outOfRange = (min !== undefined && value < min) || (max !== undefined && value > max)

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {/* คำอธิบายพับไว้ แตะ ⓘ เพื่อดู — ฟอร์มจึงสั้นพออยู่ในจอเดียวกับผล */}
        {hint && (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`คำอธิบาย ${label}`}
            aria-expanded={showHint}
            title={hint}
            onClick={() => setShowHint((v) => !v)}
          >
            <Info className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className={cn(
            'h-7 text-right tabular-nums',
            outOfRange && 'border-amber-400 bg-amber-50 focus-visible:ring-amber-400/40',
          )}
        />
        {unit && <span className="w-12 shrink-0 text-xs text-muted-foreground">{unit}</span>}
      </div>
      {outOfRange ? (
        <p className="text-xs text-amber-700">
          ค่าอยู่นอกช่วงปกติ ({min}–{max}) กรุณาตรวจสอบ
        </p>
      ) : (
        hint && showHint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

interface SelectFieldProps<T extends string> {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}

export function SelectField<T extends string>({ label, value, options, onChange }: SelectFieldProps<T>) {
  const id = useId()

  return (
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'date'
}) {
  const id = useId()

  return (
    <div className="space-y-0.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        className="h-7"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border bg-card px-3 pt-0.5 pb-2.5 shadow-xs">
      <legend className="px-1.5 text-sm font-semibold text-foreground">{title}</legend>
      {/* ช่องกรอกเรียง 2–4 ช่องต่อแถวตามความกว้าง ให้ข้อมูลนำเข้าอยู่ในจอเดียวกับผล */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(165px,1fr))] gap-x-3 gap-y-1.5">{children}</div>
    </fieldset>
  )
}
