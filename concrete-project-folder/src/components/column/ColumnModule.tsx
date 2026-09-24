import { useMemo, useState } from 'react';
import { ACI318_WSD_COLUMN } from '../../domain/codes/aci318Wsd';
import { analyzeColumn, METHOD_TH } from '../../domain/column/analyzeColumn';
import { addColumnBar } from '../../domain/column/layoutOps';
import { validateColumnInput } from '../../domain/column/validate';
import { fmt } from '../../domain/format';
import { toColumnProjectFile, useColumnStore } from '../../state/columnStore';
import { Topbar, downloadJson, type ViewMode } from '../Topbar';
import { usePopover } from '../editor/usePopover';
import { CalcSteps } from '../results/CalcSteps';
import { CheckTable } from '../results/CheckTable';
import { StatusBadge } from '../results/StatusBadge';
import { ColumnDrawing } from './ColumnDrawing';
import { ColumnInputPanel } from './ColumnInputPanel';
import { ColumnBarPopover, TiePopover, type ApplyColumnEdit } from './ColumnPopovers';
import { ColumnSheet } from './ColumnSheet';
import { InteractionChart } from './InteractionChart';
import { pickColumnScale, type ColumnPick } from './columnDrawingModel';

export function columnTitles(columnName: string, shape: 'rect' | 'circle') {
  return {
    title: `SECTION ${columnName || 'C1'}`,
    subtitle: shape === 'rect' ? 'เสาปลอกเดี่ยว' : 'เสาปลอกเกลียว',
  };
}

