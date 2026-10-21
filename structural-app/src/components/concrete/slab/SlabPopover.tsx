import { useState, type FormEvent } from 'react';
import { ACI318_WSD_SLAB as K } from '@/engine/concrete/codes/aci318Wsd';
import type { BarDir } from '@/engine/concrete/footing/types';
import { cmToM, fmt } from '@/engine/concrete/format';
import { ALL_BAR_SIZES } from '@/engine/concrete/rebar';
import type { SlabAnalysis, SlabFaceDemand } from '@/engine/concrete/slab/analyzeSlab';
import { setExtra, setMesh, setRun, stepSpacing, toggleRun } from '@/engine/concrete/slab/layoutOps';
import type { BarRun, SlabLayout } from '@/engine/concrete/slab/types';
import type { Face } from '@/engine/concrete/types';
import { SizeChips } from '../editor/BarPopover';
import { rolePick, type DetailRole } from './slabDetailModel';

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
  /** พื้นวางบนดิน: แก้ตะแกรงสองทิศพร้อมกัน — demand เป็นของทิศที่ต้องการ As มากกว่า */
  mesh?: boolean;
}

/**
 * แก้เหล็กพื้นหนึ่งชุด
 *
 * ต่างจาก FootingBarPopover ตรงที่เหล็กพื้นระบุด้วย "ระยะเรียง" ไม่ใช่จำนวนเส้น
 * จึงเป็นปุ่มปรับระยะทีละ 2.5 ซม. แทนปุ่มเพิ่ม/ลดจำนวน
 */
export function SlabBarPopover({ face, dir, layout, demand, suggested, apply, mesh = false }: Props) {
  const run = layout[face][dir];
  const isMain = demand.Mdesign > 0;
  const edit = (patch: Partial<BarRun>) =>
    apply((l) => (mesh ? setMesh(l, patch) : setRun(l, face, dir, patch)));

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
            onClick={() =>
              suggested &&
              apply((l) =>
                mesh ? { ...l, bottom: { x: { ...suggested }, y: { ...suggested } } } : toggleRun(l, face, dir, suggested),
              )
            }
          >
            + เพิ่มเหล็ก {suggested ? `${suggested.size} @${cmToM(suggested.spacing)}` : ''}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="popover-title">
        {mesh ? 'เหล็กตะแกรง # (สองทิศ)' : `${FACE_TH[face]} ทิศ ${dir.toUpperCase()}`}
        <small>{mesh ? 'พื้นวางบนดิน — ขนาดและระยะเรียงเดียวกันทั้งสองทิศ' : isMain ? 'เหล็กรับโมเมนต์' : 'เหล็กกันร้าว / เหล็กกระจาย'}</small>
      </div>
      <div className="popover-sub">ขนาดเหล็ก</div>
      <SizeChips sizes={ALL_BAR_SIZES} value={run.size} onPick={(size) => edit({ size })} />

      <div className="popover-sub">ระยะเรียง</div>
      <SpacingControl
        key={run.spacing}
        spacing={run.spacing}
        max={Math.min(demand.sMax, K.maxSpacing)}
        onChange={(spacing) => edit({ spacing })}
      />

      <p className="popover-hint">
        As ต้องการ <strong>{fmt(demand.AsReq)}</strong> ใส่จริง <strong>{fmt(demand.AsProv)}</strong> ซม.²/ม.
        {mesh && ' (F·L·W/2fs ทิศที่แผ่นยาวกว่า)'}
        <br />
        ระยะเรียงไม่เกิน {fmt(demand.sMax, 1)} ซม.{' '}
        {mesh ? `(5h, ≤ ${K.maxSpacing} ซม. และไม่ห่างกว่าแบบขยาย GS)` : `(${isMain ? '3h' : '5h'} และ ≤ ${K.maxSpacing} ซม.)`}
      </p>

      <div className="popover-actions">
        {suggested && (
          <button
            type="button"
            className="btn accent"
            onClick={() => edit(suggested)}
          >
            ใช้ค่าที่คำนวณได้ {suggested.size} @{cmToM(suggested.spacing)}
          </button>
        )}
        {!isMain && !mesh && (
          <button type="button" className="btn danger" onClick={() => apply((l) => toggleRun(l, face, dir, run))}>
            เอาเหล็กชุดนี้ออก
          </button>
        )}
      </div>
    </>
  );
}

