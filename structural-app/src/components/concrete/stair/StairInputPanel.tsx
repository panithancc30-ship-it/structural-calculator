import { ACI318_WSD_STAIR as K } from '@/engine/concrete/codes/aci318Wsd';
import { fmt } from '@/engine/concrete/format';
import { ALL_BAR_SIZES, STEEL_GRADES } from '@/engine/concrete/rebar';
import type { SizeMode } from '@/engine/concrete/slab/types';
import { degrees, stairProfile } from '@/engine/concrete/stair/geometry';
import type { StairAscend, StairDims, StairEnd, StairInput, StairUsage } from '@/engine/concrete/stair/types';
import { stairWarnings } from '@/engine/concrete/stair/validate';
import { useStairStore } from '@/state/stairStore';
import { BarSelect, NumberField, Segmented, SteelField } from '../form/Fields';

type NumericKey = { [P in keyof StairInput]: StairInput[P] extends number ? P : never }[keyof StairInput];

const END_OPTIONS: { value: StairEnd; label: string }[] = [
  { value: 'simple', label: 'ยึดหมุน' },
  { value: 'continuous', label: 'ต่อเนื่อง' },
];

const USAGE_OPTIONS: { value: StairUsage; label: string }[] = [
  { value: 'residential', label: 'อาคารอยู่อาศัย' },
  { value: 'public', label: 'อาคารสาธารณะ' },
];

const ASCEND_OPTIONS: { value: StairAscend; label: string }[] = [
  { value: 'right', label: 'ขึ้นทางขวา' },
  { value: 'left', label: 'ขึ้นทางซ้าย' },
];

const m2 = (cm: number) => fmt(cm / 100, 2);

