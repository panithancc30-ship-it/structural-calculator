import { useState } from 'react';
import { ACI318_WSD as C, ACI318_WSD_COLUMN as K } from '../../domain/codes/aci318Wsd';
import type { ColumnAnalysis } from '../../domain/column/analyzeColumn';
import { addColumnBar, findColumnBar, removeColumnBar, setColumnBarSize, setColumnTie } from '../../domain/column/layoutOps';
import type { ColumnLayout, RectFace } from '../../domain/column/types';
import { fmt } from '../../domain/format';
import { MAIN_BAR_SIZES, STIRRUP_BAR_SIZES } from '../../domain/rebar';
import { SizeChips } from '../editor/BarPopover';

export type ApplyColumnEdit = (fn: (layout: ColumnLayout) => ColumnLayout) => void;

const FACE_TH: Record<string, string> = {
  corner: 'เหล็กมุม', top: 'ด้านบน', bottom: 'ด้านล่าง', left: 'ด้านซ้าย', right: 'ด้านขวา', ring: 'เหล็กรอบวง',
};

export function ColumnBarPopover({
  layout, barId, apply, close,
}: {
  layout: ColumnLayout;
  barId: string;
  apply: ApplyColumnEdit;
  close: () => void;
}) {
  const [all, setAll] = useState(false);
  const [mirror, setMirror] = useState(true);
  const loc = findColumnBar(layout, barId);
  if (!loc) return null;
  const { bar, face } = loc;
  const addTo = (f: RectFace | 'ring') => apply((l) => addColumnBar(l, f, bar.size, mirror));

  return (
    <>
      <div className="popover-title">
        {FACE_TH[face]} <small>({bar.size})</small>
      </div>
      <SizeChips sizes={MAIN_BAR_SIZES} value={bar.size} onPick={(s) => apply((l) => setColumnBarSize(l, bar.id, s, all))} />
      <label className="check">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> เปลี่ยนทุกเส้น
      </label>
      {layout.kind === 'rect' && (
        <label className="check">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} /> เพิ่ม/ลบด้านตรงข้ามด้วย (สมมาตร)
        </label>
      )}
      <div className="popover-actions">
        {layout.kind === 'circle' ? (
          <button type="button" className="btn" onClick={() => addTo('ring')}>
            + เพิ่มเส้น
          </button>
        ) : face === 'corner' ? (
          <>
            <button type="button" className="btn" onClick={() => addTo('top')}>
              + ด้าน b (บน{mirror ? '/ล่าง' : ''})
            </button>
            <button type="button" className="btn" onClick={() => addTo('left')}>
              + ด้าน h (ซ้าย{mirror ? '/ขวา' : ''})
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => addTo(face as RectFace)}>
            + เพิ่มเส้นด้านนี้
          </button>
        )}
        <button
          type="button"
          className="btn danger"
          disabled={face === 'corner'}
          title={face === 'corner' ? 'เหล็กมุมลบไม่ได้' : undefined}
          onClick={() => {
            apply((l) => removeColumnBar(l, bar.id, mirror));
            close();
          }}
        >
          ลบเส้นนี้
        </button>
      </div>
    </>
  );
}

export function TiePopover({ layout, analysis, apply }: { layout: ColumnLayout; analysis: ColumnAnalysis; apply: ApplyColumnEdit }) {
  const spiral = layout.kind === 'circle';
  const step = spiral ? K.spiralPitchStep : C.spacingStep;
  const tie = layout.tie;
  const setSpacing = (s: number) => apply((l) => setColumnTie(l, { spacing: Math.max(step, Math.round(s / step) * step) }));
  const suggested = spiral ? analysis.spiralReq!.spacing : analysis.tie!.spacing;

  return (
    <>
      <div className="popover-title">{spiral ? 'เหล็กปลอกเกลียว' : 'เหล็กปลอก + เหล็กถ่าง'}</div>
      <div className="popover-sub">ขนาด</div>
      <SizeChips sizes={STIRRUP_BAR_SIZES} value={tie.size} onPick={(size) => apply((l) => setColumnTie(l, { size }))} />
      <div className="popover-sub">{spiral ? 'ระยะเกลียว (pitch)' : 'ระยะเรียง'}</div>
      <div className="spacing-row">
        <button type="button" className="btn" onClick={() => setSpacing(tie.spacing - step)} aria-label="ลดระยะ">
          −
        </button>
        <span className="spacing-val">{fmt(tie.spacing, 1)} ซม.</span>
        <button type="button" className="btn" onClick={() => setSpacing(tie.spacing + step)} aria-label="เพิ่มระยะ">
          +
        </button>
      </div>
      <p className="popover-hint">
        {spiral
          ? `ต้องการ ρs ≥ ${fmt(analysis.spiralReq!.rhoMin, 4)}, ช่องว่าง 2.5–7.5 ซม. → pitch ${fmt(analysis.spiralReq!.pitchMin, 1)}–${fmt(analysis.spiralReq!.pitchMax, 1)} ซม.`
          : `ต้องการ ≤ ${fmt(analysis.tie!.sMax, 1)} ซม. (16db, 48dt, ด้านแคบ) — เหล็กถ่าง ${analysis.geom.crossTies.length} ชุด จัดอัตโนมัติ`}
      </p>
      {suggested !== tie.spacing && (
        <button type="button" className="btn small" onClick={() => setSpacing(suggested)}>
          ใช้ระยะที่คำนวณได้ {fmt(suggested, 1)} ซม.
        </button>
      )}
    </>
  );
}
