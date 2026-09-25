import { useMemo } from 'react'
import { Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, NumberField, SelectField, TextField } from '@/components/FormFields'
import { arrangementsFor, type BuiltUpArrangement } from '@/engine/steel/builtUp'
import { STEEL_GRADES } from '@/engine/steel/materials'
import {
  getSection,
  SECTION_CATEGORIES,
  sectionsInCategory,
  type SectionCategory,
} from '@/engine/steel/sectionTable'
import type { HatDims } from '@/engine/steel/geometry'
import type { SectionSelection } from '@/engine/steel/section'
import type { Suggestion } from '@/engine/steel/suggest'
import { fmt, weightDecimals } from '@/engine/shared/units'

interface Props {
  value: SectionSelection
  onChange: (value: SectionSelection) => void
  /** หมวดหน้าตัดที่ใช้ค้นหาหน้าตัดประหยัดสุด */
  suggestCategories: SectionCategory[]
  onSuggestCategoriesChange: (categories: SectionCategory[]) => void
  suggestions: Suggestion[]
  /** จำกัดหมวดหน้าตัดที่เลือกได้ — ไม่ระบุคือทุกหมวด */
  categories?: SectionCategory[]
  /** ชุดหมวดของตัวช่วยแนะนำหน้าตัด — ไม่ระบุคือชุดมาตรฐานของงานคานและเสา */
  suggestGroups?: SuggestGroup[]
}

export interface SuggestGroup {
  label: string
  categories: SectionCategory[]
}

const gradeOptions = [
  ...STEEL_GRADES.map((g) => ({ value: g.id, label: g.label })),
  { value: 'custom', label: 'กำหนดกำลังครากเอง' },
]

/** หมวดที่เลือกได้ในตัวช่วยแนะนำหน้าตัด */
const SUGGEST_GROUPS: SuggestGroup[] = [
  { label: 'เหล็ก H ทุกแบบ', categories: ['h-narrow', 'h-wide'] },
  { label: 'เหล็ก H + รางน้ำ + ตัวซี', categories: ['h-narrow', 'h-wide', 'channel', 'lipped-channel'] },
  { label: 'เหล็กกล่อง + ท่อ', categories: ['square-tube', 'rect-tube', 'pipe'] },
  { label: 'ตัวซี + กล่อง (งานแป)', categories: ['lipped-channel', 'square-tube', 'rect-tube'] },
  { label: 'แปหมวก (รับกระเบื้อง)', categories: ['hat'] },
  {
    label: 'ทุกหมวด',
    categories: [
      'h-narrow',
      'h-wide',
      'i-beam',
      'channel',
      'lipped-channel',
      'square-tube',
      'rect-tube',
      'pipe',
      'angle-equal',
      'hat',
    ],
  },
]

/** มิติแปหมวกที่แก้ไขได้ — แสดงเป็นมิลลิเมตรเพราะเป็นหน่วยที่ผู้ขายใช้ */
const HAT_FIELDS: Array<{ key: keyof HatDims; label: string; step: number; hint?: string }> = [
  { key: 'd', label: 'ความสูง', step: 1 },
  { key: 'bf', label: 'ความกว้างฐานรวมปีก', step: 1 },
  { key: 'crown', label: 'ความกว้างสัน (ผิวนอก)', step: 1 },
  { key: 'webBottom', label: 'ระยะห่างเอวที่ฐาน (ผิวนอก)', step: 1, hint: 'เท่ากับความกว้างสันถ้าเอวตั้งดิ่ง' },
  { key: 'lip', label: 'ขอบพับยกที่ปลายปีก', step: 1, hint: 'ใส่ 0 ถ้าปลายปีกเรียบ' },
  {
    key: 't',
    label: 'ความหนาเหล็ก (ไม่รวมสารเคลือบ)',
    step: 0.05,
    hint: 'ถ้าฉลากระบุความหนารวมสารเคลือบ ให้หักออกราว 0.04 มม.',
  },
]

/** เลือกหน้าตัดใหม่ — ถ้าเป็นแปหมวกให้คัดลอกมิติตั้งต้นมาให้แก้ไขต่อ */
function withSection(value: SectionSelection, sectionId: string): SectionSelection {
  return { ...value, source: 'table', sectionId, hat: getSection(sectionId)?.hatDims }
}

