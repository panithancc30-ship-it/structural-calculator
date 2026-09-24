import { ACI318_WSD_SLAB as K } from '@/engine/concrete/codes/aci318Wsd';
import { cmToM, fmt } from '@/engine/concrete/format';
import { ALL_BAR_SIZES } from '@/engine/concrete/rebar';
import type { BarRun } from '@/engine/concrete/slab/types';
import { STAIR_BAR_TH, type StairBarDemand } from '@/engine/concrete/stair/analyzeStair';
import { setStairRun, toggleStairRun } from '@/engine/concrete/stair/layoutOps';
import type { StairBarKey, StairLayout } from '@/engine/concrete/stair/types';
import { SizeChips } from '../editor/BarPopover';

export type ApplyStairEdit = (fn: (layout: StairLayout) => StairLayout) => void;

const ROLE_TH: Record<StairBarKey, string> = {
  bottom: 'รับ M+ ตลอดช่วง',
  topLow: 'รับ M− ที่ปลายล่าง',
  topHigh: 'รับ M− ที่ปลายบน',
  dist: 'เหล็กกันร้าว ตั้งฉากเหล็กหลัก',
  step: 'เหล็กตามแบบมาตรฐาน ไม่ได้คำนวณ',
};

interface Props {
  barKey: StairBarKey;
  layout: StairLayout;
  demand: StairBarDemand;
  /** ชุดที่โปรแกรมคำนวณได้ ใช้เป็นค่าตั้งต้นเมื่อเพิ่มเหล็กกลับเข้ามา */
  suggested: BarRun | null;
  apply: ApplyStairEdit;
}

/** แก้เหล็กบันไดหนึ่งชุด — ระบุด้วยขนาดและระยะเรียงแบบเดียวกับเหล็กพื้น */
export function StairBarPopover({ barKey, layout, demand, suggested, apply }: Props) {
  const run = layout[barKey];
  const nominal = barKey === 'step';

  if (!run) {
    return (
      <>
        <div className="popover-title">
          {STAIR_BAR_TH[barKey]}
          <small>ยังไม่มีเหล็กชุดนี้</small>
        </div>
        <div className="popover-actions">
          <button
            type="button"
            className="btn accent"
            disabled={!suggested}
            onClick={() => suggested && apply((l) => toggleStairRun(l, barKey, suggested))}
          >
            + เพิ่มเหล็ก {suggested ? `${suggested.size} @${cmToM(suggested.spacing)}` : ''}
          </button>
        </div>
      </>
    );
  }

  const step = (delta: number) => apply((l) => setStairRun(l, barKey, { spacing: run.spacing + delta }));
  const maxSpacing = nominal ? K.maxSpacing : Math.min(demand.sMax, K.maxSpacing);

  return (
    <>
      <div className="popover-title">
        {STAIR_BAR_TH[barKey]}
        <small>{ROLE_TH[barKey]}</small>
      </div>
      <div className="popover-sub">ขนาดเหล็ก</div>
      <SizeChips sizes={ALL_BAR_SIZES} value={run.size} onPick={(size) => apply((l) => setStairRun(l, barKey, { size }))} />

      <div className="popover-sub">ระยะเรียง</div>
      <div className="spacing-row">
        <button
          type="button"
          className="btn"
          disabled={run.spacing <= K.minSpacing}
          onClick={() => step(-K.spacingStep)}
          aria-label="ลดระยะเรียง"
        >
          −
        </button>
        <span className="spacing-val">@ {cmToM(run.spacing)} ม.</span>
        <button
          type="button"
          className="btn"
          disabled={run.spacing >= maxSpacing}
          onClick={() => step(K.spacingStep)}
          aria-label="เพิ่มระยะเรียง"
        >
          +
        </button>
      </div>

      {nominal ? (
        <p className="popover-hint">เหล็กขั้นบันไดงอตามลูกตั้งและลูกนอน พร้อมเหล็กมุมขั้นขนาดเดียวกันทุกขั้น</p>
      ) : (
        <p className="popover-hint">
          As ต้องการ <strong>{fmt(demand.AsReq)}</strong> ใส่จริง <strong>{fmt(demand.AsProv)}</strong> ซม.²/ม.
          <br />
          ระยะเรียงไม่เกิน {fmt(demand.sMax, 1)} ซม. ({barKey === 'dist' ? '5h' : '3h'} และ ≤ {K.maxSpacing} ซม.)
        </p>
      )}

      <div className="popover-actions">
        {suggested && (
          <button type="button" className="btn accent" onClick={() => apply((l) => setStairRun(l, barKey, suggested))}>
            ใช้ค่าที่คำนวณได้ {suggested.size} @{cmToM(suggested.spacing)}
          </button>
        )}
        {nominal && (
          <button type="button" className="btn danger" onClick={() => apply((l) => toggleStairRun(l, barKey, run))}>
            เอาเหล็กชุดนี้ออก
          </button>
        )}
      </div>
    </>
  );
}
