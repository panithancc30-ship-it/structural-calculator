import { useMemo } from 'react'
import { usePopover } from '@/components/concrete/editor/usePopover'
import { FootingPlan, FootingSection } from '@/components/concrete/footing/FootingDrawings'
import { FootingBarPopover, type ApplyFootingEdit } from '@/components/concrete/footing/FootingPopover'
import {
  POSITION_TH,
  barSetText,
  pickPlanScale,
  pickSectionScale,
  planTitle,
  sectionTitle,
  type FootingPick,
} from '@/components/concrete/footing/footingDrawingModel'
import { CalcSteps } from '@/components/concrete/results/CalcSteps'
import { CheckTable } from '@/components/concrete/results/CheckTable'
import { StatusBadge } from '@/components/concrete/results/StatusBadge'
import { analyzeFooting } from '@/engine/concrete/footing/analyzeFooting'
import { autoFootingLayout, footingDims } from '@/engine/concrete/footing/designFooting'
import type { BarDir } from '@/engine/concrete/footing/types'
import { validateFootingInput } from '@/engine/concrete/footing/validate'
import { fmt } from '@/engine/concrete/format'
import { useFootingStore } from '@/state/footingStore'

const m2 = (cm: number) => fmt(cm / 100, 2)

export function ConcreteFootingResultView() {
  const input = useFootingStore((s) => s.input)
  const layout = useFootingStore((s) => s.layout)
  const edited = useFootingStore((s) => s.edited)
  const editLayout = useFootingStore((s) => s.editLayout)
  const redesign = useFootingStore((s) => s.redesign)
  const pop = usePopover<FootingPick>()

  const errors = useMemo(() => validateFootingInput(input), [input])
  const dims = useMemo(() => (errors.length === 0 ? footingDims(input) : null), [errors, input])
  const analysis = useMemo(() => (dims ? analyzeFooting(input, dims, layout) : null), [dims, input, layout])
  const suggested = useMemo(() => (dims ? autoFootingLayout(input, dims) : null), [dims, input])
  const planDenom = useMemo(() => (analysis ? pickPlanScale(input, analysis) : 50), [analysis, input])
  const sectionDenom = useMemo(() => (analysis ? pickSectionScale(input, analysis) : 50), [analysis, input])
  const apply: ApplyFootingEdit = (fn) => editLayout(fn)
  const selectedDir: BarDir | null = pop.sel ? pop.sel.pick.dir : null
  const flush = input.position === 'edge' || input.position === 'corner'

  return (
    <div className="rc-scope space-y-3.5">
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

      {analysis && (
        <>
          <div className="card summary">
            <div className="summary-status">
              ผลรวม <StatusBadge status={analysis.status} />
            </div>
            <div className="params">
              <span>
                B × L × t{' '}
                <b>
                  {m2(analysis.dims.B)} × {m2(analysis.dims.L)} × {m2(analysis.dims.t)}
                </b>{' '}
                ม.
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
                  <FootingSection
                    input={input}
                    analysis={analysis}
                    denom={sectionDenom}
                    dir={dir}
                    title={sectionTitle(dir)}
                    selectedDir={selectedDir}
                  />
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
    </div>
  )
}
