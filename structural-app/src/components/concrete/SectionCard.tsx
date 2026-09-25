import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { SectionAnalysis } from '@/engine/concrete/design/sectionCheck';
import { addLayer, addSideRow } from '@/engine/concrete/layoutOps';
import type { BeamInput, SectionKey, SectionLayout } from '@/engine/concrete/types';
import { SectionDrawing } from './drawing/SectionDrawing';
import type { DrawingPick } from './drawing/drawingModel';
import { BarPopover, type ApplyEdit } from './editor/BarPopover';
import { StirrupPopover } from './editor/StirrupPopover';
import { SECTION_TITLES } from './labels';
import { CalcSteps } from './results/CalcSteps';
import { CheckTable } from './results/CheckTable';
import { StatusBadge } from './results/StatusBadge';

interface Props {
  sectionKey: SectionKey;
  input: BeamInput;
  layout: SectionLayout;
  analysis: SectionAnalysis;
  denom: number;
  edited: boolean;
  stirrupNote: string | null;
  /** การแก้เหล็กและออกแบบใหม่ของ store ที่หน้าตัดนี้สังกัด (คาน คสล. หรือคานรับพื้นยื่น) */
  editLayout: (key: SectionKey, fn: (layout: SectionLayout) => SectionLayout) => void;
  redesign: (key: SectionKey) => void;
}

interface Selection {
  pick: DrawingPick;
  x: number;
  y: number;
}

const POPOVER_WIDTH = 276;

function pickId(pick: DrawingPick): string {
  return pick.kind === 'bar' ? pick.barId : pick.kind === 'side' ? pick.rowId : 'stirrup';
}

export function SectionCard({
  sectionKey,
  input,
  layout,
  analysis,
  denom,
  edited,
  stirrupNote,
  editLayout,
  redesign,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const t = SECTION_TITLES[sectionKey];

  const apply: ApplyEdit = (fn) => editLayout(sectionKey, fn);
  const close = () => setSel(null);

  useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSel(null);
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSel(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [sel]);

  const openAt = (pick: DrawingPick, clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSel({ pick, x: clientX - rect.left, y: clientY - rect.top });
  };
  const onPick = (pick: DrawingPick, e: MouseEvent<SVGElement>) => openAt(pick, e.clientX, e.clientY);

  const openStirrup = () => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) openAt({ kind: 'stirrup' }, rect.right - POPOVER_WIDTH / 2, rect.top + 24);
  };

  const wrapWidth = wrapRef.current?.clientWidth ?? 600;
  const popoverStyle = sel
    ? { left: Math.max(8, Math.min(sel.x + 12, wrapWidth - POPOVER_WIDTH - 8)), top: Math.max(8, sel.y + 12) }
    : undefined;

  return (
    <section className="card section-card">
      <header className="section-head">
        <h2>
          {t.title}
          <small>
            {t.subtitle} ({t.moment})
          </small>
        </h2>
        <StatusBadge status={analysis.status} />
        {edited && <span className="tag">แก้ไขเอง</span>}
      </header>

      <div className="drawing-wrap" ref={wrapRef}>
        <SectionDrawing
          input={input}
          layout={layout}
          denom={denom}
          title={t.title}
          subtitle={t.subtitle}
          interactive
          selectedId={sel ? pickId(sel.pick) : null}
          onPick={onPick}
          onBackgroundClick={close}
        />
        {sel && (
          <div className="popover" style={popoverStyle} role="dialog" aria-label="แก้ไขเหล็ก">
            <button type="button" className="popover-close" onClick={close} aria-label="ปิด">
              ×
            </button>
            {sel.pick.kind === 'stirrup' ? (
              <StirrupPopover layout={layout} analysis={analysis} mainBar={input.mainBar} sMin={input.sMin} apply={apply} />
            ) : (
              <BarPopover key={pickId(sel.pick)} layout={layout} pick={sel.pick} apply={apply} close={close} />
            )}
          </div>
        )}
      </div>
      <p className="hint">คลิกที่เหล็ก ปลอก หรือป้ายชื่อ เพื่อเปลี่ยนขนาด / เพิ่ม / ลบ</p>

      <div className="toolbar">
        <button type="button" className="btn" onClick={() => apply((l) => addLayer(l, 'top', input.mainBar))}>
          + ชั้นเหล็กบน
        </button>
        <button type="button" className="btn" onClick={() => apply((l) => addLayer(l, 'bottom', input.mainBar))}>
          + ชั้นเหล็กล่าง
        </button>
        <button type="button" className="btn" onClick={() => apply((l) => addSideRow(l, input.mainBar))}>
          + เหล็กข้าง
        </button>
        <button type="button" className="btn" onClick={openStirrup}>
          ปลอก…
        </button>
        {edited && (
          <button type="button" className="btn accent" onClick={() => redesign(sectionKey)}>
            ↺ ออกแบบอัตโนมัติใหม่
          </button>
        )}
      </div>

      {stirrupNote && !edited && <div className="note warn">{stirrupNote}</div>}

      <CheckTable checks={analysis.checks} />

      <details className="steps-details">
        <summary>ขั้นตอนคำนวณ {t.title}</summary>
        <CalcSteps steps={analysis.steps} />
      </details>
    </section>
  );
}
