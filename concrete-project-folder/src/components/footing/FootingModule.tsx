import { useMemo, useState } from 'react';
import { ACI318_WSD_FOOTING } from '../../domain/codes/aci318Wsd';
import { analyzeFooting } from '../../domain/footing/analyzeFooting';
import { autoFootingLayout, footingDims } from '../../domain/footing/designFooting';
import type { BarDir } from '../../domain/footing/types';
import { validateFootingInput } from '../../domain/footing/validate';
import { fmt } from '../../domain/format';
import { toFootingProjectFile, useFootingStore } from '../../state/footingStore';
import { Topbar, downloadJson, type ViewMode } from '../Topbar';
import { usePopover } from '../editor/usePopover';
import { CalcSteps } from '../results/CalcSteps';
import { CheckTable } from '../results/CheckTable';
import { StatusBadge } from '../results/StatusBadge';
import { FootingPlan, FootingSection } from './FootingDrawings';
import { FootingInputPanel } from './FootingInputPanel';
import { FootingBarPopover, type ApplyFootingEdit } from './FootingPopover';
import { FootingSheet } from './FootingSheet';
import { POSITION_TH, barSetText, pickPlanScale, pickSectionScale, planTitle, sectionTitle, type FootingPick } from './footingDrawingModel';

const m2 = (cm: number) => fmt(cm / 100, 2);

export function FootingModule() {
  const input = useFootingStore((s) => s.input);
  const layout = useFootingStore((s) => s.layout);
  const edited = useFootingStore((s) => s.edited);
  const editLayout = useFootingStore((s) => s.editLayout);
  const redesign = useFootingStore((s) => s.redesign);
  const loadProject = useFootingStore((s) => s.loadProject);
  const resetProject = useFootingStore((s) => s.resetProject);
  const [view, setView] = useState<ViewMode>('design');
  const pop = usePopover<FootingPick>();

  const errors = useMemo(() => validateFootingInput(input), [input]);
  const dims = useMemo(() => (errors.length === 0 ? footingDims(input) : null), [errors, input]);
  const analysis = useMemo(() => (dims ? analyzeFooting(input, dims, layout) : null), [dims, input, layout]);
  const suggested = useMemo(() => (dims ? autoFootingLayout(input, dims) : null), [dims, input]);
  const planDenom = useMemo(() => (analysis ? pickPlanScale(input, analysis) : 50), [analysis, input]);
  const sectionDenom = useMemo(() => (analysis ? pickSectionScale(input, analysis) : 50), [analysis, input]);
  const apply: ApplyFootingEdit = (fn) => editLayout(fn);
  const selectedDir: BarDir | null = pop.sel ? pop.sel.pick.dir : null;
  const flush = input.position === 'edge' || input.position === 'corner';

  return (
    <>
      <div className="app-shell">
        <Topbar
          subtitle={`ฐานรากแผ่ — ${ACI318_WSD_FOOTING.label}`}
          view={view}
          onView={setView}
          onSave={() => downloadJson(`${input.footingName || 'footing'}.json`, toFootingProjectFile(useFootingStore.getState()))}
          onLoad={loadProject}
          onReset={resetProject}
          printDisabled={!analysis}
        />

        <div className="layout">
          <aside className="input-col card">
            <FootingInputPanel dims={dims} />
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
                      B × L × t <b>{m2(analysis.dims.B)} × {m2(analysis.dims.L)} × {m2(analysis.dims.t)}</b> ม.
                    </span>
                    <span>
                      qmax <b>{fmt(analysis.loads.pressure.qmax * 10, 2)}</b> / qa {fmt(input.qa, 2)} t/m²
                    </span>
                    <span>
                      ดินรับแรงดัน <b>{fmt(analysis.loads.pressure.contactRatio * 100, 0)}</b> %
                    </span>
                    <span>
                      X <b>{barSetText(analysis, 'x')}</b> · Y <b>{barSetText(analysis, 'y')}</b>
                    </span>
                  </div>
                </div>

                {flush && (
                  <div className="note info">
                    <span>
                      {POSITION_TH[input.position]}: ดินรับโมเมนต์จากการเยื้องศูนย์ทั้งหมด (ไม่มีคานยึด) — แรงดันดินไม่สม่ำเสมอ
                      ฐานรากจึงใหญ่กว่าฐานรากเสาศูนย์กลางที่รับแรงเท่ากัน
                    </span>
                  </div>
                )}

                {edited && (
                  <div className="note info">
                    <span>เหล็กเสริมแก้ไขเอง — เมื่อเปลี่ยนข้อมูลนำเข้า โปรแกรมจะตรวจสอบใหม่แต่ไม่จัดเหล็กใหม่ให้</span>
                    <button type="button" className="btn small" onClick={redesign}>
                      ↺ ออกแบบอัตโนมัติใหม่
                    </button>
                  </div>
                )}

                <div className="footing-grid">
                  <section className="card section-card">
                    <header className="section-head">
                      <h2>
                        {planTitle(input)}
                        <small>{POSITION_TH[input.position]}</small>
                      </h2>
                      <StatusBadge status={analysis.status} />
                      {edited && <span className="tag">แก้ไขเอง</span>}
                    </header>
                    <div className="drawing-wrap" ref={pop.wrapRef}>
                      <FootingPlan
                        input={input}
                        analysis={analysis}
                        denom={planDenom}
                        title={planTitle(input)}
                        interactive
                        selectedDir={selectedDir}
                        onPick={(pick, e) => pop.openAt(pick, e.clientX, e.clientY)}
                        onBackgroundClick={pop.close}
                      />
                      {pop.sel && suggested && (
                        <div className="popover" style={pop.style} role="dialog" aria-label="แก้ไขเหล็กฐานราก">
                          <button type="button" className="popover-close" onClick={pop.close} aria-label="ปิด">
                            ×
                          </button>
                          <FootingBarPopover
                            dir={pop.sel.pick.dir}
                            layout={layout}
                            analysis={analysis}
                            suggested={suggested[pop.sel.pick.dir]}
                            apply={apply}
                          />
                        </div>
                      )}
                    </div>
                    <p className="hint">คลิกที่เหล็กหรือป้ายชื่อ เพื่อเปลี่ยนขนาด / จำนวน — พื้นที่แรเงาคือส่วนที่ดินไม่รับแรงดัน</p>
                    <div className="toolbar">
                      <button type="button" className="btn" onClick={() => pop.openTopRight({ kind: 'bars', dir: 'x' })}>
                        เหล็กทิศ X…
                      </button>
                      <button type="button" className="btn" onClick={() => pop.openTopRight({ kind: 'bars', dir: 'y' })}>
                        เหล็กทิศ Y…
                      </button>
                      {edited && (
                        <button type="button" className="btn accent" onClick={redesign}>
                          ↺ ออกแบบอัตโนมัติใหม่
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="card sections-card">
                    {(['x', 'y'] as const).map((dir) => (
                      <div key={dir} className="drawing-wrap section-wrap">
                        <FootingSection input={input} analysis={analysis} denom={sectionDenom} dir={dir} title={sectionTitle(dir)} selectedDir={selectedDir} />
                      </div>
                    ))}
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
                  <FootingSheet input={input} analysis={analysis} planDenom={planDenom} sectionDenom={sectionDenom} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {analysis && (
        <div className="print-root">
          <FootingSheet input={input} analysis={analysis} planDenom={planDenom} sectionDenom={sectionDenom} />
        </div>
      )}
    </>
  );
}
