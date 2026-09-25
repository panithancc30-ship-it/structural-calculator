import { fmt } from '@/engine/concrete/format';
import type { LedgeLoads } from '@/engine/concrete/ledge/loads';
import type { LedgeBeamInput, LedgeSupport } from '@/engine/concrete/ledge/types';
import { MAIN_BAR_SIZES, STEEL_GRADES, STIRRUP_BAR_SIZES } from '@/engine/concrete/rebar';
import type { StirrupMode } from '@/engine/concrete/types';
import { useLedgeStore } from '@/state/ledgeStore';
import { BarSelect, NumberField, Segmented, SteelField } from '../form/Fields';
import { SUPPORT_TH } from '../labels';
import { LedgeSketch } from './LedgeSketch';

type NumericKey = { [K in keyof LedgeBeamInput]-?: LedgeBeamInput[K] extends number ? K : never }[keyof LedgeBeamInput];

const SUPPORT_OPTIONS: { value: LedgeSupport; label: string }[] = (['simple', 'oneEnd', 'bothEnds'] as const).map(
  (value) => ({ value, label: SUPPORT_TH[value] }),
);

const STIRRUP_MODES: { value: StirrupMode; label: string }[] = [
  { value: 'auto', label: 'อัตโนมัติ' },
  { value: 'single', label: '1 ปลอก' },
  { value: 'double', label: '2 ปลอก' },
];

/** ผนังที่ใช้บ่อย (กก./ตร.ม. รวมฉาบ หนา 10 ซม.) ตามหน้า Design Criteria */
const WALL_HINT = 'อิฐมอญ 180 · อิฐบล็อก 120 · อิฐมวลเบา 100 กก./ตร.ม. — สูง 0 = ไม่มี';

export function LedgeInputPanel({ loads }: { loads: LedgeLoads | null }) {
  const input = useLedgeStore((s) => s.input);
  const setInput = useLedgeStore((s) => s.setInput);
  const num = (key: NumericKey) => ({
    value: input[key],
    onChange: (v: number) => setInput({ [key]: v } as Partial<LedgeBeamInput>),
  });

  return (
    <div className="input-panel">
      <fieldset>
        <legend>พื้นยื่น</legend>
        <LedgeSketch input={input} />
        <div className="grid2">
          <NumberField
            label="ความยาวพื้นยื่น Lc"
            unit="ม."
            step={0.05}
            hint="วัดจากศูนย์กลางคานถึงปลายพื้น"
            {...num('slabLength')}
          />
          <NumberField label="ความหนาพื้น t" unit="ซม." step={1} {...num('slabT')} />
          <NumberField
            label="น้ำหนักใช้งาน (จร)"
            unit="กก./ตร.ม."
            step={50}
            hint="กันสาด 100 · ที่พักอาศัย 150 · อาคารพาณิชย์ 300"
            {...num('LL')}
          />
          <NumberField
            label="วัสดุปูผิว"
            unit="กก./ตร.ม."
            step={10}
            hint="กระเบื้องรวมปูนทราย 5 ซม. = 120 · น้ำหนักตัวพื้นคิดจาก t ให้"
            {...num('finishDL')}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>ผนังและน้ำหนักอื่น</legend>
        <div className="grid2">
          <NumberField label="ผนัง/ราวกันตกที่ปลายพื้น สูง" unit="ม." step={0.1} {...num('tipWallH')} />
          <NumberField label="น้ำหนักผนังปลายพื้น" unit="กก./ตร.ม." step={10} {...num('tipWallW')} />
          <NumberField label="ผนังบนคาน สูง" unit="ม." step={0.1} {...num('beamWallH')} />
          <NumberField label="น้ำหนักผนังบนคาน" unit="กก./ตร.ม." step={10} {...num('beamWallW')} />
          <p className="field-hint span2">{WALL_HINT}</p>
          <NumberField
            label="น้ำหนักอื่นลงคาน"
            unit="กก./ม."
            step={50}
            hint="เช่น พื้นด้านในที่ถ่ายลงคาน — ไม่ทำให้คานบิด"
            {...num('otherLoad')}
          />
        </div>
        {loads && (
          <div className="auto-dims">
            ลงคาน w = <b>{fmt(loads.w, 0)}</b> กก./ม. · บิด t = <b>{fmt(loads.torque, 0)}</b> kg·m/m
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend>ขนาดคาน</legend>
        <div className="grid2">
          <NumberField label="กว้าง b" unit="ซม." {...num('b')} />
          <NumberField label="ลึก h" unit="ซม." {...num('h')} />
          <NumberField label="ช่วงคาน L" unit="ม." step={0.1} {...num('L')} />
          <NumberField label="ระยะหุ้ม covering" unit="ซม." step={0.5} {...num('cover')} />
          <Segmented
            label="สภาพรองรับ"
            value={input.support}
            options={SUPPORT_OPTIONS}
            onChange={(support) => setInput({ support })}
          />
          <p className="field-hint span2">
            ช่วงเดียว M+ = wL²/8 · ต่อเนื่องใช้สัมประสิทธิ์โมเมนต์ (1/14, 1/10 และ 1/16, 1/11) — ปลายคานยึดไม่ให้บิด
          </p>
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
        <legend>เหล็กเสริม</legend>
        <div className="grid2">
          <BarSelect label="เหล็กยืน" value={input.mainBar} sizes={MAIN_BAR_SIZES} onChange={(mainBar) => setInput({ mainBar })} />
          <BarSelect
            label="เหล็กปลอก"
            value={input.stirrupBar}
            sizes={STIRRUP_BAR_SIZES}
            onChange={(stirrupBar) => setInput({ stirrupBar })}
          />
          <Segmented
            label="รูปแบบเหล็กปลอก"
            value={input.stirrupMode}
            options={STIRRUP_MODES}
            onChange={(stirrupMode) => setInput({ stirrupMode })}
          />
          <p className="field-hint span2">แรงบิดใช้ได้เฉพาะปลอกนอกที่ปิดรอบหน้าตัด 2 ปลอกจึงช่วยเฉพาะแรงเฉือน</p>
          <NumberField label="ระยะปลอกต่ำสุดที่ยอมรับ" unit="ซม." step={2.5} {...num('sMin')} />
        </div>
      </fieldset>
    </div>
  );
}