/**
 * ระยะเรียง: ปุ่ม −/+ เลื่อนทีละ 2.5 ซม. และช่องกรอกเป็นเมตร (ปัดทีละ 0.5 ซม. เช่น 0.165 ตามแบบ)
 * กด Enter หรือออกจากช่องจึงคำนวณใหม่ — ผู้เรียกใส่ key = ระยะปัจจุบัน ช่องกรอกจึงตามค่าใหม่เสมอ
 */
function SpacingControl({ spacing, max, onChange }: { spacing: number; max: number; onChange: (spacing: number) => void }) {
  const [text, setText] = useState(cmToM(spacing));
  const commit = (e?: FormEvent) => {
    e?.preventDefault();
    const v = Number(text) * 100;
    if (text.trim() !== '' && Number.isFinite(v) && v > 0 && Math.abs(v - spacing) > 1e-9) onChange(v);
    else setText(cmToM(spacing));
  };
  return (
    <form className="spacing-row" onSubmit={commit}>
      <button
        type="button"
        className="btn"
        disabled={spacing <= K.minSpacing}
        onClick={() => onChange(stepSpacing(spacing, false))}
        aria-label="ลดระยะเรียง"
      >
        −
      </button>
      <span className="field-input">
        <input
          type="number"
          inputMode="decimal"
          step={0.005}
          aria-label="ระยะเรียง (ม.)"
          value={text}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit()}
        />
        <span className="unit">ม.</span>
      </span>
      <button
        type="button"
        className="btn"
        disabled={spacing >= max}
        onClick={() => onChange(stepSpacing(spacing, true))}
        aria-label="เพิ่มระยะเรียง"
      >
        +
      </button>
    </form>
  );
}

/**
 * แก้เหล็กหนึ่งชุดในแบบขยายพื้น S1
 * - เสริมพิเศษ: แก้ทุกทิศที่มีคอม้าพร้อมกัน (พื้นสองทางใช้ชุดเดียวกันทั้งสองทิศ)
 * - คอม้าเว้นเส้น: บอกทั้ง As+ กลางช่วงและเหล็กบนที่ขอบ เพราะครึ่งหนึ่งงอขึ้นไปเป็นเหล็กบน
 * - ทิศตั้งฉาก: พื้นทางเดียวเป็นเหล็กกันร้าว พื้นสองทางเป็นคอม้าด้านยาว
 * เหล็กทุกชุดเป็นส่วนหนึ่งของแบบ จึงไม่มีปุ่มเอาออก
 */
