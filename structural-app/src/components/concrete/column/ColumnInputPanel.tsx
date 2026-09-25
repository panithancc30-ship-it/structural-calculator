import { ACI318_WSD_COLUMN as K } from '@/engine/concrete/codes/aci318Wsd';
import type { ColumnInput, ColumnShape } from '@/engine/concrete/column/types';
import { MAIN_BAR_SIZES, STEEL_GRADES, STIRRUP_BAR_SIZES } from '@/engine/concrete/rebar';
import { useColumnStore } from '@/state/columnStore';
import { BarSelect, NumberField, Segmented, SteelField } from '../form/Fields';

type NumericKey = { [K in keyof ColumnInput]: ColumnInput[K] extends number ? K : never }[keyof ColumnInput];

export function ColumnInputPanel() {
  const input = useColumnStore((s) => s.input);
  const setInput = useColumnStore((s) => s.setInput);
  const num = (key: NumericKey) => ({
    value: input[key],
    onChange: (v: number) => setInput({ [key]: v } as Partial<ColumnInput>),
  });

  return (
    <div className="input-panel">
      <fieldset>
        <legend>หน้าตัดเสา</legend>
        <div className="grid2">
          <Segmented<ColumnShape>
            label="ชนิดเสา"
            value={input.shape}
            options={[
              { value: 'rect', label: 'สี่เหลี่ยม ปลอกเดี่ยว' },
              { value: 'circle', label: 'กลม ปลอกเกลียว' },
            ]}
            onChange={(shape) => setInput({ shape })}
          />
          {input.shape === 'rect' ? (
            <>
              <NumberField label="ด้าน b (แนวแกน x)" unit="ซม." {...num('b')} />
              <NumberField label="ด้าน h (แนวแกน y)" unit="ซม." {...num('h')} />
            </>
          ) : (
            <NumberField label="เส้นผ่านศูนย์กลาง D" unit="ซม." {...num('D')} />
          )}
          <NumberField label="ระยะหุ้ม covering" unit="ซม." step={0.5} {...num('cover')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>ความชะลูด</legend>
        <NumberField
          label="ความสูงเสา Lu (ช่วงที่ไม่มีคาน/พื้นยึด)"
          unit="ม."
          step={0.1}
          hint={`เสายาวลดกำลังด้วย R = ${K.longColumnRA} − ${K.longColumnRB}·Lu/r (มาตรฐาน วสท. เสาที่มีคานและพื้นยึด)`}
          {...num('Lu')}
        />
      </fieldset>

      <fieldset>
        <legend>วัสดุ</legend>
        <div className="stack">
          <NumberField label="กำลังอัดคอนกรีต f′c (ทรงกระบอก)" unit="ksc" step={10} {...num('fc')} />
          <SteelField label="fy เหล็กยืน" value={input.fy} grades={STEEL_GRADES.filter((g) => g.kind === 'DB')} onChange={(fy) => setInput({ fy })} />
          <SteelField label="fy เหล็กปลอก" value={input.fyv} grades={STEEL_GRADES} onChange={(fyv) => setInput({ fyv })} />
        </div>
      </fieldset>

      <fieldset>
        <legend>แรงภายใน (แรงใช้งาน)</legend>
        <div className="grid2">
          <label className="span2">
            <NumberField label="แรงอัดตามแนวแกน P" unit="kg" step={1000} {...num('P')} />
          </label>
          <NumberField label="โมเมนต์ Mx" unit="kg·m" step={100} {...num('Mx')} />
          <NumberField label="โมเมนต์ My" unit="kg·m" step={100} {...num('My')} />
          <span className="field-hint span2">
            Mx ดัดรอบแกน x (ด้าน h รับแรง), My ดัดรอบแกน y (ด้าน b รับแรง) — ใช้ค่ามากสุดที่ปลายเสา (M2)
          </span>
        </div>
      </fieldset>

      <fieldset>
        <legend>เหล็กเสริม</legend>
        <div className="grid2">
          <BarSelect label="เหล็กยืน" value={input.mainBar} sizes={MAIN_BAR_SIZES} onChange={(mainBar) => setInput({ mainBar })} />
          <BarSelect
            label={input.shape === 'rect' ? 'เหล็กปลอก' : 'เหล็กเกลียว'}
            value={input.tieBar}
            sizes={STIRRUP_BAR_SIZES}
            onChange={(tieBar) => setInput({ tieBar })}
          />
        </div>
      </fieldset>
    </div>
  );
}
