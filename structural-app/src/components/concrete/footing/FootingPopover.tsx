import type { FootingDirection } from '@/engine/concrete/footing/analyzeFooting';
import { setBarSet, setBottom } from '@/engine/concrete/footing/layoutOps';
import type { BarDir, BarSet, FootingLayout } from '@/engine/concrete/footing/types';
import { cmToM, fmt } from '@/engine/concrete/format';
import { MAIN_BAR_SIZES } from '@/engine/concrete/rebar';
import { SizeChips } from '../editor/BarPopover';

export type ApplyFootingEdit = (fn: (layout: FootingLayout) => FootingLayout) => void;

const DIR_TITLE: Record<BarDir, string> = { x: 'เหล็กทิศ X (ยาวตามแกน x)', y: 'เหล็กทิศ Y (ยาวตามแกน y)' };

export function FootingBarPopover({
  dir, layout, analysis, suggested, apply,
}: {
  dir: BarDir;
  layout: FootingLayout;
  /** ผลวิเคราะห์ทั้งสองทิศ — ใช้ร่วมกับฐานรากเสาเข็ม */
  analysis: Record<BarDir, Pick<FootingDirection, 'isBottom' | 'AsReq' | 'AsProv' | 'sMax' | 'pitch' | 'band' | 'bandAsReq' | 'bandAsProv'>>;
  suggested: BarSet;
  apply: ApplyFootingEdit;
}) {
  const bars = layout[dir];
  const r = analysis[dir];
  const setCount = (count: number) => apply((l) => setBarSet(l, dir, { count }));

  return (
    <>
      <div className="popover-title">
        {DIR_TITLE[dir]} <small>({r.isBottom ? 'ชั้นล่าง' : 'ชั้นที่ 2'})</small>
      </div>
      <div className="popover-sub">ขนาด</div>
      <SizeChips sizes={MAIN_BAR_SIZES} value={bars.size} onPick={(size) => apply((l) => setBarSet(l, dir, { size }))} />
      <div className="popover-sub">จำนวนเส้น</div>
      <div className="spacing-row">
        <button type="button" className="btn" onClick={() => setCount(bars.count - 1)} aria-label="ลดจำนวน" disabled={bars.count <= 2}>
          −
        </button>
        <span className="spacing-val">
          {bars.count} เส้น @{cmToM(Math.floor(r.pitch * 2) / 2)}
        </span>
        <button type="button" className="btn" onClick={() => setCount(bars.count + 1)} aria-label="เพิ่มจำนวน">
          +
        </button>
      </div>
      <p className="popover-hint">
        As ต้องการ ≥ {fmt(r.AsReq)} ซม.² (ใส่ {fmt(r.AsProv)}), ระยะเรียง ≤ {fmt(r.sMax, 1)} ซม.
        {r.band && r.bandAsProv !== null && ` — แถบกลาง ≥ ${fmt(r.bandAsReq)} (ใส่ ${fmt(r.bandAsProv)})`}
      </p>
      <div className="popover-actions">
        {(suggested.size !== bars.size || suggested.count !== bars.count) && (
          <button type="button" className="btn small" onClick={() => apply((l) => setBarSet(l, dir, suggested))}>
            ใช้ค่าที่คำนวณได้ {suggested.count}-{suggested.size}
          </button>
        )}
        {!r.isBottom && (
          <button type="button" className="btn small" onClick={() => apply((l) => setBottom(l, dir))}>
            วางเป็นชั้นล่าง
          </button>
        )}
      </div>
    </>
  );
}
