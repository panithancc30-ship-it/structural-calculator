import { ACI318_WSD_FOOTING as K } from '@/engine/concrete/codes/aci318Wsd';
import type { ColumnPosition, CornerSide, EdgeSide, FootingDims, FootingInput, SizeMode } from '@/engine/concrete/footing/types';
import { fmt } from '@/engine/concrete/format';
import { MAIN_BAR_SIZES, STEEL_GRADES } from '@/engine/concrete/rebar';
import { useColumnStore } from '@/state/columnStore';
import { useFootingStore } from '@/state/footingStore';
import { BarSelect, NumberField, Segmented, SteelField } from '../form/Fields';

type NumericKey = { [P in keyof FootingInput]: FootingInput[P] extends number ? P : never }[keyof FootingInput];

const meters = (cm: number) => fmt(cm / 100, 2);

/** เสากลมแทนด้วยเสาสี่เหลี่ยมจัตุรัสพื้นที่เท่ากัน (ACI 15.3) */
function importFromColumn(): Partial<FootingInput> {
  const { input } = useColumnStore.getState();
  const side = Math.round(input.D * Math.sqrt(Math.PI / 4));
  return {
    cx: input.shape === 'rect' ? input.b : side,
    cy: input.shape === 'rect' ? input.h : side,
    P: input.P,
    Mx: input.Mx,
    My: input.My,
  };
}

export function FootingInputPanel({ dims }: { dims: FootingDims | null }) {
  const input = useFootingStore((s) => s.input);
  const setInput = useFootingStore((s) => s.setInput);
  const num = (key: NumericKey) => ({
    value: input[key],
    onChange: (v: number) => setInput({ [key]: v } as Partial<FootingInput>),
  });
  const flush = input.position === 'edge' || input.position === 'corner';

  return (
    <div className="input-panel">
      <fieldset>
        <legend>เสา / ตอม่อ</legend>
        <div className="grid2">
          <NumberField label="ด้าน cx (แนวแกน x)" unit="ซม." {...num('cx')} />
          <NumberField label="ด้าน cy (แนวแกน y)" unit="ซม." {...num('cy')} />
          <Segmented<ColumnPosition>
            label="ตำแหน่งเสาบนฐานราก"
            grid
            value={input.position}
            options={[
              { value: 'center', label: 'ศูนย์กลาง' },
              { value: 'offset', label: 'เยื้องศูนย์' },
              { value: 'edge', label: 'ตีนเป็ดชิดขอบ' },
              { value: 'corner', label: 'ตีนเป็ดชิดมุม' },
            ]}
            onChange={(position) => setInput({ position })}
          />
          {input.position === 'offset' && (
            <>
              <NumberField label="ระยะเยื้อง ex" unit="ซม." {...num('ex')} />
              <NumberField label="ระยะเยื้อง ey" unit="ซม." {...num('ey')} />
              <span className="field-hint span2">ระยะจากศูนย์ฐานรากถึงศูนย์เสา — บวกไปทางขวา (+x) / บน (+y)</span>
            </>
          )}
          {input.position === 'edge' && (
            <Segmented<EdgeSide>
              label="ขอบที่เสาชิด"
              value={input.edgeSide}
              options={[
                { value: 'left', label: 'ซ้าย' },
                { value: 'right', label: 'ขวา' },
                { value: 'bottom', label: 'ล่าง' },
                { value: 'top', label: 'บน' },
              ]}
              onChange={(edgeSide) => setInput({ edgeSide })}
            />
          )}
          {input.position === 'corner' && (
            <Segmented<CornerSide>
              label="มุมที่เสาชิด"
              grid
              value={input.cornerSide}
              options={[
                { value: 'top-left', label: 'บนซ้าย' },
                { value: 'top-right', label: 'บนขวา' },
                { value: 'bottom-left', label: 'ล่างซ้าย' },
                { value: 'bottom-right', label: 'ล่างขวา' },
              ]}
              onChange={(cornerSide) => setInput({ cornerSide })}
            />
          )}
          {flush && (
            <div className="span2">
              <NumberField
                label="ระยะผิวเสาถึงขอบฐานราก"
                unit="ซม."
                hint="ตีนเป็ด: ดินรับโมเมนต์จากการเยื้องศูนย์ทั้งหมด (ไม่มีคานยึด)"
                {...num('edgeGap')}
              />
            </div>
          )}
          <button type="button" className="btn small span2" onClick={() => setInput(importFromColumn())}>
            นำขนาดเสาและแรงจากโมดูลเสา
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>ขนาดฐานราก</legend>
        <div className="grid2">
          <Segmented<SizeMode>
            label="การกำหนดขนาด B × L × t"
            value={input.sizeMode}
            options={[
              { value: 'auto', label: 'อัตโนมัติ' },
              { value: 'manual', label: 'กำหนดเอง' },
            ]}
            onChange={(sizeMode) => setInput(sizeMode === 'manual' && dims ? { sizeMode, ...dims } : { sizeMode })}
          />
          {input.sizeMode === 'manual' ? (
            <>
              <NumberField label="ด้าน B (แนวแกน x)" unit="ซม." step={5} {...num('B')} />
              <NumberField label="ด้าน L (แนวแกน y)" unit="ซม." step={5} {...num('L')} />
              <NumberField label="ความหนา t" unit="ซม." step={5} {...num('t')} />
            </>
          ) : (
            <div className="field span2">
              <span className="field-label">ขนาดที่ได้ (ปัดทีละ {K.sizeStep} ซม.)</span>
              <span className="auto-dims">
                {dims ? `${meters(dims.B)} × ${meters(dims.L)} × ${meters(dims.t)} ม.` : '—'}
              </span>
              <span className="field-hint">
                พื้นที่น้อยสุดที่ qmax ≤ qa และดินรับแรงดัน ≥ {fmt(K.minContactRatio * 100, 0)}% แล้วเพิ่มความหนาจนเฉือนและดัดผ่าน —
                กด "กำหนดเอง" เพื่อแก้จากค่านี้
              </span>
            </div>
          )}
          <NumberField label="ระยะหุ้ม covering" unit="ซม." step={0.5} {...num('cover')} />
        </div>
      </fieldset>

      <fieldset>
        <legend>ดิน</legend>
        <div className="grid2">
          <div className="span2">
            <NumberField
              label="กำลังรับน้ำหนักดินที่ยอมให้ qa"
              unit="t/m²"
              step={1}
              hint="เทียบกับแรงดันรวมน้ำหนักฐานรากและดินถม"
              {...num('qa')}
            />
          </div>
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
          <span className="field-hint span2">
            Mx ดัดรอบแกน x (แรงดันเปลี่ยนตามแนว y), My ดัดรอบแกน y — ค่าบวกทำให้ดินด้าน +y / +x รับแรงดันมากขึ้น
          </span>
        </div>
      </fieldset>

      <fieldset>
        <legend>เหล็กเสริม</legend>
        <BarSelect label="ขนาดเหล็กที่ต้องการ (ขยับขนาดอัตโนมัติเมื่อจำเป็น)" value={input.bar} sizes={MAIN_BAR_SIZES} onChange={(bar) => setInput({ bar })} />
      </fieldset>
    </div>
  );
}