export function SectionPicker({
  value,
  onChange,
  suggestCategories,
  onSuggestCategoriesChange,
  suggestions,
  categories,
  suggestGroups = SUGGEST_GROUPS,
}: Props) {
  const set = <K extends keyof SectionSelection>(key: K, v: SectionSelection[K]) =>
    onChange({ ...value, [key]: v })

  const currentCategory = (value.sectionId.split(':')[0] || 'h-narrow') as SectionCategory
  const sections = useMemo(() => sectionsInCategory(currentCategory), [currentCategory])
  const arrangements = arrangementsFor(currentCategory)

  const categoryOptions = SECTION_CATEGORIES.filter((c) => !categories || categories.includes(c.id))

  const groupIndex = suggestGroups.findIndex(
    (g) => g.categories.join(',') === suggestCategories.join(','),
  )

  const changeCategory = (category: SectionCategory) => {
    const first = sectionsInCategory(category)[0]
    const info = SECTION_CATEGORIES.find((c) => c.id === category)
    const allowed = arrangementsFor(category).map((a) => a.id)
    onChange({
      ...withSection(value, first?.id ?? value.sectionId),
      gradeId: info?.defaultGrade ?? value.gradeId,
      arrangement: allowed.includes(value.arrangement) ? value.arrangement : 'single',
    })
  }

  return (
    <div className="space-y-4">
      <FieldGroup title="หน้าตัดเหล็ก">
        <SelectField
          label="แหล่งที่มาของหน้าตัด"
          value={value.source}
          options={[
            { value: 'table', label: 'เลือกจากเหล็กที่มีขายในไทย' },
            { value: 'custom', label: 'ป้อนคุณสมบัติหน้าตัดเอง' },
          ]}
          onChange={(v) => set('source', v)}
        />
        <SelectField
          label="เกรดเหล็ก"
          value={value.gradeId}
          options={gradeOptions}
          onChange={(v) => set('gradeId', v)}
        />

        {value.gradeId === 'custom' && (
          <NumberField
            label="กำลังคราก, Fy"
            unit="ksc"
            step={100}
            min={2000}
            max={6000}
            value={value.customFy}
            onChange={(v) => set('customFy', v)}
          />
        )}

        {value.source === 'table' && (
          <>
            <SelectField
              label="หมวดหน้าตัด"
              value={currentCategory}
              options={categoryOptions.map((c) => ({ value: c.id, label: c.label }))}
              onChange={(v) => changeCategory(v as SectionCategory)}
            />
            <SelectField
              label="ขนาดหน้าตัด"
              value={value.sectionId}
              options={sections.map((s) => ({ value: s.id, label: s.name }))}
              onChange={(v) => onChange(withSection(value, v))}
            />
            <SelectField
              label="การประกอบหน้าตัด"
              value={value.arrangement}
              options={arrangements.map((a) => ({ value: a.id, label: a.label }))}
              onChange={(v) => set('arrangement', v as BuiltUpArrangement)}
            />
            {value.arrangement !== 'single' && (
              <>
                <NumberField
                  label="ระยะห่างระหว่างสองท่อน"
                  unit="ซม."
                  step={0.5}
                  hint="ปกติคือความหนาแผ่นประกับ ใส่ 0 ถ้าชนกันสนิท"
                  value={value.gap}
                  onChange={(v) => set('gap', v)}
                />
                <NumberField
                  label="ระยะห่างจุดยึดสองท่อน"
                  unit="ซม."
                  step={10}
                  hint="ระยะระหว่างสลักเกลียว/แผ่นประกับ ตามแนวยาวของชิ้นส่วน"
                  value={value.connectorSpacing}
                  onChange={(v) => set('connectorSpacing', v)}
                />
              </>
            )}
          </>
        )}
      </FieldGroup>

      {value.source === 'table' && currentCategory === 'hat' && (
        <FieldGroup title="มิติแปหมวก (มม.) — แก้ให้ตรงกับของที่ใช้จริง">
          {HAT_FIELDS.map(({ key, label, step, hint }) => {
            const dims = value.hat ?? getSection(value.sectionId)?.hatDims
            if (!dims) return null
            return (
              <NumberField
                key={key}
                label={label}
                unit="มม."
                step={step}
                hint={hint}
                value={Number(((dims[key] ?? 0) * 10).toFixed(3))}
                onChange={(v) => set('hat', { ...dims, [key]: v / 10 })}
              />
            )
          })}
          <p className="text-xs text-muted-foreground sm:col-span-2">
            ผู้ขายระบุเพียงความกว้าง ความสูง และความหนา — ความกว้างสัน ระยะเอว และขอบพับในค่าตั้งต้นเป็นค่าสมมติ
          </p>
        </FieldGroup>
      )}

      {value.source === 'custom' && (
        <FieldGroup title="คุณสมบัติหน้าตัดที่ป้อนเอง">
          <TextField
            label="ชื่อหน้าตัด"
            value={value.custom.name}
            onChange={(v) => set('custom', { ...value.custom, name: v })}
          />
          <NumberField
            label="ความลึก, d"
            unit="ซม."
            step={0.5}
            value={value.custom.d}
            onChange={(v) => set('custom', { ...value.custom, d: v })}
          />
          <NumberField
            label="ความกว้าง, bf"
            unit="ซม."
            step={0.5}
            value={value.custom.bf}
            onChange={(v) => set('custom', { ...value.custom, bf: v })}
          />
          <NumberField
            label="ความหนาเอว, tw"
            unit="ซม."
            step={0.1}
            value={value.custom.tw}
            onChange={(v) => set('custom', { ...value.custom, tw: v })}
          />
          <NumberField
            label="ความหนาปีก, tf"
            unit="ซม."
            step={0.1}
            value={value.custom.tf}
            onChange={(v) => set('custom', { ...value.custom, tf: v })}
          />
          <NumberField
            label="พื้นที่หน้าตัด, A"
            unit="ตร.ซม."
            step={1}
            value={value.custom.A}
            onChange={(v) => set('custom', { ...value.custom, A: v })}
          />
          <NumberField
            label="Ix"
            unit="ซม.⁴"
            step={100}
            value={value.custom.Ix}
            onChange={(v) => set('custom', { ...value.custom, Ix: v })}
          />
          <NumberField
            label="Iy"
            unit="ซม.⁴"
            step={10}
            value={value.custom.Iy}
            onChange={(v) => set('custom', { ...value.custom, Iy: v })}
          />
          <NumberField
            label="Sx"
            unit="ซม.³"
            step={10}
            value={value.custom.Sx}
            onChange={(v) => set('custom', { ...value.custom, Sx: v })}
          />
          <NumberField
            label="Sy"
            unit="ซม.³"
            step={5}
            value={value.custom.Sy}
            onChange={(v) => set('custom', { ...value.custom, Sy: v })}
          />
          <SelectField
            label="ชนิดหน้าตัด"
            value={value.custom.closed ? 'closed' : 'open'}
            options={[
              { value: 'open', label: 'หน้าตัดเปิด (I, C, L) — ต้องตรวจ LTB' },
              { value: 'closed', label: 'หน้าตัดปิด (กล่อง, ท่อ) — ไม่ต้องตรวจ LTB' },
            ]}
            onChange={(v) => set('custom', { ...value.custom, closed: v === 'closed' })}
          />
        </FieldGroup>
      )}

      {value.source === 'table' && (
        <FieldGroup title="ตัวช่วยเลือกหน้าตัดที่ประหยัดที่สุด">
          <SelectField
            label="ค้นหาจากหมวด"
            value={String(groupIndex >= 0 ? groupIndex : 0)}
            options={suggestGroups.map((g, i) => ({ value: String(i), label: g.label }))}
            onChange={(v) => onSuggestCategoriesChange(suggestGroups[Number(v)].categories)}
          />
          <div className="sm:col-span-2">
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ไม่มีหน้าตัดในหมวดนี้ที่ผ่านทุกเกณฑ์ — ลองเลือกหมวดอื่น หรือลดแรงกระทำ/เพิ่มจุดค้ำยัน
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  เรียงจากเบาที่สุด — อัตราส่วนกำลังที่ใช้ไปยิ่งใกล้ 1.00 ยิ่งประหยัด กดเพื่อเลือกใช้
                </p>
                <ul className="divide-y rounded-md border">
                  {suggestions.map((s) => (
                    <li key={s.sectionId} className="flex items-center gap-2 px-2 py-1.5">
                      <Button
                        variant={s.sectionId === value.sectionId ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 gap-1.5 px-2"
                        onClick={() => onChange(withSection(value, s.sectionId))}
                      >
                        <Wand2 className="size-3.5" />
                        ใช้
                      </Button>
                      <span className="grow text-sm font-medium">{s.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {fmt(s.weight, weightDecimals(s.weight))} กก./ม. · ใช้กำลัง {fmt(s.maxRatio * 100, 0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </FieldGroup>
      )}
    </div>
  )
}
