import { useMemo, useState } from 'react';
import { ACI318_WSD_PILECAP } from '../../domain/codes/aci318Wsd';
import type { BarDir } from '../../domain/footing/types';
import { fmt } from '../../domain/format';
import { analyzePileCap, type PileCapAnalysis } from '../../domain/pilecap/analyzePileCap';
import { autoPileCapLayout, pileCapDesign } from '../../domain/pilecap/designPileCap';
import { validatePileCapInput } from '../../domain/pilecap/validate';
import { toPileCapProjectFile, usePileCapStore } from '../../state/pileCapStore';
import { Topbar, downloadJson, type ViewMode } from '../Topbar';
import { usePopover } from '../editor/usePopover';
import { FootingBarPopover } from '../footing/FootingPopover';
import { NumberInput } from '../form/Fields';
import { CalcSteps } from '../results/CalcSteps';
import { CheckTable } from '../results/CheckTable';
import { StatusBadge } from '../results/StatusBadge';
import { PileCapInputPanel } from './PileCapInputPanel';
import { PileCapPlan, PileCapSection } from './PileCapDrawings';
import { barSetText, pickDrawingScale, planTitle, type PileCapPick } from './pileCapDrawingModel';
import { PileCapSheet } from './PileCapSheet';

const m2 = (cm: number) => fmt(cm / 100, 2);

