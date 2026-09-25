import { useMemo } from 'react'
import { SectionCard } from '@/components/concrete/SectionCard'
import { pickScale } from '@/components/concrete/drawing/drawingModel'
import { CalcSteps } from '@/components/concrete/results/CalcSteps'
import { CheckTable } from '@/components/concrete/results/CheckTable'
import { StatusBadge } from '@/components/concrete/results/StatusBadge'
import { fmt } from '@/engine/concrete/format'
import { analyzeLedgeBeam } from '@/engine/concrete/ledge/analyzeLedge'
import { validateLedgeInput } from '@/engine/concrete/ledge/validate'
import type { SectionKey } from '@/engine/concrete/types'
import { useLedgeStore } from '@/state/ledgeStore'

const KEYS: SectionKey[] = ['A', 'B']

/**
 * ผลการออกแบบคานรับพื้นยื่น — น้ำหนักและแรงภายในที่โปรแกรมคิดให้ แล้วตามด้วยหน้าตัด A-A และ B-B
 * ที่คลิกแก้เหล็กได้เหมือนคาน คสล.
 */
export function ConcreteLedgeBeamResultView() {
  const input = useLedgeStore((s) => s.input)
  const layouts = useLedgeStore((s) => s.layouts)
  const edited = useLedgeStore((s) => s.edited)
  const redesign = useLedgeStore((s) => s.redesign)
  const editLayout = useLedgeStore((s) => s.editLayout)

  const errors = useMemo(() => validateLedgeInput(input), [input])
  const analysis = useMemo(() => (errors.length ? null : analyzeLedgeBeam(input, layouts)), [errors, input, layouts])
  const denom = useMemo(() => (analysis ? pickScale(analysis.sections.A, layouts) : 10), [analysis, layouts])

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
                w = <b>{fmt(analysis.loads.w, 0)}</b> กก./ม.
              </span>
              <span>
                t = <b>{fmt(analysis.loads.torque, 0)}</b> kg·m/m
              </span>
              <span>
                M+ = <b>{fmt(analysis.loads.Mpos, 0)}</b>
              </span>
              <span>
                M− = <b>{fmt(analysis.loads.Mneg, 0)}</b> kg·m
              </span>
              <span>
                Vd = <b>{fmt(analysis.loads.Vd, 0)}</b> kg
              </span>
              <span>
                Td = <b>{fmt(analysis.loads.Td, 0)}</b> kg·m
              </span>
            </div>
            <details className="steps-details" open>
              <summary>น้ำหนักลงคานและแรงภายใน</summary>
              <CalcSteps steps={analysis.loadSteps} />
            </details>
            <details className="steps-details">
              <summary>ค่าหน่วยแรงยอมให้ และความลึกขั้นต่ำ</summary>
              <CalcSteps steps={analysis.paramSteps} />
              <CheckTable checks={analysis.beamChecks} />
            </details>
          </div>

          {(edited.A || edited.B) && (
            <div className="note info">
              <span>
                หน้าตัด{' '}
                {KEYS.filter((k) => edited[k])
                  .map((k) => `${k}-${k}`)
                  .join(', ')}{' '}
                แก้ไขเอง — เมื่อเปลี่ยนข้อมูลนำเข้า โปรแกรมจะตรวจสอบใหม่แต่ไม่จัดเหล็กใหม่ให้
              </span>
              <button type="button" className="btn small" onClick={() => redesign()}>
                ออกแบบใหม่ทั้งหมด
              </button>
            </div>
          )}

          <div className="sections">
            {KEYS.map((key) => (
              <SectionCard
                key={key}
                sectionKey={key}
                input={analysis.sections[key]}
                layout={layouts[key]}
                analysis={analysis[key]}
                denom={denom}
                edited={edited[key]}
                stirrupNote={analysis.stirrupNotes[key]}
                editLayout={editLayout}
                redesign={redesign}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
