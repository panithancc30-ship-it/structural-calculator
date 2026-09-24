import { ACI318_WSD as C } from '../../domain/codes/aci318Wsd';
import type { SectionAnalysis } from '../../domain/design/sectionCheck';
import { fmt } from '../../domain/format';
import { ensureInnerAnchors, setStirrup } from '../../domain/layoutOps';
import { STIRRUP_BAR_SIZES, type BarName } from '../../domain/rebar';
import type { SectionLayout } from '../../domain/types';
import { SizeChips, type ApplyEdit } from './BarPopover';

interface Props {
  layout: SectionLayout;
  analysis: SectionAnalysis;
  mainBar: BarName;
  sMin: number;
  apply: ApplyEdit;
}

export function StirrupPopover({ layout, analysis, mainBar, sMin, apply }: Props) {
  const st = layout.stirrup;
  const cap = analysis.stirrupCap;
  const step = C.spacingStep;
  const suggested = Math.max(step, Math.floor(cap.sRaw / step + 1e-9) * step);
  const setSpacing = (s: number) => apply((l) => setStirrup(l, { spacing: Math.max(step, Math.round(s / step) * step) }));

  return (
    <>
      <div className="popover-title">เหล็กปลอก</div>
      <div className="seg" role="group" aria-label="จำนวนปลอก">
        {([1, 2] as const).map((count) => (
          <button
            key={count}
            type="button"
            className={st.count === count ? 'active' : ''}
            aria-pressed={st.count === count}
            onClick={() =>
              apply((l) => {
                const next = setStirrup(l, { count });
                return count === 2 ? ensureInnerAnchors(next, mainBar) : next;
              })
            }
          >
            {count === 1 ? '1 ปลอก (2 ขา)' : '2 ปลอก (4 ขา)'}
          </button>
        ))}
      </div>
      <div className="popover-sub">ขนาด</div>
      <SizeChips sizes={STIRRUP_BAR_SIZES} value={st.size} onPick={(size) => apply((l) => setStirrup(l, { size }))} />
      <div className="popover-sub">ระยะเรียง</div>
      <div className="spacing-row">
        <button type="button" className="btn" onClick={() => setSpacing(st.spacing - step)} aria-label="ลดระยะ">
          −
        </button>
        <span className="spacing-val">@ {fmt(st.spacing, 1)} ซม.</span>
        <button type="button" className="btn" onClick={() => setSpacing(st.spacing + step)} aria-label="เพิ่มระยะ">
          +
        </button>
      </div>
      <p className="popover-hint">
        ระยะที่ยอมให้ ≤ {fmt(cap.sRaw, 1)} ซม. (กำลัง {Number.isFinite(cap.sStrength) ? fmt(cap.sStrength, 1) : '—'}, s max{' '}
        {fmt(cap.sMax, 1)}, ขั้นต่ำ {fmt(cap.sAreaMin, 1)})
        {suggested < sMin && <strong> — แคบกว่า {fmt(sMin, 1)} ซม. ก่อสร้างยาก</strong>}
      </p>
      {suggested !== st.spacing && (
        <button type="button" className="btn small" onClick={() => setSpacing(suggested)}>
          ใช้ระยะที่คำนวณได้ @ {fmt(suggested, 1)} ซม.
        </button>
      )}
      {st.count === 2 && (
        <p className="popover-hint">ปลอกในขนาด/ระยะเดียวกับปลอกนอก ต้องมีเหล็กมุม — ชั้นแรกบนและล่างอย่างน้อย 4 เส้น</p>
      )}
    </>
  );
}
