import { ACI318_WSD_PILECAP as K } from '@/engine/concrete/codes/aci318Wsd';
import { fmt } from '@/engine/concrete/format';
import { canRotate, PILE_COUNTS } from '@/engine/concrete/pilecap/piles';
import type { AutoMode, PileArrangement, PileCapInput, PileShape } from '@/engine/concrete/pilecap/types';
import { MAIN_BAR_SIZES, STEEL_GRADES } from '@/engine/concrete/rebar';
import { useColumnStore } from '@/state/columnStore';
import { usePileCapStore } from '@/state/pileCapStore';
import { BarSelect, NumberField, Segmented, SteelField } from '../form/Fields';

type NumericKey = { [P in keyof PileCapInput]: PileCapInput[P] extends number ? P : never }[keyof PileCapInput];

/** เสากลมแทนด้วยเสาสี่เหลี่ยมจัตุรัสพื้นที่เท่ากัน (ACI 15.3) */
function importFromColumn(): Partial<PileCapInput> {
  const { input } = useColumnStore.getState();
  const side = Math.round(input.D * Math.sqrt(Math.PI / 4));
  return {
    capName: `F-${input.columnName || 'C1'}`,
    cx: input.shape === 'rect' ? input.b : side,
    cy: input.shape === 'rect' ? input.h : side,
    P: input.P,
    Mx: input.Mx,
    My: input.My,
  };
}

