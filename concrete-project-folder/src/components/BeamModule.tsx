import { useMemo, useState } from 'react';
import { ACI318_WSD } from '../domain/codes/aci318Wsd';
import { analyzeBeam } from '../domain/design/designBeam';
import { worstStatus } from '../domain/design/sectionCheck';
import { fmt } from '../domain/format';
import type { SectionKey } from '../domain/types';
import { validateInput } from '../domain/validate';
import { toProjectFile, useStore } from '../state/store';
import { InputPanel } from './InputPanel/InputPanel';
import { SectionCard } from './SectionCard';
import { Topbar, downloadJson, type ViewMode } from './Topbar';
import { pickScale } from './drawing/drawingModel';
import { PrintSheet } from './print/PrintSheet';
import { CalcSteps } from './results/CalcSteps';
import { CheckTable } from './results/CheckTable';
import { StatusBadge } from './results/StatusBadge';

export function BeamModule() {
  const input = useStore((s) => s.input);
  const layouts = useStore((s) => s.layouts);
  const edited = useStore((s) => s.edited);
  const redesign = useStore((s) => s.redesign);
  const loadProject = useStore((s) => s.loadProject);
  const resetProject = useStore((s) => s.resetProject);
  const [view, setView] = useState<ViewMode>('design');

  const errors = useMemo(() => validateInput(input), [input]);
  const analysis = useMemo(() => (errors.length ? null : analyzeBeam(input, layouts)), [errors, input, layouts]);
  const denom = useMemo(() => (errors.length ? 10 : pickScale(input, layouts)), [errors, input, layouts]);

  const overall = analysis ? worstStatus([...analysis.A.checks, ...analysis.B.checks, ...analysis.beamChecks]) : null;
  const keys: SectionKey[] = ['A', 'B'];

  return (
    <>
      <div className="app-shell">
        <Topbar
          subtitle={`คาน — ${ACI318_WSD.label}`}
          view={view}
          onView={setView}
          onSave={() => downloadJson(`${input.beamName || 'beam'}.json`, toProjectFile(useStore.getState()))}
          onLoad={loadProject}
          onReset={resetProject}
          printDisabled={!analysis}
        />

        <div className="layout">
          <aside className="input-col card">
            <InputPanel />
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
                  <div className="summary-status">ผลรวม {overall && <StatusBadge status={overall} />}</div>
                  <div className="params">
                    <span>
                      n = <b>{analysis.params.n}</b>
                    </span>
                    <span>
                      k = <b>{fmt(analysis.params.k, 3)}</b>
                    </span>
                    <span>
                      j = <b>{fmt(analysis.params.j, 3)}</b>
                    </span>
                    <span>
                      R = <b>{fmt(analysis.params.R, 2)}</b> ksc
                    </span>
                    <span>
                      fc = <b>{fmt(analysis.params.fcAllow, 1)}</b>
                    </span>
                    <span>
                      fs = <b>{fmt(analysis.params.fsAllow, 0)}</b>
                    </span>
                    <span>
                      fv = <b>{fmt(analysis.params.fvAllow, 0)}</b> ksc
                    </span>
                  </div>
                  <details className="steps-details">
                    <summary>ค่าหน่วยแรงยอมให้ และความลึกขั้นต่ำ</summary>
                    <CalcSteps steps={analysis.paramSteps} />
                    <CheckTable checks={analysis.beamChecks} />
                  </details>
                </div>

                {(edited.A || edited.B) && (
                  <div className="note info">
                    <span>
                      หน้าตัด {keys.filter((k) => edited[k]).map((k) => `${k}-${k}`).join(', ')} แก้ไขเอง —
                      เมื่อเปลี่ยนข้อมูลนำเข้า โปรแกรมจะตรวจสอบใหม่แต่ไม่จัดเหล็กใหม่ให้
                    </span>
                    <button type="button" className="btn small" onClick={() => redesign()}>
                      ออกแบบใหม่ทั้งหมด
                    </button>
                  </div>
                )}

                <div className="sections">
                  {keys.map((key) => (
                    <SectionCard
                      key={key}
                      sectionKey={key}
                      input={input}
                      layout={layouts[key]}
                      analysis={analysis[key]}
                      denom={denom}
                      edited={edited[key]}
                      stirrupNote={analysis.stirrupNotes[key]}
                    />
                  ))}
                </div>
              </>
            )}

            {analysis && view === 'sheet' && (
              <div className="sheet-preview">
                <div className="sheet-page">
                  <PrintSheet input={input} layouts={layouts} analysis={analysis} denom={denom} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {analysis && (
        <div className="print-root">
          <PrintSheet input={input} layouts={layouts} analysis={analysis} denom={denom} />
        </div>
      )}
    </>
  );
}