function PileTable({ analysis }: { analysis: PileCapAnalysis }) {
  const offsets = usePileCapStore((s) => s.input.offsets);
  const setOffset = usePileCapStore((s) => s.setOffset);
  const setInput = usePileCapStore((s) => s.setInput);
  const { nominal, column } = analysis.loads.piles;
  const { service, structural } = analysis.loads;
  const { Pa, Ta } = analysis.pile;
  const moved = offsets.slice(0, nominal.length).some((o) => o.dx !== 0 || o.dy !== 0);

  return (
    <section className="card">
      <header className="section-head">
        <h2>
          เสาเข็ม
          <small>ตำแหน่งจริงหลังตอก และแรงในเข็ม</small>
        </h2>
      </header>
      <div className="table-scroll">
        <table className="checks pile-table">
          <thead>
            <tr>
              <th>ต้น</th>
              <th className="num">x ตามแบบ (ม.)</th>
              <th className="num">y ตามแบบ (ม.)</th>
              <th className="num">เยื้อง dx (ซม.)</th>
              <th className="num">เยื้อง dy (ซม.)</th>
              <th className="num">R ใช้งาน (ตัน)</th>
              <th className="num">R ออกแบบฐาน (ตัน)</th>
            </tr>
          </thead>
          <tbody>
            {nominal.map((p, i) => {
              const R = service.R[i];
              const status = R > Pa * (1 + 1e-6) || R < -Ta - 1e-6 ? 'fail' : '';
              return (
                <tr key={i} className={status}>
                  <td>{i + 1}</td>
                  <td className="num">{m2(p.x)}</td>
                  <td className="num">{m2(p.y)}</td>
                  <td className="num">
                    <NumberInput value={offsets[i].dx} step={1} ariaLabel={`เข็มต้นที่ ${i + 1} เยื้อง dx`} onChange={(dx) => setOffset(i, { dx })} />
                  </td>
                  <td className="num">
                    <NumberInput value={offsets[i].dy} step={1} ariaLabel={`เข็มต้นที่ ${i + 1} เยื้อง dy`} onChange={(dy) => setOffset(i, { dy })} />
                  </td>
                  <td className="num">
                    <b>{fmt(R / 1000, 2)}</b>
                  </td>
                  <td className="num">{fmt(structural.R[i] / 1000, 2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        กรอกระยะเยื้องของเข็มที่ตอกจริง (บวก = ขวา/บน) เพื่อตรวจสอบฐานรากเข็มเยื้องศูนย์ — ศูนย์ถ่วงกลุ่มเข็มจริงอยู่ห่างจากเสา{' '}
        <b>
          {m2(column.x - service.xg)}, {m2(column.y - service.yg)}
        </b>{' '}
        ม. — R ใช้งาน = รวมน้ำหนักฐานรากและดินถม (เทียบ Pa {fmt(Pa / 1000, 2)} ตัน)
      </p>
      {moved && (
        <div className="toolbar">
          <button
            type="button"
            className="btn"
            onClick={() => setInput({ offsets: offsets.map(() => ({ dx: 0, dy: 0 })) })}
          >
            ล้างระยะเยื้องเข็มทั้งหมด
          </button>
        </div>
      )}
    </section>
  );
}

export function PileCapModule() {
  const input = usePileCapStore((s) => s.input);
  const layout = usePileCapStore((s) => s.layout);
  const edited = usePileCapStore((s) => s.edited);
  const editLayout = usePileCapStore((s) => s.editLayout);
  const redesign = usePileCapStore((s) => s.redesign);
  const loadProject = usePileCapStore((s) => s.loadProject);
  const resetProject = usePileCapStore((s) => s.resetProject);
  const [view, setView] = useState<ViewMode>('design');
  const pop = usePopover<PileCapPick>();

  const errors = useMemo(() => validatePileCapInput(input), [input]);
  const design = useMemo(() => (errors.length === 0 ? pileCapDesign(input) : null), [errors, input]);
  const analysis = useMemo(() => (design ? analyzePileCap(input, design.arrangement, design.t, layout) : null), [design, input, layout]);
  const suggested = useMemo(() => (design ? autoPileCapLayout(input, design.arrangement, design.t) : null), [design, input]);
  const denom = useMemo(() => (analysis ? pickDrawingScale(input, analysis) : 50), [analysis, input]);
  const selectedDir: BarDir | null = pop.sel ? pop.sel.pick.dir : null;
  const eccentric = analysis && Math.hypot(analysis.loads.piles.column.x - analysis.loads.service.xg, analysis.loads.piles.column.y - analysis.loads.service.yg) > 0.05;
  const title = planTitle(input);

  return (
    <>
      <div className="app-shell">
        <Topbar
          subtitle={`ฐานรากเสาเข็ม — ${ACI318_WSD_PILECAP.label}`}
          view={view}
          onView={setView}
          onSave={() => downloadJson(`${input.capName || 'pilecap'}.json`, toPileCapProjectFile(usePileCapStore.getState()))}
          onLoad={loadProject}
          onReset={resetProject}
          printDisabled={!analysis}
        />

        <div className="layout">
          <aside className="input-col card">
            <PileCapInputPanel design={design} />
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
                      เข็ม <b>{analysis.loads.piles.nominal.length}</b> ต้น
                    </span>
                    <span>
                      Bx × By × t <b>{m2(analysis.dims.B)} × {m2(analysis.dims.L)} × {m2(analysis.dims.t)}</b> ม.
                    </span>
                    <span>
                      Rmax <b>{fmt(analysis.pile.Rmax / 1000, 2)}</b> / Pa {fmt(input.pileCapacity, 2)} ตัน
                    </span>
                    <span>
                      X <b>{barSetText(analysis, 'x')}</b> · Y <b>{barSetText(analysis, 'y')}</b>
                    </span>
                  </div>
                </div>

                {eccentric && (
                  <div className="note info">
                    <span>
                      เยื้องศูนย์: แรงในเข็มไม่เท่ากัน คำนวณแบบฐานรากแข็ง R = N/n ± My·x/Σx² ± Mx·y/Σy² รอบศูนย์ถ่วงกลุ่มเข็มจริง
                      (รวมโมเมนต์จากการเยื้อง P·e) — ไม่มีคานยึด
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
                        {title}
                        <small>{analysis.loads.piles.nominal.length} ต้น</small>
                      </h2>
                      <StatusBadge status={analysis.status} />
                      {edited && <span className="tag">แก้ไขเอง</span>}
                    </header>
                    <div className="drawing-wrap" ref={pop.wrapRef}>
                      <PileCapPlan
                        input={input}
                        analysis={analysis}
                        denom={denom}
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
                            apply={(fn) => editLayout(fn)}
                          />
                        </div>
                      )}
                    </div>
                    <p className="hint">คลิกที่เหล็กหรือรายการเหล็กใต้รูป เพื่อเปลี่ยนขนาด / จำนวน — กากบาทคือตำแหน่งเข็มตามแบบ เมื่อเข็มเยื้อง</p>
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
                        <PileCapSection input={input} analysis={analysis} denom={denom} dir={dir} selectedDir={selectedDir} />
                      </div>
                    ))}
                  </section>
                </div>

                <PileTable analysis={analysis} />

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
                  <PileCapSheet input={input} analysis={analysis} denom={denom} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {analysis && (
        <div className="print-root">
          <PileCapSheet input={input} analysis={analysis} denom={denom} />
        </div>
      )}
    </>
  );
}
