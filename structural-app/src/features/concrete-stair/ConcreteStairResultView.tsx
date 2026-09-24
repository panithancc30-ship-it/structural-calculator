import { useMemo } from 'react'
import { usePopover } from '@/components/concrete/editor/usePopover'
import { CalcSteps } from '@/components/concrete/results/CalcSteps'
import { CheckTable } from '@/components/concrete/results/CheckTable'
import { StatusBadge } from '@/components/concrete/results/StatusBadge'
import { StairSection } from '@/components/concrete/stair/StairDrawing'
import { StairBarPopover, type ApplyStairEdit } from '@/components/concrete/stair/StairPopover'
import { pickStairScale, stairRunText, type StairPick } from '@/components/concrete/stair/stairDrawingModel'
import { fmt } from '@/engine/concrete/format'
import { analyzeStair, STAIR_BAR_TH } from '@/engine/concrete/stair/analyzeStair'
import { autoStairLayout, stairDims } from '@/engine/concrete/stair/designStair'
import { degrees } from '@/engine/concrete/stair/geometry'
import { STAIR_BAR_KEYS } from '@/engine/concrete/stair/types'
import { validateStairInput } from '@/engine/concrete/stair/validate'
import { useStairStore } from '@/state/stairStore'

export function ConcreteStairResultView() {
  const input = useStairStore((s) => s.input)
  const layout = useStairStore((s) => s.layout)
  const edited = useStairStore((s) => s.edited)
  const editLayout = useStairStore((s) => s.editLayout)
  const redesign = useStairStore((s) => s.redesign)
  const pop = usePopover<StairPick>()

  const errors = useMemo(() => validateStairInput(input), [input])
  const dims = useMemo(() => (errors.length === 0 ? stairDims(input) : null), [errors, input])
  const analysis = useMemo(() => (dims ? analyzeStair(input, dims, layout) : null), [dims, input, layout])
  const suggested = useMemo(() => (dims ? autoStairLayout(input, dims) : null), [dims, input])
  const denom = useMemo(
    () => (analysis ? pickStairScale(input, analysis, layout) : 30),
    [analysis, input, layout],
  )

  const apply: ApplyStairEdit = (fn) => editLayout(fn)
  const selectedKey = pop.sel ? pop.sel.pick.key : null

  return (
    <div className="rc-scope space-y-3.5">
      {errors.length > 0 && (
        <div className="card errors">
          <strong>ข้อมูลไม่ครบหรือไม่ถูกต้อง</strong>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {analysis && dims && (
        <>
          <div className="card summary">
            <div className="summary-status">
              ผลรวม <StatusBadge status={analysis.status} />
            </div>
            <div className="params">
              <span>
                ท้องบันไดหนา <b>{fmt(dims.t, 1)}</b> ซม.
              </span>
              <span>
                ลาด <b>{fmt(degrees(analysis.profile.theta), 1)}°</b> ช่วงราบ <b>{fmt(analysis.profile.L / 100, 2)}</b> ม.
              </span>
              <span>
                w ช่วงลาด <b>{fmt(analysis.loads.wFlight, 0)}</b> · ส่วนราบ <b>{fmt(analysis.loads.wLanding, 0)}</b> กก./ตร.ม.
              </span>
              <span>
                ล่าง <b>{stairRunText(layout, 'bottom')}</b>
              </span>
              <span>
                บน <b>{stairRunText(layout, 'topLow')}</b> · <b>{stairRunText(layout, 'topHigh')}</b>
              </span>
            </div>
          </div>

          {edited && (
            <div className="note info">
              <span>เหล็กเสริมแก้ไขเอง — เมื่อเปลี่ยนข้อมูลนำเข้า โปรแกรมจะตรวจสอบใหม่แต่ไม่จัดเหล็กใหม่ให้</span>
              <button type="button" className="btn small" onClick={redesign}>
                ↺ ออกแบบอัตโนมัติใหม่
              </button>
            </div>
          )}

          <section className="card section-card">
            <header className="section-head">
              <h2>
                รูปตัดบันได {input.stairName || 'ST1'}
                <small>{input.levels}</small>
              </h2>
              <StatusBadge status={analysis.status} />
              {edited && <span className="tag">แก้ไขเอง</span>}
            </header>
            <div className="drawing-wrap" ref={pop.wrapRef}>
              <StairSection
                input={input}
                analysis={analysis}
                layout={layout}
                denom={denom}
                interactive
                selectedKey={selectedKey}
                onPick={(pick, e) => pop.openAt(pick, e.clientX, e.clientY)}
                onBackgroundClick={pop.close}
              />
              {pop.sel && suggested && (
                <div className="popover" style={pop.style} role="dialog" aria-label="แก้ไขเหล็กบันได">
                  <button type="button" className="popover-close" onClick={pop.close} aria-label="ปิด">
                    ×
                  </button>
                  <StairBarPopover
                    barKey={pop.sel.pick.key}
                    layout={layout}
                    demand={analysis.bars[pop.sel.pick.key]}
                    suggested={suggested[pop.sel.pick.key]}
                    apply={apply}
                  />
                </div>
              )}
            </div>
            <p className="hint">คลิกที่เหล็กหรือป้ายชื่อ เพื่อเปลี่ยนขนาดและระยะเรียง</p>
            <div className="toolbar">
              {STAIR_BAR_KEYS.map((key) => (
                <button key={key} type="button" className="btn" onClick={() => pop.openTopRight({ kind: 'bars', key })}>
                  {STAIR_BAR_TH[key]}…
                </button>
              ))}
              {edited && (
                <button type="button" className="btn accent" onClick={redesign}>
                  ↺ ออกแบบอัตโนมัติใหม่
                </button>
              )}
            </div>
          </section>

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
