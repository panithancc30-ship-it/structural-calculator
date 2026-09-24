import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldGroup, NumberField, SelectField } from '@/components/FormFields'
import { SectionPicker } from '@/components/SectionPicker'
import {
  DEFLECTION_PATTERNS,
  SAG_ROD_OPTIONS,
  type SteelBeamInput,
} from '@/engine/steel/beamASD'
import { suggestBeamSections } from '@/engine/steel/suggest'
import type { SectionCategory } from '@/engine/steel/sectionTable'
import { BEAM_PRESETS, DEFAULT_SUGGEST_CATEGORIES } from './steelBeamDefaults'

interface Props {
  value: SteelBeamInput
  onChange: (value: SteelBeamInput) => void
}

const DEFLECTION_LIMITS = [
  { value: '360', label: 'L/360 — พื้นที่ใช้สอย มีฝ้าฉาบเรียบ' },
  { value: '240', label: 'L/240 — คานทั่วไป (นิยมใช้)' },
  { value: '200', label: 'L/200 — แปและจันทันหลังคา' },
  { value: '150', label: 'L/150 — หลังคาโรงงาน ไม่มีฝ้า' },
]

export function SteelBeamForm({ value, onChange }: Props) {
  const [suggestCategories, setSuggestCategories] = useState<SectionCategory[]>(
    DEFAULT_SUGGEST_CATEGORIES,
  )

  const set = <K extends keyof SteelBeamInput>(key: K, v: SteelBeamInput[K]) =>
    onChange({ ...value, [key]: v })

  const suggestions = useMemo(
    () => suggestBeamSections(value, suggestCategories),
    [value, suggestCategories],
  )

  const tilted = Math.abs(value.sectionAngle) > 0.01

  return (
    <div className="space-y-4">
      <FieldGroup title="รูปแบบชิ้นส่วน (กดเพื่อตั้งมุมให้อัตโนมัติ)">
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {BEAM_PRESETS.map((preset) => {
            const isHat = value.section.sectionId.startsWith('hat:')
            const active =
              Math.abs(value.memberAngle - (preset.patch.memberAngle ?? 0)) < 0.01 &&
              Math.abs(value.sectionAngle - (preset.patch.sectionAngle ?? 0)) < 0.01 &&
              isHat === Boolean(preset.patch.section)
            return (
              <Button
                key={preset.id}
                variant={active ? 'secondary' : 'outline'}
                size="sm"
                title={preset.description}
                aria-label={preset.label}
                onClick={() => {
                  onChange({ ...value, ...preset.patch })
                  if (preset.patch.section?.sectionId.startsWith('hat:')) setSuggestCategories(['hat'])
                }}
              >
                {preset.label}
              </Button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          แป จันทัน และคาน เป็นชิ้นส่วนชนิดเดียวกัน ต่างกันแค่มุมสองตัวด้านล่าง ปรับเองได้อิสระ
        </p>
      </FieldGroup>

      <FieldGroup title="แรงกระทำ (ผู้ใช้คำนวณมาแล้ว)">
        <NumberField
          label="โมเมนต์ดัดใช้งาน, M"
          unit="กก.-ม."
          step={100}
          hint="โมเมนต์จากน้ำหนักบรรทุกในแนวดิ่ง โปรแกรมจะแตกเข้าสองแกนตามมุมหน้าตัดให้ · ใส่ค่าติดลบเพื่อตรวจกรณีแรงลมยก"
          value={value.moment}
          onChange={(v) => set('moment', v)}
        />
        <NumberField
          label="แรงเฉือนใช้งาน, V"
          unit="กก."
          step={100}
          value={value.shear}
          onChange={(v) => set('shear', v)}
        />
        <NumberField
          label="แรงตามแกน, P"
          unit="กก."
          step={100}
          hint="บวก = แรงอัด, ลบ = แรงดึง, 0 = ไม่มี · จันทันมักมีแรงอัด ≈ แรงลัพธ์ × sin θm"
          value={value.axial}
          onChange={(v) => set('axial', v)}
        />
      </FieldGroup>

      <FieldGroup title="มุมเอียง — หัวใจของงานหลังคา">
        <NumberField
          label="θm — มุมเอียงของชิ้นส่วน"
          unit="องศา"
          step={1}
          min={0}
          max={60}
          hint="แกนของชิ้นส่วนเทียบแนวราบ · จันทัน = ความชันหลังคา · แปและคานราบ = 0"
          value={value.memberAngle}
          onChange={(v) => set('memberAngle', v)}
        />
        <NumberField
          label="θs — มุมเอียงของหน้าตัด"
          unit="องศา"
          step={1}
          min={0}
          max={60}
          hint="หน้าตัดหมุนรอบแกนคาน · แปที่วางขวางแนวลาด = ความชันหลังคา → เกิดการดัดสองแกน · จันทันใช้ 0"
          value={value.sectionAngle}
          onChange={(v) => set('sectionAngle', v)}
        />
        <NumberField
          label="ช่วงคาน, L"
          unit="ม."
          step={0.1}
          value={value.span}
          onChange={(v) => set('span', v)}
        />
        <SelectField
          label="ช่วงที่ป้อนวัดอย่างไร"
          value={value.spanBasis}
          options={[
            { value: 'slope', label: 'วัดตามความลาด (ความยาวจริงของชิ้นส่วน)' },
            { value: 'horizontal', label: 'วัดตามแนวราบ (โปรแกรมหารด้วย cos θm ให้)' },
          ]}
          onChange={(v) => set('spanBasis', v)}
        />
        {tilted && (
          <SelectField
            label="เหล็กยึดทางข้าง (sag rod)"
            value={value.sagRods}
            options={SAG_ROD_OPTIONS.map((s) => ({
              value: s.id,
              label: `${s.label} — ลดโมเมนต์แกนอ่อนเหลือ ${(s.momentFactor * 100).toFixed(0)}%`,
            }))}
            onChange={(v) => set('sagRods', v)}
          />
        )}
      </FieldGroup>

      <FieldGroup title="การค้ำยันและการโก่งตัว">
        <NumberField
          label="ความยาวที่ปีกอัดไม่มีการค้ำยัน, Lb"
          unit="ม."
          step={0.25}
          hint="ระยะระหว่างจุดที่ยึดปีกอัดไม่ให้เคลื่อนด้านข้าง ยิ่งยาวยิ่งลดกำลัง · แปที่ยึดแผ่นหลังคากับปีกบนด้วยสกรู ใช้ระยะห่างสกรูได้ (เฉพาะกรณีแรงกดลง)"
          value={value.unbracedLength}
          onChange={(v) => set('unbracedLength', v)}
        />
        <NumberField
          label="สัมประสิทธิ์รูปแบบโมเมนต์, Cb"
          unit="-"
          step={0.05}
          min={1}
          max={2.3}
          hint="1.00 คือค่าปลอดภัยที่ใช้ได้เสมอ"
          value={value.Cb}
          onChange={(v) => set('Cb', v)}
        />
        <SelectField
          label="รูปแบบแรงสำหรับคำนวณการโก่งตัว"
          value={value.deflectionPattern}
          options={DEFLECTION_PATTERNS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(v) => set('deflectionPattern', v)}
        />
        <SelectField
          label="เกณฑ์การโก่งตัวที่ยอมให้"
          value={String(value.deflectionLimit)}
          options={DEFLECTION_LIMITS}
          onChange={(v) => set('deflectionLimit', Number(v))}
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
