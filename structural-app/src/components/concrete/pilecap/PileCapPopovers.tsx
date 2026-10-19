import { useState, type FormEvent } from 'react';
import { ACI318_WSD_PILECAP as K } from '@/engine/concrete/codes/aci318Wsd';
import { cmToM, fmt } from '@/engine/concrete/format';
import type { CageAnalysis } from '@/engine/concrete/pilecap/cage';
import type { PileCapCage, PileCapDims, PileCapInput } from '@/engine/concrete/pilecap/types';
import { validatePileCapInput } from '@/engine/concrete/pilecap/validate';
import { MAIN_BAR_SIZES, STIRRUP_BAR_SIZES } from '@/engine/concrete/rebar';
import { SizeChips } from '../editor/BarPopover';
import type { DimPick } from './pileCapDrawingModel';
import { changesSize, DIM_LABEL, dimEditPatch } from './pileCapEdits';

function hintOf(pick: DimPick, input: PileCapInput, single: boolean): string {
  switch (pick.key) {
    case 'B':
    case 'L':
      return 'กำหนดขนาดฐานรากเอง — กลุ่มเข็มอยู่กลางฐาน';
    case 'edgeX':
    case 'edgeY':
      return 'กำหนดขนาดฐานรากเอง — ขยาย/ลดเท่ากันทั้งสองข้าง';
    case 'spacingX':
    case 'spacingY':
      return pick.ratio !== undefined && Math.abs(pick.ratio - 1) > 1e-3
        ? `ช่วงนี้ = ${fmt(pick.ratio, 3)}·s — เปลี่ยนระยะห่างเข็ม s (ตอนนี้ ${cmToM(input.spacing)} ม.) ตามสัดส่วน`
        : 'เปลี่ยนระยะห่างเข็ม s ทั้งกลุ่ม';
    case 't':
      return 'กำหนดความหนาเอง';
    case 'embed':
      return single ? 'เข็มต้นเดียว: หัวเข็มฝังอยู่ในกรงเหล็กยืน' : 'เข็มกลุ่ม: ต้องน้อยกว่าระยะหุ้ม (เหล็กล่างวางเหนือหัวเข็ม)';
    case 'lean':
    case 'sand':
      return 'ใช้เขียนแบบ ไม่มีผลต่อการคำนวณ';
    default:
      return 'ระยะจากศูนย์ถ่วงกลุ่มเข็มถึงศูนย์เสา';
  }
}

/** แก้ระยะจากการแตะตัวเลขบอกขนาดบนรูป — กรอกเป็นเมตรตามที่เขียนในแบบ กด Enter หรือ "ตกลง" จึงคำนวณใหม่ */
export function PileCapDimPopover({ pick, input, dims, single, apply }: {
  pick: DimPick;
  input: PileCapInput;
  dims: PileCapDims;
  single: boolean;
  apply: (patch: Partial<PileCapInput>) => void;
}) {
  const [text, setText] = useState(cmToM(pick.value));
  const v = Number(text) * 100;
  const valid = text.trim() !== '' && Number.isFinite(v);
  const patch = valid ? dimEditPatch(input, dims, pick, v, single) : null;
  const errors = patch ? validatePileCapInput({ ...input, ...patch }) : ['กรุณากรอกตัวเลข'];
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (patch && errors.length === 0) apply(patch);
  };

  return (
    <form onSubmit={submit}>
      <div className="popover-title">{DIM_LABEL[pick.key]}</div>
      <div className="spacing-row">
        <span className="field-input">
          <input
            type="number"
            inputMode="decimal"
            step={0.05}
            autoFocus
            aria-label={DIM_LABEL[pick.key]}
            value={text}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setText(e.target.value)}
          />
          <span className="unit">ม.</span>
        </span>
        <button type="submit" className="btn accent small" disabled={errors.length > 0}>
          ตกลง
        </button>
      </div>
      {valid && errors.length > 0 && <p className="popover-hint"><strong>{errors[0]}</strong></p>}
      <p className="popover-hint">{hintOf(pick, input, single)}</p>
      {((changesSize(pick.key) && input.sizeMode === 'manual') || (pick.key === 't' && input.thicknessMode === 'manual')) && (
        <div className="popover-actions">
          <button
            type="button"
            className="btn small"
            onClick={() => apply(pick.key === 't' ? { thicknessMode: 'auto' } : { sizeMode: 'auto' })}
          >
            {pick.key === 't' ? 'ใช้ความหนาอัตโนมัติ' : 'ใช้ขนาดอัตโนมัติ (กรอบเข็ม + ระยะขอบ)'}
          </button>
        </div>
      )}
    </form>
  );
}

const TIE_STEP = 2.5;

/** แก้เหล็กฐานรากเข็มต้นเดียว: เหล็กยืน 8 เส้น และปลอก 2 ชุดต่อชั้น */
export function PileCapCagePopover({ cage, analysis, suggested, apply }: {
  cage: PileCapCage;
  analysis: CageAnalysis;
  suggested: PileCapCage;
  apply: (fn: (cage: PileCapCage) => PileCapCage) => void;
}) {
  const spacing = (delta: number) => apply((c) => ({ ...c, tieSpacing: Math.min(30, Math.max(5, c.tieSpacing + delta)) }));
  const same = suggested.size === cage.size && suggested.tie === cage.tie && suggested.tieSpacing === cage.tieSpacing;
  return (
    <>
      <div className="popover-title">
        เหล็กเสริมเข็มต้นเดียว <small>(ตามแบบมาตรฐาน)</small>
      </div>
      <div className="popover-sub">เหล็กยืน {K.cageBars} เส้น (มุม + กลางด้าน)</div>
      <SizeChips sizes={MAIN_BAR_SIZES} value={cage.size} onPick={(size) => apply((c) => ({ ...c, size }))} />
      <div className="popover-sub">ปลอกรอบนอก + ปลอกข้าวหลามตัด (2ป)</div>
      <SizeChips sizes={STIRRUP_BAR_SIZES} value={cage.tie} onPick={(tie) => apply((c) => ({ ...c, tie }))} />
      <div className="spacing-row">
        <button type="button" className="btn" onClick={() => spacing(-TIE_STEP)} aria-label="ลดระยะเรียงปลอก" disabled={cage.tieSpacing <= 5}>
          −
        </button>
        <span className="spacing-val">@ {cmToM(cage.tieSpacing)} ม.</span>
        <button type="button" className="btn" onClick={() => spacing(TIE_STEP)} aria-label="เพิ่มระยะเรียงปลอก" disabled={cage.tieSpacing >= 30}>
          +
        </button>
      </div>
      <p className="popover-hint">
        เหล็กยืน As ≥ {fmt(analysis.AsVReq)} ซม.² (ใส่ {fmt(analysis.AsV)}) — ปลอก As ต่อทิศ ≥ {fmt(analysis.AsTieReq)} (ใส่ {fmt(analysis.AsTie)}),
        ระยะเรียง ≤ {fmt(analysis.tieSMax, 1)} ซม.
      </p>
      {!same && (
        <div className="popover-actions">
          <button type="button" className="btn small" onClick={() => apply(() => suggested)}>
            ใช้ค่าที่คำนวณได้ {K.cageBars}-{suggested.size}, 2ป {suggested.tie} @{cmToM(suggested.tieSpacing)}
          </button>
        </div>
      )}
    </>
  );
}
