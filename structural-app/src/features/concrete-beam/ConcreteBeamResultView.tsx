import { useMemo } from 'react'
import { SectionCard } from '@/components/concrete/SectionCard'
import { pickScale } from '@/components/concrete/drawing/drawingModel'
import { CalcSteps } from '@/components/concrete/results/CalcSteps'
import { CheckTable } from '@/components/concrete/results/CheckTable'
import { StatusBadge } from '@/components/concrete/results/StatusBadge'
import { analyzeBeam } from '@/engine/concrete/design/designBeam'
import { worstStatus } from '@/engine/concrete/design/sectionCheck'
import { fmt } from '@/engine/concrete/format'
import type { SectionKey } from '@/engine/concrete/types'
import { validateInput } from '@/engine/concrete/validate'
import { useStore } from '@/state/store'

const KEYS: SectionKey[] = ['A', 'B']

/**
 * ผลการออกแบบคาน — อ่านจาก store โดยตรงเพราะรูปหน้าตัดแก้ไขเหล็กได้ในตัว
 * ฟอร์มของรายการเป็นผู้เชื่อม store กับข้อมูลรายการ (useConcreteDraft)
 */
export function ConcreteBeamResultView() {
  const input = useStore((s) => s.input)
  const layouts = useStore((s) => s.layouts)
  const edited = useStore((s) => s.edited)
  const redesign = useStore((s) => s.redesign)

  const errors = useMemo(() => validateInput(input), [input])
  const analysis = useMemo(() => (errors.length ? null : analyzeBeam(input, layouts)), [errors, input, layouts])
  const denom = useMemo(() => (errors.length ? 10 : pickScale(input, layouts)), [errors, input, layouts])

  const overall = analysis
    ? worstStatus([...analysis.A.checks, ...analysis.B.checks, ...analysis.beamChecks])
    : null

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
    </div>
  )
}