export function StairInputPanel({ dims }: { dims: StairDims | null }) {
  const input = useStairStore((s) => s.input);
  const setInput = useStairStore((s) => s.setInput);

  const num = (key: NumericKey) => ({
    value: input[key],
    onChange: (v: number) => setInput({ [key]: v } as Partial<StairInput>),
  });

  const shapeOk = [input.riser, input.tread, input.risers].every((v) => Number.isFinite(v) && v > 0);
  const p = shapeOk ? stairProfile(input) : null;
  const warnings = stairWarnings(input);
  const use = input.usage;

  return (
    <div className="input-panel">
      <fieldset>
        <legend>ขั้นบันได</legend>
        <div className="grid2">
          <label className="field span2">
            <span className="field-label">ช่วงระดับ</span>
            <input
              className="text-input"
              placeholder="ชั้น 1 – ชานพัก"
              value={input.levels}
              onChange={(e) => setInput({ levels: e.target.value })}
            />
          </label>
          <NumberField label="ลูกตั้ง R" unit="ซม." step={0.5} {...num('riser')} />
          <NumberField label="ลูกนอน T" unit="ซม." step={0.5} {...num('tread')} />
          <NumberField
            label="จำนวนลูกตั้ง"
            unit="ขั้น"
            step={1}
            hint="ลูกนอนมีน้อยกว่าหนึ่ง เพราะขั้นบนสุดคือพื้นชั้นบน"
            {...num('risers')}
          />
          <NumberField label="ความกว้างบันได" unit="ซม." step={10} {...num('width')} />
          <div className="span2">
            <Segmented
              label="ประเภทอาคาร"
              value={use}
              options={USAGE_OPTIONS}
              onChange={(usage) => setInput({ usage })}
            />
          </div>
          <p className="field-hint span2">
            ลูกตั้ง ≤ {K.riserMax[use]} ซม. · ลูกนอน ≥ {K.treadMin[use]} ซม. · ช่วงหนึ่งสูง ≤ {m2(K.flightRiseMax[use])} ม.
            · กว้าง ≥ {m2(K.widthMin[use])} ม.
          </p>
          {p && (
            <div className="auto-dims span2">
              สูง <b>{input.risers}×{fmt(input.riser, 1)}</b> = {m2(p.rise)} ม. · ยาวราบ{' '}
              <b>{input.risers - 1}×{fmt(input.tread, 1)}</b> = {m2(p.run)} ม. · ลาด <b>{fmt(degrees(p.theta), 1)}°</b>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>ช่วงและที่รองรับ</legend>
        <div className="grid2">
          <NumberField
            label="ส่วนราบปลายล่าง"
            unit="ซม."
            step={5}
            hint="ศูนย์กลางคานถึงลูกตั้งขั้นแรก"
            {...num('landingLow')}
          />
          <NumberField
            label="ส่วนราบปลายบน"
            unit="ซม."
            step={5}
            hint="ลูกตั้งขั้นสุดท้ายถึงศูนย์กลางคาน"
            {...num('landingHigh')}
          />
          <div className="span2">
            <Segmented label="ปลายล่าง" value={input.endLow} options={END_OPTIONS} onChange={(endLow) => setInput({ endLow })} />
          </div>
          <div className="span2">
            <Segmented label="ปลายบน" value={input.endHigh} options={END_OPTIONS} onChange={(endHigh) => setInput({ endHigh })} />
          </div>
          <p className="field-hint span2">
            ยึดหมุน = ปลายหล่อติดคานโดยไม่มีพื้นต่อ ออกแบบ M+ เป็นช่วงเดียว และใส่เหล็กบนกันร้าวตาม w·L²/24
          </p>
          <div className="span2">
            <Segmented
              label="ทิศขึ้นในรูปตัด"
              value={input.ascend}
              options={ASCEND_OPTIONS}
              onChange={(ascend) => setInput({ ascend })}
            />
          </div>
          {p && (
            <div className="auto-dims span2">
              ช่วงราบระหว่างศูนย์กลางคาน L = <b>{m2(p.L)}</b> ม.
            </div>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>ความหนาท้องบันได</legend>
        <div className="grid2">
          <div className="span2">
            <Segmented
              label="กำหนดความหนา"
              value={input.thicknessMode}
              options={[
                { value: 'auto' as SizeMode, label: 'อัตโนมัติ' },
                { value: 'manual' as SizeMode, label: 'กำหนดเอง' },
              ]}
              onChange={(thicknessMode) =>
                setInput(thicknessMode === 'manual' && dims ? { thicknessMode, t: dims.t } : { thicknessMode })
              }
            />
          </div>
          {input.thicknessMode === 'manual' ? (
            <NumberField label="ความหนา t" unit="ซม." step={2.5} hint="วัดตั้งฉากกับแนวลาด" {...num('t')} />
          ) : (
            <div className="auto-dims span2">
              ความหนาที่โปรแกรมเลือก <b>{dims ? fmt(dims.t, 1) : '—'}</b> ซม.
            </div>
          )}
          <NumberField label="ระยะหุ้ม covering" unit="ซม." step={0.5} {...num('cover')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>น้ำหนักบรรทุก</legend>
        <div className="grid2">
          <NumberField
            label="วัสดุปูผิว"
            unit="กก./ตร.ม."
            step={10}
            hint="น้ำหนักท้องบันไดและขั้นบันไดโปรแกรมคิดให้เอง"
            {...num('finishDL')}
          />
          <NumberField
            label="น้ำหนักบรรทุกจร"
            unit="กก./ตร.ม."
            step={50}
            hint="บันไดทั่วไป 300 · อาคารพาณิชย์และโรงเรียน 400 · ตลาดและหอประชุม 500"
            {...num('LL')}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>วัสดุ</legend>
        <div className="grid2">
          <NumberField label="กำลังอัดคอนกรีต f′c" unit="ksc" step={10} {...num('fc')} />
          <SteelField label="fy เหล็กเสริม" value={input.fy} grades={STEEL_GRADES} onChange={(fy) => setInput({ fy })} />
        </div>
      </fieldset>

      <fieldset>
        <legend>เหล็กเสริม</legend>
        <div className="grid2">
          <BarSelect label="เหล็กหลัก" value={input.bar} sizes={ALL_BAR_SIZES} onChange={(bar) => setInput({ bar })} />
          <BarSelect
            label="เหล็กกระจาย"
            value={input.tempBar}
            sizes={ALL_BAR_SIZES}
            onChange={(tempBar) => setInput({ tempBar })}
          />
        </div>
      </fieldset>

      {warnings.length > 0 && (
        <div className="note warn">
          <span>{warnings.join(' · ')}</span>
        </div>
      )}
    </div>
  );
}
