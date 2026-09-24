import { useMemo, useState } from 'react'
import { FieldGroup, NumberField, SelectField } from '@/components/FormFields'
import { SectionPicker } from '@/components/SectionPicker'
import { K_FACTOR_CASES, type SteelColumnInput } from '@/engine/steel/columnASD'
import { suggestColumnSections } from '@/engine/steel/suggest'
import type { SectionCategory } from '@/engine/steel/sectionTable'
import { DEFAULT_COLUMN_SUGGEST_CATEGORIES } from './steelColumnDefaults'

interface Props {
  value: SteelColumnInput
  onChange: (value: SteelColumnInput) => void
}

const kOptions = K_FACTOR_CASES.map((c) => ({
  value: c.id,
  label: `K = ${c.K.toFixed(2)} — ${c.label}`,
}))

/** หาเคส K ที่ตรงกับค่าปัจจุบัน เพื่อให้ตัวเลือกแสดงสถานะถูกต้อง */
function caseIdFor(K: number): string {
  return K_FACTOR_CASES.find((c) => c.id !== 'custom' && Math.abs(c.K - K) < 0.001)?.id ?? 'custom'
}

export function SteelColumnForm({ value, onChange }: Props) {
  const [suggestCategories, setSuggestCategories] = useState<SectionCategory[]>(
    DEFAULT_COLUMN_SUGGEST_CATEGORIES,
  )

  const set = <K extends keyof SteelColumnInput>(key: K, v: SteelColumnInput[K]) =>
    onChange({ ...value, [key]: v })

  const suggestions = useMemo(
    () => suggestColumnSections(value, suggestCategories),
    [value, suggestCategories],
  )

  const applyK = (axis: 'Kx' | 'Ky', caseId: string) => {
    const found = K_FACTOR_CASES.find((c) => c.id === caseId)
    if (!found || found.id === 'custom') return
    const sway = found.sway
    onChange({
      ...value,
      [axis]: found.K,
      // โครงที่เซทางข้างได้ใช้ Cm = 0.85 ตาม AISC H1
      ...(axis === 'Kx' ? { Cmx: sway ? 0.85 : 0.6 } : { Cmy: sway ? 0.85 : 0.6 }),
    })
  }

  return (
    <div className="space-y-4">
      <FieldGroup title="แรงกระทำ (ผู้ใช้คำนวณมาแล้ว)">
        <NumberField
          label="แรงตามแกน, P"
          unit="กก."
          step={1000}
          hint="บวก = แรงอัด, ลบ = แรงดึง"
          value={value.axial}
          onChange={(v) => set('axial', v)}
        />
        <NumberField
          label="แรงเฉือน, V"
          unit="กก."
          step={100}
          value={value.shear}
          onChange={(v) => set('shear', v)}
        />
        <NumberField
          label="โมเมนต์รอบแกนแข็ง, Mx"
          unit="กก.-ม."
          step={100}
          value={value.momentX}
          onChange={(v) => set('momentX', v)}
        />
        <NumberField
          label="โมเมนต์รอบแกนอ่อน, My"
          unit="กก.-ม."
          step={100}
          value={value.momentY}
          onChange={(v) => set('momentY', v)}
        />
      </FieldGroup>

      <FieldGroup title="ความยาวและสภาพปลายเสา">
        <NumberField
          label="ความยาวไร้การค้ำยัน รอบแกนแข็ง, Lx"
          unit="ม."
          step={0.25}
          value={value.lengthX}
          onChange={(v) => set('lengthX', v)}
        />
        <NumberField
          label="ความยาวไร้การค้ำยัน รอบแกนอ่อน, Ly"
          unit="ม."
          step={0.25}
          hint="ถ้ามีคานยึดกลางความสูงเฉพาะแกนอ่อน ให้ใส่ระยะที่สั้นลง"
          value={value.lengthY}
          onChange={(v) => set('lengthY', v)}
        />
        <SelectField
          label="สภาพปลายเสา รอบแกนแข็ง"
          value={caseIdFor(value.Kx)}
          options={kOptions}
          onChange={(v) => applyK('Kx', v)}
        />
        <SelectField
          label="สภาพปลายเสา รอบแกนอ่อน"
          value={caseIdFor(value.Ky)}
          options={kOptions}
          onChange={(v) => applyK('Ky', v)}
        />
        <NumberField
          label="Kx (แก้ค่าเองได้)"
          unit="-"
          step={0.05}
          min={0.5}
          max={3}
          value={value.Kx}
          onChange={(v) => set('Kx', v)}
        />
        <NumberField
          label="Ky (แก้ค่าเองได้)"
          unit="-"
          step={0.05}
          min={0.5}
          max={3}
          value={value.Ky}
          onChange={(v) => set('Ky', v)}
        />
      </FieldGroup>

      <FieldGroup title="สัมประสิทธิ์สำหรับสมการแรงร่วม">
        <NumberField
          label="Cmx"
          unit="-"
          step={0.05}
          min={0.4}
          max={1}
          hint="0.85 สำหรับโครงที่เซทางข้างได้ · 0.6−0.4(M1/M2) สำหรับโครงที่ยึดไม่ให้เซ"
          value={value.Cmx}
          onChange={(v) => set('Cmx', v)}
        />
        <NumberField
          label="Cmy"
          unit="-"
          step={0.05}
          min={0.4}
          max={1}
          value={value.Cmy}
          onChange={(v) => set('Cmy', v)}
        />
        <NumberField
          label="Cb"
          unit="-"
          step={0.05}
          min={1}
          max={2.3}
          hint="ใช้กับการโก่งเดาะด้านข้างจากโมเมนต์ · 1.00 คือค่าปลอดภัย"
          value={value.Cb}
          onChange={(v) => set('Cb', v)}
        />
      </FieldGroup>

      <SectionPicker
        value={value.section}
        onChange={(section) => set('section', section)}
        suggestCategories={suggestCategories}
        onSuggestCategoriesChange={setSuggestCategories}
        suggestions={suggestions}
      />
    </div>
  )
}
