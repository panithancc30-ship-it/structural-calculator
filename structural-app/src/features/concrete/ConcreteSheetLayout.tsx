import { Fragment, type ReactNode } from 'react'
import { GROUP_TH } from '@/components/concrete/results/CheckTable'
import type { CalcStep, CheckItem, CheckStatus } from '@/engine/concrete/types'
import type { Project } from '@/engine/shared/types'

const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: 'ผ่าน',
  fail: 'ไม่ผ่าน',
  warn: 'ควรตรวจสอบ',
}

export interface InputRow {
  label: string
  /** ช่องข้อมูลสามช่องต่อหนึ่งแถว ให้ตารางสั้นพอลงหนึ่งหน้า */
  cells: ReactNode[]
}

interface Props {
  project: Project
  /** ชื่อรายการที่ผู้ใช้ตั้ง เช่น “คาน B1 ชั้น 2” */
  title: string
  /** ชื่อเต็มของรายการคำนวณ เช่น “รายการคำนวณออกแบบคานคอนกรีตเสริมเหล็ก” */
  docTitle: string
  /** มาตรฐานและวิธีที่ใช้ */
  subtitle: string
  inputRows: InputRow[]
  /** หัวข้อของส่วนรูป ต่างกันไปตามชนิดฐานราก/คาน */
  figureTitle: string
  figures: ReactNode
  checks: CheckItem[]
  steps: CalcStep[]
  status: CheckStatus
  /** ข้อจำกัดและสมมติฐานของการคำนวณชนิดนี้ */
  notes: string[]
  remarks: string
  pageNumber: number
  totalPages: number
}

/** แบ่งรายการออกเป็นสองคอลัมน์ที่ความสูงใกล้เคียงกัน */
function splitInTwo<T>(items: T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2)
  return [items.slice(0, half), items.slice(half)]
}

function ConcreteCheckTable({ checks }: { checks: CheckItem[] }) {
  return (
    <div className="sheet-two-col avoid-break">
      {splitInTwo(checks).map((half, col) => (
        <table className="report-table compact" key={col}>
          <thead>
            <tr>
              <th>รายการตรวจสอบ</th>
              <th style={{ width: '22%' }}>ต้องการ</th>
              <th style={{ width: '22%' }}>ใช้จริง</th>
              <th style={{ width: '13%' }}>ผล</th>
            </tr>
          </thead>
          <tbody>
            {half.map((c, i) => (
              <Fragment key={c.id}>
                {(i === 0 || half[i - 1].group !== c.group) && (
                  <tr className="rc-group-row">
                    <td colSpan={4}>{GROUP_TH[c.group]}</td>
                  </tr>
                )}
                <tr>
                  <td>{c.label}</td>
                  <td className="num">{c.required}</td>
                  <td className="num">{c.provided}</td>
                  <td style={{ fontWeight: 700 }}>{STATUS_TEXT[c.status]}</td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}

function ConcreteStepTable({ steps }: { steps: CalcStep[] }) {
  return (
    <div className="sheet-two-col avoid-break">
      {splitInTwo(steps).map((half, col) => (
        <table className="report-table compact" key={col}>
          <tbody>
            {half.map((s, i) => (
              <tr key={`${s.label}-${i}`}>
                <th style={{ width: '26%' }}>{s.label}</th>
                <td>{s.formula}</td>
                <td className="num" style={{ width: '26%' }}>
                  {s.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}

/**
 * หน้ารายงานของรายการคำนวณคอนกรีตเสริมเหล็ก — 1 รายการพอดี 1 หน้า A4
 *
 * ใช้กรอบหน้าเดียวกับรายการคำนวณโครงสร้างเหล็ก (หัวกระดาษ เลขหน้า กล่องหมายเหตุ)
 * เพื่อให้รูปเล่มที่มีทั้งงานเหล็กและงานคอนกรีตมีหน้าตาเป็นเล่มเดียวกัน
 */
export function ConcreteSheetLayout({
  project,
  title,
  docTitle,
  subtitle,
  inputRows,
  figureTitle,
  figures,
  checks,
  steps,
  status,
  notes,
  remarks,
  pageNumber,
  totalPages,
}: Props) {
  return (
    <section className="report-page fit-one-page rc-sheet" data-title={title}>
      <div className="sheet-header tight">
        <div>
          <strong>{project.name || 'โครงการ'}</strong>
          <div style={{ fontSize: '11.5pt' }}>{project.location}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <strong>{title}</strong>
          <div style={{ fontSize: '11.5pt' }}>{subtitle}</div>
        </div>
      </div>

      <h3 className="sheet-section-title">1. {docTitle} — ข้อมูลที่ใช้ในการคำนวณ</h3>
      <table className="report-table compact avoid-break">
        <tbody>
          {inputRows.map((row) => (
            <tr key={row.label}>
              <th style={{ width: '13%' }}>{row.label}</th>
              {row.cells.map((cell, i) => (
                <td key={i} style={{ width: '29%' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="sheet-section-title">2. {figureTitle}</h3>
      <div className="rc-figures avoid-break">{figures}</div>

      <h3 className="sheet-section-title">3. การตรวจสอบตามมาตรฐาน</h3>
      <ConcreteCheckTable checks={checks} />

      {steps.length > 0 && (
        <>
          <h3 className="sheet-section-title">4. ค่าคำนวณหลัก</h3>
          <ConcreteStepTable steps={steps} />
        </>
      )}

      <div className="sheet-summary">สรุปผล: {STATUS_TEXT[status]}</div>

      <div className="rc-notes avoid-break">
        {notes.length > 0 && (
          <>
            <div style={{ fontWeight: 700, fontSize: '11.5pt', marginBottom: '1pt' }}>
              ข้อจำกัดและข้อสังเกตของการคำนวณนี้
            </div>
            <ul className="sheet-warnings">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
        <div style={{ fontWeight: 700, fontSize: '11.5pt', margin: '3pt 0 1pt' }}>หมายเหตุของวิศวกร</div>
        <div className="sheet-note-box">{remarks.trim() || '—'}</div>
      </div>

      <div className="sheet-footer">
        <span>{project.name}</span>
        <span>
          หน้า {pageNumber} / {totalPages}
        </span>
      </div>
    </section>
  )
}