export function ColumnModule() {
  const input = useColumnStore((s) => s.input);
  const layout = useColumnStore((s) => s.layout);
  const edited = useColumnStore((s) => s.edited);
  const editLayout = useColumnStore((s) => s.editLayout);
  const redesign = useColumnStore((s) => s.redesign);
  const loadProject = useColumnStore((s) => s.loadProject);
  const resetProject = useColumnStore((s) => s.resetProject);
  const [view, setView] = useState<ViewMode>('design');
  const pop = usePopover<ColumnPick>();

  const errors = useMemo(() => validateColumnInput(input), [input]);
  const valid = errors.length === 0 && layout.kind === input.shape;
  const analysis = useMemo(() => (valid ? analyzeColumn(input, layout) : null), [valid, input, layout]);
  const { title, subtitle } = columnTitles(input.columnName, input.shape);
  const denom = useMemo(() => (valid ? pickColumnScale(input, layout, title) : 10), [valid, input, layout, title]);
  const apply: ApplyColumnEdit = (fn) => editLayout(fn);
  const selectedId = pop.sel ? (pop.sel.pick.kind === 'bar' ? pop.sel.pick.barId : 'tie') : null;

  return (
    <>
      <div className="app-shell">
        <Topbar
          subtitle={`เสา — ${ACI318_WSD_COLUMN.label}`}
          view={view}
          onView={setView}
          onSave={() => downloadJson(`${input.columnName || 'column'}.json`, toColumnProjectFile(useColumnStore.getState()))}
          onLoad={loadProject}
          onReset={resetProject}
          printDisabled={!analysis}
        />

        <div className="layout">
          <aside className="input-col card">
            <ColumnInputPanel />
          </aside>

          <main className="main-col">
            {errors.length > 0 && (
              <div className="card errors">
                <strong>ข้อมูลไม่ครบ / ไม่ถูกต้อง</strong>
                <ul>
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {analysis && view === 'design' && (
              <>
                <div className="card summary">
                  <div className="summary-status">
                    ผลรวม <StatusBadge status={analysis.status} />
                  </div>
                  <div className="params">
                    <span>
                      อัตราส่วนใช้งาน <b>{Number.isFinite(analysis.utilization) ? fmt(analysis.utilization, 2) : '—'}</b> ({METHOD_TH[analysis.method]})
                    </span>
                    <span>
                      P ยอมให้ <b>{fmt(analysis.curveX.Pmax / 1000, 2)}</b> ตัน
                    </span>
                    <span>
                      ρg <b>{fmt(analysis.rho * 100)}</b> %
                    </span>
                    <span>
                      kLu/r <b>{fmt(analysis.slender.x.ratio, 1)}</b> / <b>{fmt(analysis.slender.y.ratio, 1)}</b>
                      {(analysis.slender.x.slender || analysis.slender.y.slender) && ' (เสายาว)'}
                    </span>
                  </div>
                </div>

                {edited && (
                  <div className="note info">
                    <span>หน้าตัดเสาแก้ไขเอง — เมื่อเปลี่ยนข้อมูลนำเข้า โปรแกรมจะตรวจสอบใหม่แต่ไม่จัดเหล็กใหม่ให้</span>
                    <button type="button" className="btn small" onClick={redesign}>
                      ↺ ออกแบบอัตโนมัติใหม่
                    </button>
                  </div>
                )}

                <div className="column-grid">
                  <section className="card section-card">
                    <header className="section-head">
                      <h2>
                        {title}
                        <small>{subtitle}</small>
                      </h2>
                      <StatusBadge status={analysis.status} />
                      {edited && <span className="tag">แก้ไขเอง</span>}
                    </header>
                    <div className="drawing-wrap" ref={pop.wrapRef}>
                      <ColumnDrawing
                        input={input}
                        layout={layout}
                        denom={denom}
                        title={title}
                        subtitle={subtitle}
                        interactive
                        selectedId={selectedId}
                        onPick={(pick, e) => pop.openAt(pick, e.clientX, e.clientY)}
                        onBackgroundClick={pop.close}
                      />
                      {pop.sel && (
                        <div className="popover" style={pop.style} role="dialog" aria-label="แก้ไขเหล็กเสา">
                          <button type="button" className="popover-close" onClick={pop.close} aria-label="ปิด">
                            ×
                          </button>
                          {pop.sel.pick.kind === 'bar' ? (
                            <ColumnBarPopover key={pop.sel.pick.barId} layout={layout} barId={pop.sel.pick.barId} apply={apply} close={pop.close} />
                          ) : (
                            <TiePopover layout={layout} analysis={analysis} apply={apply} />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="hint">คลิกที่เหล็ก ปลอก หรือป้ายชื่อ เพื่อเปลี่ยนขนาด / เพิ่ม / ลบ</p>
                    <div className="toolbar">
                      {layout.kind === 'rect' ? (
                        <>
                          <button type="button" className="btn" onClick={() => apply((l) => addColumnBar(l, 'top', input.mainBar))}>
                            + เหล็กด้าน b (บน/ล่าง)
                          </button>
                          <button type="button" className="btn" onClick={() => apply((l) => addColumnBar(l, 'left', input.mainBar))}>
                            + เหล็กด้าน h (ซ้าย/ขวา)
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn" onClick={() => apply((l) => addColumnBar(l, 'ring', input.mainBar))}>
                          + เพิ่มเหล็ก
                        </button>
                      )}
                      <button type="button" className="btn" onClick={() => pop.openTopRight({ kind: 'tie' })}>
                        {layout.kind === 'rect' ? 'ปลอก…' : 'เกลียว…'}
                      </button>
                      {edited && (
                        <button type="button" className="btn accent" onClick={redesign}>
                          ↺ ออกแบบอัตโนมัติใหม่
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="card">
                    <h2 className="card-title">แผนภาพ P–M (กำลังยอมให้ 0.4φ)</h2>
                    <InteractionChart analysis={analysis} P={input.P} />
                    <p className="hint">
                      จุดแรงใช้งานใช้โมเมนต์หลังขยายผลความชะลูด
                      {analysis.method === 'bresler' || analysis.method === 'contour'
                        ? ` — แรงสองแกนตรวจด้วยวิธี ${METHOD_TH[analysis.method]}`
                        : ''}
                    </p>
                  </section>
                </div>

                <section className="card">
                  <CheckTable checks={analysis.checks} />
                  <details className="steps-details">
                    <summary>ขั้นตอนคำนวณ</summary>
                    <CalcSteps steps={analysis.steps} />
                  </details>
                </section>
              </>
            )}

            {analysis && view === 'sheet' && (
              <div className="sheet-preview">
                <div className="sheet-page">
                  <ColumnSheet input={input} layout={layout} analysis={analysis} denom={denom} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {analysis && (
        <div className="print-root">
          <ColumnSheet input={input} layout={layout} analysis={analysis} denom={denom} />
        </div>
      )}
    </>
  );
}
