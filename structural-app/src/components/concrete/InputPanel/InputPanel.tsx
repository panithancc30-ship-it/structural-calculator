import { MAIN_BAR_SIZES, STEEL_GRADES, STIRRUP_BAR_SIZES } from '@/engine/concrete/rebar';
import type { BeamInput, StirrupMode, SupportCondition } from '@/engine/concrete/types';
import { useStore } from '@/state/store';
import { BarSelect, NumberField, SteelField } from '../form/Fields';
import { SUPPORT_TH } from '../labels';

const STIRRUP_MODES: { value: StirrupMode; label: string }[] = [
  { value: 'auto', label: 'อัตโนมัติ' },
  { value: 'single', label: '1 ปลอก' },
  { value: 'double', label: '2 ปลอก' },
];

type NumericKey = { [K in keyof BeamInput]: BeamInput[K] extends number ? K : never }[keyof BeamInput];

export function InputPanel() {
  const input = useStore((s) => s.input);
  const setInput = useStore((s) => s.setInput);
  const num = (key: NumericKey) => ({
    value: input[key],
    onChange: (v: number) => setInput({ [key]: v } as Partial<BeamInput>),
  });

  return (
    <div className="input-panel">
      <fieldset>
        <legend>ขนาดคาน</legend>
        <div className="grid2">
          <NumberField label="กว้าง b" unit="ซม." {...num('b')} />
          <NumberField label="ลึก h" unit="ซม." {...num('h')} />
          <NumberField label="ช่วงคาน L" unit="ม." step={0.1} {...num('L')} />
          <NumberField label="ระยะหุ้ม covering" unit="ซม." step={0.5} {...num('cover')} />
          <label className="field span2">
            <span className="field-label">สภาพรองรับ (ตรวจความลึกขั้นต่ำ)</span>
            <select value={input.support} onChange={(e) => setInput({ support: e.target.value as SupportCondition })}>
              {(Object.keys(SUPPORT_TH) as SupportCondition[]).map((k) => (
                <option key={k} value={k}>
                  {SUPPORT_TH[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>วัสดุ</legend>
        <div className="stack">
          <NumberField label="กำลังอัดคอนกรีต f′c (ทรงกระบอก)" unit="ksc" step={10} {...num('fc')} />
          <SteelField
            label="fy เหล็กยืน"
            value={input.fy}
            grades={STEEL_GRADES.filter((g) => g.kind === 'DB')}
            onChange={(fy) => setInput({ fy })}
          />
          <SteelField label="fy เหล็กปลอก" value={input.fyv} grades={STEEL_GRADES} onChange={(fyv) => setInput({ fyv })} />
        </div>
      </fieldset>

      <fieldset>
        <legend>แรงภายใน</legend>
        <div className="stack">
          <NumberField
            label="โมเมนต์ดัด M"
            unit="kg·m"
            step={100}
            hint="ใช้ค่าเดียวออกแบบทั้ง M+ (กลางคาน A-A) และ M− (ใกล้เสา B-B)"
            {...num('M')}
          />
          <div className="grid2">
            <NumberField label="แรงเฉือน V" unit="kg" step={100} {...num('V')} />
            <NumberField label="แรงบิด T" unit="kg·m" step={50} {...num('T')} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend>เหล็กเสริม</legend>
        <div className="grid2">
          <BarSelect label="เหล็กยืน" value={input.mainBar} sizes={MAIN_BAR_SIZES} onChange={(mainBar) => setInput({ mainBar })} />
          <BarSelect
            label="เหล็กปลอก"
            value={input.stirrupBar}
            sizes={STIRRUP_BAR_SIZES}
            onChange={(stirrupBar) => setInput({ stirrupBar })}
          />
          <div className="field span2">
            <span className="field-label">รูปแบบเหล็กปลอก</span>
            <div className="seg" role="group" aria-label="รูปแบบเหล็กปลอก">
              {STIRRUP_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={input.stirrupMode === mode.value ? 'active' : ''}
                  aria-pressed={input.stirrupMode === mode.value}
                  onClick={() => setInput({ stirrupMode: mode.value })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <span className="field-hint">
              อัตโนมัติ: ใช้ 1 ปลอกก่อน ถ้าระยะแคบกว่าค่าต่ำสุดจึงใช้ 2 ปลอก (ปลอกนอก + ปลอกใน ขนาดและระยะเดียวกัน)
            </span>
          </div>
          <NumberField label="ระยะปลอกต่ำสุดที่ยอมรับ" unit="ซม." step={2.5} {...num('sMin')} />
        </div>
      </fieldset>
    </div>
  );
}
