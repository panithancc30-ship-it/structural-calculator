import type { ReactNode } from 'react'
import { useId } from 'react'
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
  const outOfRange = (min !== undefined && value < min) || (max !== undefined && value > max)

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className={cn(
            'text-right tabular-nums',
            outOfRange && 'border-amber-400 bg-amber-50 focus-visible:ring-amber-400/40',
          )}
        />
        {unit && <span className="w-16 shrink-0 text-sm text-muted-foreground">{unit}</span>}
      </div>
      {outOfRange ? (
        <p className="text-xs text-amber-700">
          ค่าอยู่นอกช่วงปกติ ({min}–{max}) กรุณาตรวจสอบ
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
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
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} className="w-full">
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
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="rounded-lg border bg-card p-4 shadow-xs">
      <legend className="px-1.5 text-sm font-semibold text-foreground">{title}</legend>
      <div className="grid gap-4 pt-1 sm:grid-cols-2">{children}</div>
    </fieldset>
  )
}
