import { ACI318_WSD_SLAB as K } from '@/engine/concrete/codes/aci318Wsd';
import { fmt } from '@/engine/concrete/format';
import { ALL_BAR_SIZES, STEEL_GRADES } from '@/engine/concrete/rebar';
import { usesDetailS1 } from '@/engine/concrete/slab/detail';
import type { EdgeSupport, GroundUsage, SizeMode, SlabDims, SlabInput, SlabLevel, SlabType } from '@/engine/concrete/slab/types';
import { slabWarnings } from '@/engine/concrete/slab/validate';
import { DEFAULT_SLAB, useSlabStore } from '@/state/slabStore';
import { BarSelect, CodeFieldset, NumberField, Segmented, SteelField } from '../form/Fields';

type NumericKey = { [P in keyof SlabInput]-?: SlabInput[P] extends number ? P : never }[keyof SlabInput];

const SLAB_TYPE_OPTIONS: { value: SlabType; label: string }[] = [
  { value: 'oneWay', label: 'ทางเดียว' },
  { value: 'twoWay', label: 'สองทาง' },
  { value: 'cantilever', label: 'พื้นยื่น' },
  { value: 'onGround', label: 'วางบนดิน' },
];

const EDGE_OPTIONS: { value: EdgeSupport; label: string }[] = [
  { value: 'simple', label: 'ยึดหมุน' },
  { value: 'continuous', label: 'ต่อเนื่อง' },
];

const LEVEL_OPTIONS: { value: SlabLevel; label: string }[] = [
  { value: 'general', label: 'พื้นทั่วไป' },
  { value: 'dropped', label: 'พื้นลดระดับ' },
];

const USAGE_OPTIONS: { value: GroundUsage; label: string }[] = [
  { value: 'light', label: 'เบา (ที่พักอาศัย)' },
  { value: 'medium', label: 'ปานกลาง (จอดรถเก๋ง)' },
  { value: 'heavy', label: 'หนัก (เก็บของ รถบรรทุก)' },
];

