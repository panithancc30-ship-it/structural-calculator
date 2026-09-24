import { ACI318_WSD_SLAB as K } from '@/engine/concrete/codes/aci318Wsd';
import type { BarDir } from '@/engine/concrete/footing/types';
import { cmToM, fmt } from '@/engine/concrete/format';
import { ALL_BAR_SIZES } from '@/engine/concrete/rebar';
import type { SlabFaceDemand } from '@/engine/concrete/slab/analyzeSlab';
import { clampSpacing, setRun, toggleRun } from '@/engine/concrete/slab/layoutOps';
import type { BarRun, SlabLayout } from '@/engine/concrete/slab/types';
import type { Face } from '@/engine/concrete/types';
import { SizeChips } from '../editor/BarPopover';

export type ApplySlabEdit = (fn: (layout: SlabLayout) => SlabLayout) => void;

const FACE_TH: Record<Face, string> = { bottom: 'ผิวล่าง', top: 'ผิวบน' };

interface Props {
  face: Face;
  dir: BarDir;
  layout: SlabLayout;
  demand: SlabFaceDemand;
  /** ชุดที่โปรแกรมคำนวณได้ ใช้เป็นค่าตั้งต้นเมื่อเพิ่มเหล็กกลับเข้ามา */
  suggested: BarRun | null;
  apply: ApplySlabEdit;
}

/**
 * แก้เหล็กพื้นหนึ่งชุด
 *
 * ต่างจาก FootingBarPopover ตรงที่เหล็กพื้นระบุด้วย "ระยะเรียง" ไม่ใช่จำนวนเส้น
 * จึงเป็นปุ่มปรับระยะทีละ 2.5 ซม. แทนปุ่มเพิ่ม/ลดจำนวน
 */
export function SlabBarPopover({ face, dir, layout, demand, suggested, apply }: Props) {
  const run = layout[face][dir];
  const isMain = demand.Mdesign > 0;

  if (!run) {
    return (
      <>
        <div className="popover-title">
          {FACE_TH[face]} ทิศ {dir.toUpperCase()}
          <small>ยังไม่มีเหล็กชุดนี้</small>
        </div>
        <p className="popover-hint">
          ผิวนี้ไม่มีเหล็กในทิศนี้ — เพิ่มได้ถ้าต้องการเสริมเอง
        </p>
        <div className="popover-actions">
          <button
            type="button"
            className="btn accent"
            disabled={!suggested}
            onClick={() => suggested && apply((l) => toggleRun(l, face, dir, suggested))}
          >
            + เพิ่มเหล็ก {suggested ? `${suggested.size} @${cmToM(suggested.spacing)}` : ''}
          </button>
        </div>
      </>
    );
  }

  const step = (delta: number) => apply((l) => setRun(l, face, dir, { spacing: clampSpacing(run.spacing + delta) }));

  return (
    <>
      <div className="popover-title">
        {FACE_TH[face]} ทิศ {dir.toUpperCase()}
        <small>{isMain ? 'เหล็กรับโมเมนต์' : 'เหล็กกันร้าว / เหล็กกระจาย'}</small>
      </div>
      <div className="popover-sub">ขนาดเหล็ก</div>
      <SizeChips sizes={ALL_BAR_SIZES} value={run.size} onPick={(size) => apply((l) => setRun(l, face, dir, { size }))} />

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
          disabled={run.spacing >= Math.min(demand.sMax, K.maxSpacing)}
          onClick={() => step(K.spacingStep)}
          aria-label="เพิ่มระยะเรียง"
        >
          +
        </button>
      </div>

      <p className="popover-hint">
        As ต้องการ <strong>{fmt(demand.AsReq)}</strong> ใส่จริง <strong>{fmt(demand.AsProv)}</strong> ซม.²/ม.
        <br />
        ระยะเรียงไม่เกิน {fmt(demand.sMax, 1)} ซม. ({isMain ? '3h' : '5h'} และ ≤ {K.maxSpacing} ซม.)
      </p>

      <div className="popover-actions">
        {suggested && (
          <button
            type="button"
            className="btn accent"
            onClick={() => apply((l) => setRun(l, face, dir, suggested))}
          >
            ใช้ค่าที่คำนวณได้ {suggested.size} @{cmToM(suggested.spacing)}
          </button>
        )}
        {!isMain && (
          <button type="button" className="btn danger" onClick={() => apply((l) => toggleRun(l, face, dir, run))}>
            เอาเหล็กชุดนี้ออก
          </button>
        )}
      </div>
    </>
  );
}