export function PileCapInputPanel({ design }: { design: { arrangement: PileArrangement; t: number } | null }) {
  const input = usePileCapStore((s) => s.input);
  const setInput = usePileCapStore((s) => s.setInput);
  const num = (key: NumericKey) => ({
    value: input[key],
    onChange: (v: number) => setInput({ [key]: v } as Partial<PileCapInput>),
  });
  const text = (key: 'projectName' | 'capName' | 'designer') => ({
    value: input[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setInput({ [key]: e.target.value }),
  });
  const count = design?.arrangement.count ?? input.pileCount;

  return (
    <div className="input-panel">
      <fieldset>
        <legend>โครงการ</legend>
        <div className="grid2">
          <label className="field span2">
            <span className="field-label">ชื่อโครงการ</span>
            <input className="text-input" {...text('projectName')} />
          </label>
          <label className="field">
            <span className="field-label">ชื่อฐานราก</span>
            <input className="text-input" {...text('capName')} />
          </label>
          <label className="field">
            <span className="field-label">ผู้ออกแบบ</span>
            <input className="text-input" {...text('designer')} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>เสา / ตอม่อ</legend>
        <div className="grid2">
          <NumberField label="ด้าน cx (แนวแกน x)" unit="ซม." {...num('cx')} />
          <NumberField label="ด้าน cy (แนวแกน y)" unit="ซม." {...num('cy')} />
          <NumberField label="เยื้องศูนย์ ex" unit="ซม." {...num('ex')} />
          <NumberField label="เยื้องศูนย์ ey" unit="ซม." {...num('ey')} />
          <span className="field-hint span2">
            ระยะจากศูนย์ถ่วงกลุ่มเสาเข็มถึงศูนย์เสา — บวกไปทางขวา (+x) / บน (+y); 0 = เสาอยู่กลางกลุ่มเข็ม
          </span>
          <button type="button" className="btn small span2" onClick={() => setInput(importFromColumn())}>
            นำขนาดเสาและแรงจากโมดูลเสา
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>เสาเข็ม</legend>
        <div className="grid2">
          <Segmented<PileShape>
            label="หน้าตัดเสาเข็ม"
            value={input.pileShape}
            options={[
              { value: 'square', label: 'สี่เหลี่ยม' },
              { value: 'circle', label: 'กลม' },
            ]}
            onChange={(pileShape) => setInput({ pileShape })}
          />
          <NumberField label={input.pileShape === 'circle' ? 'เส้นผ่านศูนย์กลาง D' : 'ขนาดด้าน D'} unit="ซม." {...num('pileSize')} />
          <div className="field">
            <span className="field-label">ความยาวเสาเข็ม</span>
            <span className="auto-dims">L</span>
            <span className="field-hint">ขึ้นอยู่กับผลทดสอบดิน</span>
          </div>
          <NumberField label="น้ำหนักบรรทุกปลอดภัย Pa" unit="ตัน/ต้น" step={1} {...num('pileCapacity')} />
          <NumberField label="แรงถอนที่ยอมให้ Ta" unit="ตัน/ต้น" step={1} hint="0 = ไม่ยอมให้เข็มรับแรงถอน" {...num('pileTension')} />
          <NumberField label="ระยะห่างเข็ม s" unit="ซม." step={5} hint={`แนะนำ ≥ ${K.pileSpacingFactor}D = ${fmt(K.pileSpacingFactor * input.pileSize, 0)} ซม.`} {...num('spacing')} />
          <NumberField label="ศูนย์เข็มถึงขอบฐาน" unit="ซม." step={5} {...num('edge')} />
          <Segmented<AutoMode>
            label="จำนวนเสาเข็ม"
            value={input.countMode}
            options={[
              { value: 'auto', label: 'อัตโนมัติ' },
              { value: 'manual', label: 'กำหนดเอง' },
            ]}
            onChange={(countMode) =>
              setInput(countMode === 'manual' && design ? { countMode, pileCount: design.arrangement.count, rotate: design.arrangement.rotate } : { countMode })
            }
          />
          {input.countMode === 'manual' ? (
            <label className="field">
              <span className="field-label">จำนวน (ต้น)</span>
              <select value={input.pileCount} onChange={(e) => setInput({ pileCount: Number(e.target.value) })}>
                {PILE_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n} ต้น
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="field">
              <span className="field-label">จำนวนที่ได้</span>
              <span className="auto-dims">{design ? `${design.arrangement.count} ต้น` : '—'}</span>
            </div>
          )}
          {canRotate(count) && (
            <label className="field check-field">
              <span className="field-label">แนววางเข็ม</span>
              <span className="field-row">
                <input
                  type="checkbox"
                  checked={design?.arrangement.rotate ?? input.rotate}
                  onChange={(e) => setInput({ rotate: e.target.checked })}
                />{' '}
                หมุน 90°
              </span>
            </label>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>ฐานราก</legend>
        <div className="grid2">
          <Segmented<AutoMode>
            label="ความหนา t"
            value={input.thicknessMode}
            options={[
              { value: 'auto', label: 'อัตโนมัติ' },
              { value: 'manual', label: 'กำหนดเอง' },
            ]}
            onChange={(thicknessMode) => setInput(thicknessMode === 'manual' && design ? { thicknessMode, t: design.t } : { thicknessMode })}
          />
          {input.thicknessMode === 'manual' ? (
            <NumberField label="ความหนา t" unit="ซม." step={5} {...num('t')} />
          ) : (
            <div className="field">
              <span className="field-label">ความหนาที่ได้</span>
              <span className="auto-dims">{design ? `${fmt(design.t / 100, 2)} ม.` : '—'}</span>
            </div>
          )}
          <span className="field-hint span2">
            ขนาดแปลน Bx × By = กรอบเสาเข็ม + ระยะขอบ (ปัดทีละ {K.sizeStep} ซม.) — ความหนาอัตโนมัติ: น้อยสุดที่ d ≥ {K.minDepthAboveSteel} ซม. ดัด เฉือน และเฉือนทะลุผ่าน
          </span>
          <NumberField label="ระยะหุ้ม covering" unit="ซม." step={0.5} {...num('cover')} />
          <NumberField label="หัวเข็มฝังในฐาน" unit="ซม." step={0.5} {...num('embed')} />
          <NumberField label="ความลึกท้องฐาน Df" unit="ม." step={0.1} {...num('Df')} />
          <NumberField label="หน่วยน้ำหนักดิน γs" unit="t/m³" step={0.1} {...num('gammaSoil')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>วัสดุ</legend>
        <div className="stack">
          <NumberField label="กำลังอัดคอนกรีต f′c (ทรงกระบอก)" unit="ksc" step={10} {...num('fc')} />
          <SteelField label="fy เหล็กเสริม" value={input.fy} grades={STEEL_GRADES.filter((g) => g.kind === 'DB')} onChange={(fy) => setInput({ fy })} />
        </div>
      </fieldset>

      <fieldset>
        <legend>แรงที่โคนเสา (แรงใช้งาน)</legend>
        <div className="grid2">
          <div className="span2">
            <NumberField label="แรงอัดตามแนวแกน P" unit="kg" step={1000} {...num('P')} />
          </div>
          <NumberField label="โมเมนต์ Mx" unit="kg·m" step={100} {...num('Mx')} />
          <NumberField label="โมเมนต์ My" unit="kg·m" step={100} {...num('My')} />
          <span className="field-hint span2">ค่าบวกทำให้เข็มด้าน +y (Mx) / +x (My) รับแรงมากขึ้น</span>
        </div>
      </fieldset>

      <fieldset>
        <legend>เหล็กเสริม</legend>
        <BarSelect label="ขนาดเหล็กที่ต้องการ (ขยับขนาดอัตโนมัติเมื่อจำเป็น)" value={input.bar} sizes={MAIN_BAR_SIZES} onChange={(bar) => setInput({ bar })} />
      </fieldset>
    </div>
  );
}
