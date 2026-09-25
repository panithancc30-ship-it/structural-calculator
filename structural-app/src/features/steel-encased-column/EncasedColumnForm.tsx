import { useMemo, useState } from 'react'
import { Ruler } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FieldGroup, NumberField } from '@/components/FormFields'
import { SectionPicker } from '@/components/SectionPicker'
import { ENCASED_RULES, minimumEncasement, type EncasedColumnInput } from '@/engine/steel/encasedColumn'
import { resolveSection } from '@/engine/steel/section'
import type { SectionCategory } from '@/engine/steel/sectionTable'
import { suggestEncasedColumnSections } from '@/engine/steel/suggest'
import {
  DEFAULT_ENCASED_SUGGEST_CATEGORIES,
  ENCASED_SECTION_CATEGORIES,
  ENCASED_SUGGEST_GROUPS,
} from './encasedColumnDefaults'

interface Props {
  value: EncasedColumnInput
  onChange: (value: EncasedColumnInput) => void
}

export function EncasedColumnForm({ value, onChange }: Props) {
  const [suggestCategories, setSuggestCategories] = useState<SectionCategory[]>(
    DEFAULT_ENCASED_SUGGEST_CATEGORIES,
  )

  const set = <K extends keyof EncasedColumnInput>(key: K, v: EncasedColumnInput[K]) =>
    onChange({ ...value, [key]: v })

  const suggestions = useMemo(
    () => suggestEncasedColumnSections(value, suggestCategories),
    [value, suggestCategories],
  )

  const steel = useMemo(() => resolveSection(value.section).props, [value.section])
  const minSize = minimumEncasement(steel.bf, steel.d)
  const fitsAlready = value.width === minSize.width && value.depth === minSize.depth

  return (
    <div className="space-y-4">
      <FieldGroup title="แรงกระทำ (ผู้ใช้คำนวณมาแล้ว)">
        <NumberField
          label="แรงอัดตามแนวแกน, P"
          unit="กก."
          step={1000}
          min={0}
          hint="แรงใช้งาน รวมน้ำหนักเสาเอง — สูตรนี้ไม่รวมโมเมนต์ดัด"
          value={value.axial}
          onChange={(v) => set('axial', v)}
        />
        <NumberField
          label="ความสูงเสา, h"
          unit="ม."
          step={0.25}
          hint="ความยาวไร้การค้ำยัน — เสายื่นหรือโครงที่เซได้ ให้ใส่ความยาวประสิทธิผล"
          value={value.height}
          onChange={(v) => set('height', v)}
        />
      </FieldGroup>

      <FieldGroup title="คอนกรีตหุ้ม">
        <NumberField
          label="ด้านกว้าง, b (ขนานปีกเหล็ก)"
          unit="ซม."
          step={5}
          min={ENCASED_RULES.minDimension}
          value={value.width}
          onChange={(v) => set('width', v)}
        />
        <NumberField
          label="ด้านลึก, t (ขนานเอวเหล็ก)"
          unit="ซม."
          step={5}
          min={ENCASED_RULES.minDimension}
          value={value.depth}
          onChange={(v) => set('depth', v)}
        />
        <div className="space-y-1.5 sm:col-span-2">
          <Button
            variant="outline"
            size="sm"
            disabled={fitsAlready}
            onClick={() => onChange({ ...value, width: minSize.width, depth: minSize.depth })}
          >
            <Ruler className="size-4" />
            ใช้ขนาดเสาเล็กสุดที่หุ้มเหล็กได้ ({minSize.width} × {minSize.depth} ซม.)
          </Button>
          <p className="text-xs text-muted-foreground">
            คอนกรีตหุ้มหนา ≥ {ENCASED_RULES.minCover} ซม. ทุกด้าน ปัดขึ้นทีละ 5 ซม. — เสาที่ใหญ่ขึ้นรับแรงได้มากขึ้น
          </p>
        </div>
        <NumberField
          label="กำลังอัดคอนกรีต, f′c"
          unit="ksc"
          step={10}
          min={ENCASED_RULES.minFc}
          max={400}
          value={value.fc}
          onChange={(v) => set('fc', v)}
        />
      </FieldGroup>

      <FieldGroup title={`${ENCASED_RULES.mesh.label} หุ้มรอบเหล็ก`}>
        <NumberField
          label="ระยะเรียงลวดที่พันรอบเสา"
          unit="ซม."
          step={2.5}
          hint={`ไม่เกิน ${ENCASED_RULES.mesh.maxHoopSpacing} ซม.`}
          value={value.meshHoopSpacing}
          onChange={(v) => set('meshHoopSpacing', v)}
        />
        <NumberField
          label="ระยะเรียงลวดตามแนวยาวเสา"
          unit="ซม."
          step={2.5}
          hint={`ไม่เกิน ${ENCASED_RULES.mesh.maxVerticalSpacing} ซม.`}
          value={value.meshVerticalSpacing}
          onChange={(v) => set('meshVerticalSpacing', v)}
        />
      </FieldGroup>

      <SectionPicker
        value={value.section}
        onChange={(section) => set('section', section)}
        suggestCategories={suggestCategories}
        onSuggestCategoriesChange={setSuggestCategories}
        suggestions={suggestions}
        categories={ENCASED_SECTION_CATEGORIES}
        suggestGroups={ENCASED_SUGGEST_GROUPS}
      />
    </div>
  )
}