export function SlabDetailPopover({ role, analysis, layout, suggested, apply }: {
  role: DetailRole;
  analysis: SlabAnalysis;
  layout: SlabLayout;
  /** ผลออกแบบอัตโนมัติ ใช้เป็นค่าตั้งต้นเมื่อเพิ่มเหล็กกลับเข้ามา */
  suggested: SlabLayout;
  apply: ApplySlabEdit;
}) {
  const detail = analysis.detail!;
  const { face, dir } = rolePick(role, analysis);
  const run = layout[face][dir];
  const proposal = suggested[face][dir];
  const isExtra = role === 'extra';
  const cranked = detail.cranked.includes(dir);
  const D = dir.toUpperCase();
  const m = (cm: number) => fmt(cm / 100, 2);
  const edit = (patch: Partial<BarRun>) =>
    apply((l) => (isExtra ? setExtra(l, detail.cranked, patch) : setRun(l, face, dir, patch)));

  const title = isExtra
    ? 'เหล็กเสริมพิเศษ'
    : cranked
      ? `เหล็กคอม้าเว้นเส้น ทิศ ${D}${role === 'cross' ? ' (ด้านยาว)' : ''}`
      : `เหล็กกันร้าว ทิศ ${D}`;
  const sub = isExtra
    ? `ยื่น L/4 = ${m(detail.cutoff)} ม.${detail.cranked.length > 1 ? ' · ใช้ทั้งสองทิศ' : ''}`
    : cranked
      ? `งอขึ้นเว้นเส้นที่ L/5 = ${m(detail.bend)} ม.`
      : 'จุดในรูป';

  if (!run) {
    return (
      <>
        <div className="popover-title">
          {title} <small>ยังไม่มีเหล็กชุดนี้</small>
        </div>
        <div className="popover-actions">
          <button
            type="button"
            className="btn accent"
            disabled={!proposal}
            onClick={() =>
              proposal && apply((l) => (isExtra ? setExtra(l, detail.cranked, {}, proposal) : toggleRun(l, face, dir, proposal)))
            }
          >
            + เพิ่มเหล็ก {proposal ? `${proposal.size} @${cmToM(proposal.spacing)}` : ''}
          </button>
        </div>
      </>
    );
  }

  /** As ที่ต้องการกับที่ใส่จริงของแต่ละตำแหน่งที่เหล็กชุดนี้มีส่วนรับ */
  const asLine = (label: string, f: SlabFaceDemand) => (
    <>
      {label} ต้องการ <strong>{fmt(f.AsReq)}</strong> ใส่จริง <strong>{fmt(f.AsProv)}</strong> ซม.²/ม.
      <br />
    </>
  );
  const topLine = (d: BarDir) =>
    analysis[d].top.Mdesign > 0
      ? asLine(`As− ที่ขอบ ทิศ ${d.toUpperCase()} (คอม้า/2 + เสริมพิเศษ)`, analysis[d].top)
      : <>ทิศ {d.toUpperCase()} ไม่มีโมเมนต์ลบที่ขอบ — เสริมตามแบบ<br /></>;
  const sMax = isExtra ? K.extraMaxSpacing : Math.min(analysis[dir].bottom.sMax, K.maxSpacing);

  return (
    <>
      <div className="popover-title">
        {title} <small>{sub}</small>
      </div>
      <div className="popover-sub">ขนาดเหล็ก</div>
      <SizeChips sizes={ALL_BAR_SIZES} value={run.size} onPick={(size) => edit({ size })} />

      <div className="popover-sub">ระยะเรียง</div>
      <SpacingControl key={run.spacing} spacing={run.spacing} max={sMax} onChange={(spacing) => edit({ spacing })} />

      <p className="popover-hint">
        {isExtra && detail.cranked.map((d) => <span key={d}>{topLine(d)}</span>)}
        {!isExtra && cranked && (
          <>
            {asLine('As+ กลางช่วง', analysis[dir].bottom)}
            {topLine(dir)}
          </>
        )}
        {!isExtra && !cranked && asLine('As (ρ·b·t)', analysis[dir].bottom)}
        {isExtra
          ? `ระยะเรียงเฉลี่ยเหล็กบนที่ขอบ (คอม้าที่งอขึ้นสลับเสริมพิเศษ) ไม่เกิน ${fmt(analysis[dir].top.sMax, 1)} ซม.`
          : `ระยะเรียงไม่เกิน ${fmt(analysis[dir].bottom.sMax, 1)} ซม. (${cranked ? '3h' : '5h'} และ ≤ ${K.maxSpacing} ซม.)`}
      </p>

      {proposal && (
        <div className="popover-actions">
          <button type="button" className="btn accent" onClick={() => edit(proposal)}>
            ใช้ค่าที่คำนวณได้ {proposal.size} @{cmToM(proposal.spacing)}
          </button>
        </div>
      )}
    </>
  );
}