export function SlabInputPanel({ dims }: { dims: SlabDims | null }) {
  const input = useSlabStore((s) => s.input);
  const setInput = useSlabStore((s) => s.setInput);

  const num = (key: NumericKey) => ({
    value: input[key],
    onChange: (v: number) => setInput({ [key]: v } as Partial<SlabInput>),
  });

  const onGround = input.slabType === 'onGround';
  const cantilever = input.slabType === 'cantilever';
  const twoWay = input.slabType === 'twoWay';
  const detail = usesDetailS1(input);
  const warnings = slabWarnings(input);

  /**
   * เปลี่ยนชนิดพื้นต้องปรับสภาพขอบและระยะหุ้มให้สมเหตุสมผลไปด้วย
   * พื้นวางบนดินเริ่มจากตะแกรง RB6 (SR24) ตามแบบขยายพื้น GS — ออกจากพื้นวางบนดินคืน fy ของพื้นทั่วไป
   * พื้นหล่อในที่ใช้ Covering = 3.0 cm. ตามแบบขยายพื้น S1
   */
  const changeType = (slabType: SlabType) => {
    // กดปุ่มชนิดเดิมซ้ำต้องไม่ล้างเหล็กและ fy ที่ผู้ใช้เลือกไว้
    if (slabType === input.slabType) return;
    const cover = slabType === 'onGround' ? K.coverOnGround : K.detailCover;
    const material: Partial<SlabInput> =
      slabType === 'onGround'
        ? { tempBar: 'RB6', fy: STEEL_GRADES.find((g) => g.kind === 'RB')!.fy }
        : onGround
          ? { fy: DEFAULT_SLAB.fy }
          : {};
    if (slabType === 'cantilever') {
      setInput({ slabType, edgeX1: 'continuous', edgeX2: 'free', edgeY1: 'simple', edgeY2: 'simple', cover, ...material });
      return;
    }
    const clear = (e: EdgeSupport): EdgeSupport => (e === 'free' ? 'continuous' : e);
    setInput({
      slabType,
      edgeX1: clear(input.edgeX1),
      edgeX2: clear(input.edgeX2),
      edgeY1: clear(input.edgeY1),
      edgeY2: clear(input.edgeY2),
      cover,
      ...material,
    });
  };

  return (
    <div className="input-panel">
      <CodeFieldset value={input.code} onChange={(code) => setInput({ code })} />
      <fieldset>
        <legend>ชนิดพื้น</legend>
        <div className="grid2">
          <div className="span2">
            <Segmented label="ชนิดพื้น" value={input.slabType} options={SLAB_TYPE_OPTIONS} onChange={changeType} grid />
          </div>
          {detail && (
            <>
              <div className="span2">
                <Segmented label="ระดับพื้น" value={input.level} options={LEVEL_OPTIONS} onChange={(level) => setInput({ level })} />
              </div>
              <p className="field-hint span2">
                ออกแบบตามแบบขยายพื้น S1 — เหล็กล่างคอม้าเว้นเส้น งอขึ้นที่ L/5 และเหล็กเสริมพิเศษที่ขอบยื่น L/4 (L = ช่วงสั้น)
                {input.level === 'dropped' && ' · พื้นลดระดับ: เหล็กบนงอลงฝังในคานทั้งสองข้าง'}
              </p>
            </>
          )}
          {onGround && (
            <>
              <div className="span2">
                <Segmented label="ระดับการใช้งาน" value={input.usage} options={USAGE_OPTIONS} onChange={(usage) => setInput({ usage })} />
              </div>
              <p className="field-hint span2">
                ออกแบบตามแบบขยายพื้น GS — ตะแกรงชั้นเดียว แยกจากคานด้วยร่องยาแนว ห้ามฝังเหล็กเข้าคาน
              </p>
            </>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>ช่วงพื้นและขอบ</legend>
        <div className="grid2">
          <NumberField
            label={cantilever ? 'ระยะยื่น (แกน x)' : onGround ? 'ความยาวแผ่น lx' : 'ช่วง lx'}
            unit="ซม."
            step={10}
            {...num('lx')}
          />
          <NumberField
            label={cantilever ? 'ความกว้าง (แกน y)' : onGround ? 'ความยาวแผ่น ly' : 'ช่วง ly'}
            unit="ซม."
            step={10}
            {...num('ly')}
          />
          {onGround && (
            <p className="field-hint span2">ระยะระหว่างคานหรือรอยต่อ — ใช้คิดเหล็กตะแกรง As = F·L·W/(2fs)</p>
          )}

          {!onGround && !cantilever && (
            <>
              <div className="span2">
                <Segmented
                  label="ขอบตั้งฉากแกน x — ด้านซ้าย"
                  value={input.edgeX1}
                  options={EDGE_OPTIONS}
                  onChange={(edgeX1) => setInput({ edgeX1 })}
                />
              </div>
              <div className="span2">
                <Segmented
                  label="ขอบตั้งฉากแกน x — ด้านขวา"
                  value={input.edgeX2}
                  options={EDGE_OPTIONS}
                  onChange={(edgeX2) => setInput({ edgeX2 })}
                />
              </div>
              {twoWay && (
                <>
                  <div className="span2">
                    <Segmented
                      label="ขอบตั้งฉากแกน y — ด้านบน"
                      value={input.edgeY1}
                      options={EDGE_OPTIONS}
                      onChange={(edgeY1) => setInput({ edgeY1 })}
                    />
                  </div>
                  <div className="span2">
                    <Segmented
                      label="ขอบตั้งฉากแกน y — ด้านล่าง"
                      value={input.edgeY2}
                      options={EDGE_OPTIONS}
                      onChange={(edgeY2) => setInput({ edgeY2 })}
                    />
                  </div>
                </>
              )}
            </>
          )}
          {cantilever && (
            <p className="field-hint span2">พื้นยื่นยึดแน่นที่ขอบด้านซ้ายของแกน x และปล่อยอิสระที่ปลายอีกด้าน</p>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend>ความหนา</legend>
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
            <NumberField label="ความหนา t" unit="ซม." step={2.5} {...num('t')} />
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
            label="วัสดุปูผิว ฝ้า ผนังเบา"
            unit="กก./ตร.ม."
            step={10}
            hint="น้ำหนักตัวพื้นโปรแกรมคิดจากความหนาให้เอง"
            {...num('finishDL')}
          />
          <NumberField label="น้ำหนักบรรทุกจร" unit="กก./ตร.ม." step={50} {...num('LL')} />
        </div>
      </fieldset>

      {onGround && (
        <fieldset>
          <legend>ดินใต้พื้น</legend>
          <div className="grid2">
            <div className="span2">
              <NumberField
                label="กำลังรับน้ำหนักดินที่ยอมให้ qa"
                unit="t/m²"
                step={0.5}
                hint="ดินถมบดอัดใต้ทรายรองพื้น — ใช้ค่าจากผลทดสอบดินถ้ามี"
                {...num('qa')}
              />
            </div>
          </div>
        </fieldset>
      )}

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
          {!onGround && (
            <BarSelect
              label={detail ? 'คอม้าเว้นเส้น / เสริมพิเศษ' : 'เหล็กหลัก'}
              value={input.bar}
              sizes={ALL_BAR_SIZES}
              onChange={(bar) => setInput({ bar })}
            />
          )}
          {/* พื้นสองทางแบบ S1 ใช้คอม้าทั้งสองทิศ ไม่มีเหล็กกันร้าวแยก */}
          {!twoWay && (
            <BarSelect
              label={onGround ? 'เหล็กตะแกรง (#)' : detail ? 'เหล็กกันร้าว (ทิศ Y)' : 'เหล็กกันร้าว'}
              value={input.tempBar}
              sizes={ALL_BAR_SIZES}
              onChange={(tempBar) => setInput({ tempBar })}
            />
          )}
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
