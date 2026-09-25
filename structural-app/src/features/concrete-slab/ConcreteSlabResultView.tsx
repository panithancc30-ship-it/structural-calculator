import { useMemo } from 'react'
import { usePopover } from '@/components/concrete/editor/usePopover'
import { CalcSteps } from '@/components/concrete/results/CalcSteps'
import { CheckTable } from '@/components/concrete/results/CheckTable'
import { StatusBadge } from '@/components/concrete/results/StatusBadge'
import { SlabPlan, SlabSection } from '@/components/concrete/slab/SlabDrawings'
import { SlabBarPopover, type ApplySlabEdit } from '@/components/concrete/slab/SlabPopover'
import {
  dirSummary,
  pickKey,
  pickPlanScale,
  pickSectionScale,
  sectionDirs,
  SLAB_TYPE_TH,
  type SlabPick,
} from '@/components/concrete/slab/slabDrawingModel'
import { fmt } from '@/engine/concrete/format'
import { analyzeSlab } from '@/engine/concrete/slab/analyzeSlab'
import { autoSlabLayout, slabDims } from '@/engine/concrete/slab/designSlab'
import { validateSlabInput } from '@/engine/concrete/slab/validate'
import { useSlabStore } from '@/state/slabStore'

export function ConcreteSlabResultView() {
  const input = useSlabStore((s) => s.input)
  const layout = useSlabStore((s) => s.layout)
  const edited = useSlabStore((s) => s.edited)
  const editLayout = useSlabStore((s) => s.editLayout)
  const redesign = useSlabStore((s) => s.redesign)
  const pop = usePopover<SlabPick>()

  const errors = useMemo(() => validateSlabInput(input), [input])
  const dims = useMemo(() => (errors.length === 0 ? slabDims(input) : null), [errors, input])
  const analysis = useMemo(() => (dims ? analyzeSlab(input, dims, layout) : null), [dims, input, layout])
  const suggested = useMemo(() => (dims ? autoSlabLayout(input, dims) : null), [dims, input])
  const planDenom = useMemo(
    () => (analysis ? pickPlanScale(input, analysis, layout) : 50),
    [analysis, input, layout],
  )
  const sectionDenom = useMemo(
    () => (analysis ? pickSectionScale(input, analysis, layout) : 50),
    [analysis, input, layout],
  )

  const apply: ApplySlabEdit = (fn) => editLayout(fn)
  const selectedKey = pop.sel ? pickKey(pop.sel.pick.face, pop.sel.pick.dir) : null

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

      {analysis && dims && (
        <>
          <div className="card summary">
            <div className="summary-status">
              ผลรวม <StatusBadge status={analysis.status} />
            </div>
            <div className="params">
              <span>
                {SLAB_TYPE_TH[input.slabType]} หนา <b>{fmt(dims.t, 1)}</b> ซม.
              </span>
              <span>
                w ใช้งาน <b>{fmt(analysis.loads.w, 0)}</b> กก./ตร.ม.
              </span>
              <span>
                X <b>{dirSummary(layout, 'x')}</b>
              </span>
              <span>
                Y <b>{dirSummary(layout, 'y')}</b>
              </span>
            </div>
          </div>

          {analysis.loads.twoWay && (
            <div className="note info">
              <span>
                พื้นสองทางใช้ตารางสัมประสิทธิ์โมเมนต์ วิธีที่ 2 (วสท.) — m = S/L ={' '}
                {fmt(analysis.loads.twoWay.m, 2)} กรณี {analysis.loads.twoWay.caseNo} (ขอบไม่ต่อเนื่อง{' '}
                {analysis.loads.twoWay.caseNo - 1} ด้าน) M = C·w·S² ทั้งสองทิศ
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
                  แปลนพื้น {input.slabName || 'S1'}
                  <small>{SLAB_TYPE_TH[input.slabType]}</small>
                </h2>
                <StatusBadge status={analysis.status} />
                {edited && <span className="tag">แก้ไขเอง</span>}
              </header>
              <div className="drawing-wrap" ref={pop.wrapRef}>
                <SlabPlan
                  input={input}
                  analysis={analysis}
                  layout={layout}
                  denom={planDenom}
                  interactive
                  selectedKey={selectedKey}
                  onPick={(pick, e) => pop.openAt(pick, e.clientX, e.clientY)}
                  onBackgroundClick={pop.close}
                />
                {pop.sel && suggested && (
                  <div className="popover" style={pop.style} role="dialog" aria-label="แก้ไขเหล็กพื้น">
                    <button type="button" className="popover-close" onClick={pop.close} aria-label="ปิด">
                      ×
                    </button>
                    <SlabBarPopover
                      face={pop.sel.pick.face}
                      dir={pop.sel.pick.dir}
                      layout={layout}
                      demand={analysis[pop.sel.pick.dir][pop.sel.pick.face]}
                      suggested={suggested[pop.sel.pick.face][pop.sel.pick.dir]}
                      apply={apply}
                    />
                  </div>
                )}
              </div>
              <p className="hint">
                คลิกที่เหล็กหรือป้ายชื่อ เพื่อเปลี่ยนขนาดและระยะเรียง — เส้นประคือเหล็กผิวบน
              </p>
              <div className="toolbar">
                {(['bottom', 'top'] as const).map((face) =>
                  (['x', 'y'] as const).map((dir) => (
                    <button
                      key={`${face}-${dir}`}
                      type="button"
                      className="btn"
                      onClick={() => pop.openTopRight({ kind: 'bars', face, dir })}
                    >
                      ผิว{face === 'bottom' ? 'ล่าง' : 'บน'} {dir.toUpperCase()}…
                    </button>
                  )),
                )}
                {edited && (
                  <button type="button" className="btn accent" onClick={redesign}>
                    ↺ ออกแบบอัตโนมัติใหม่
                  </button>
                )}
              </div>
            </section>

            <section className="card sections-card">
              {sectionDirs(input).map((dir) => (
                <div key={dir} className="drawing-wrap section-wrap">
                  <SlabSection
                    input={input}
                    analysis={analysis}
                    layout={layout}
                    denom={sectionDenom}
                    dir={dir}
                    selectedKey={selectedKey}
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
