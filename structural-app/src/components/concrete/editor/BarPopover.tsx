import { useState } from 'react';
import {
  addBar,
  addLayer,
  addSideRow,
  removeBar,
  removeSideRow,
  setBarSize,
  setSideRowSize,
} from '@/engine/concrete/layoutOps';
import { MAIN_BAR_SIZES, REBARS, type BarName } from '@/engine/concrete/rebar';
import type { SectionLayout } from '@/engine/concrete/types';
import type { DrawingPick } from '../drawing/drawingModel';

export type ApplyEdit = (fn: (layout: SectionLayout) => SectionLayout) => void;

export function SizeChips({ sizes, value, onPick }: { sizes: BarName[]; value: BarName; onPick: (s: BarName) => void }) {
  return (
    <div className="chips">
      {sizes.map((s) => (
        <button key={s} type="button" className={`chip${s === value ? ' active' : ''}`} onClick={() => onPick(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}

interface Props {
  layout: SectionLayout;
  pick: Extract<DrawingPick, { kind: 'bar' | 'side' }>;
  apply: ApplyEdit;
  close: () => void;
}

export function BarPopover({ layout, pick, apply, close }: Props) {
  const [whole, setWhole] = useState(false);

  if (pick.kind === 'side') {
    const index = layout.side.findIndex((r) => r.id === pick.rowId);
    if (index < 0) return null;
    const row = layout.side[index];
    return (
      <>
        <div className="popover-title">
          เหล็กข้าง แถวที่ {index + 1}/{layout.side.length} <small>(ซ้าย + ขวา)</small>
        </div>
        <SizeChips sizes={MAIN_BAR_SIZES} value={row.size} onPick={(s) => apply((l) => setSideRowSize(l, row.id, s, whole))} />
        <label className="check">
          <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> เปลี่ยนทุกแถว
        </label>
        <div className="popover-actions">
          <button type="button" className="btn" onClick={() => apply((l) => addSideRow(l, row.size))}>
            + เพิ่มแถว
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              apply((l) => removeSideRow(l, row.id));
              close();
            }}
          >
            ลบแถวนี้
          </button>
        </div>
      </>
    );
  }

  const layers = layout[pick.face];
  const layerIndex = layers.findIndex((l) => l.id === pick.layerId);
  const layer = layers[layerIndex];
  const barIndex = layer ? layer.bars.findIndex((b) => b.id === pick.barId) : -1;
  if (!layer || barIndex < 0) return null;
  const bar = layer.bars[barIndex];
  const layerArea = layer.bars.reduce((s, b) => s + REBARS[b.size].area, 0);

  return (
    <>
      <div className="popover-title">
        เหล็ก{pick.face === 'top' ? 'บน' : 'ล่าง'} ชั้นที่ {layerIndex + 1} — เส้นที่ {barIndex + 1}/{layer.bars.length}
        <small> (ชั้นนี้ {layerArea.toFixed(2)} ซม.²)</small>
      </div>
      <SizeChips
        sizes={MAIN_BAR_SIZES}
        value={bar.size}
        onPick={(s) => apply((l) => setBarSize(l, pick.face, layer.id, bar.id, s, whole))}
      />
      <label className="check">
        <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> เปลี่ยนทั้งชั้น
      </label>
      <div className="popover-actions">
        <button type="button" className="btn" onClick={() => apply((l) => addBar(l, pick.face, layer.id, bar.size))}>
          + เพิ่มเส้นในชั้นนี้
        </button>
        <button type="button" className="btn" onClick={() => apply((l) => addLayer(l, pick.face, bar.size))}>
          + เพิ่มชั้นใหม่
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            apply((l) => removeBar(l, pick.face, layer.id, bar.id));
            close();
          }}
        >
          ลบเส้นนี้
        </button>
      </div>
    </>
  );
}
