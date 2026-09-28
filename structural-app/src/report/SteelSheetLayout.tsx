import type { ReactNode } from 'react'
import { SteelSectionDiagram } from '../diagrams/SteelSectionDiagram'
import { fmt, fmtSymbolValue, fmtUnit } from '../engine/shared/units'
import type {
  CalcStep,
  CheckItem,
  CheckStatus,
  Project,
  SteelDetailing,
} from '../engine/shared/types'

const STATUS_TEXT: Record<CheckStatus, string> = {
  pass: 'ผ่าน',
  fail: 'ไม่ผ่าน',
  warn: 'ควรตรวจสอบ',
}

export type Row = [string, string]

interface Props {
  project: Project
  title: string
  subtitle: string
  /** ข้อมูลนำเข้า จัดเป็นคู่ ป้ายกำกับ/ค่า */
  inputRows: Row[]
  /** คุณสมบัติหน้าตัดที่คำนวณได้ */
  propertyRows: Row[]
  steps: CalcStep[]
  checks: CheckItem[]
  overall: CheckStatus
  detailing: SteelDetailing
  warnings: string[]
  remarks: string
  pageNumber: number
  totalPages: number
  conclusion?: ReactNode
  /** รูปและคำบรรยายแทนรูปตัดเหล็ก เช่น เสาเหล็กหุ้มคอนกรีต */
  figure?: ReactNode
}

/** จัดแถวให้เป็นคู่ ๆ เพื่อใส่ 2 คู่ต่อหนึ่งแถวของตาราง */
function pairUp(rows: Row[]): Array<[Row, Row | undefined]> {
  const out: Array<[Row, Row | undefined]> = []
  for (let i = 0; i < rows.length; i += 2) out.push([rows[i], rows[i + 1]])
  return out
}

/** ขั้นตอนที่แสดงค่าซ้ำกับตารางคุณสมบัติหน้าตัดในหัวข้อ 2 — ตัดออกเฉพาะในหน้าพิมพ์ */
const STEPS_SHOWN_IN_PROPERTIES = new Set(['A', 'Sy', 'rx , ry'])

/** แบ่งรายการออกเป็นสองคอลัมน์ที่ความสูงใกล้เคียงกัน */
function splitInTwo<T>(items: T[]): [T[], T[]] {
  const half = Math.ceil(items.length / 2)
  return [items.slice(0, half), items.slice(half)]
}

/**
 * หน้ารายงานของรายการคำนวณโครงสร้างเหล็ก — ออกแบบให้ 1 รายการพอดี 1 หน้า A4
 * ใช้ร่วมกันทั้งคานและเสา เพื่อให้รูปเล่มมีหน้าตาเดียวกันทั้งเล่ม
 */
export function SteelSheetLayout({
  project,
  title,
  subtitle,
  inputRows,
  propertyRows,
  steps,
  checks,
  overall,
  detailing,
  warnings,
  remarks,
  pageNumber,
  totalPages,
  conclusion,
  figure,
}: Props) {
  return (
    <section className="report-page fit-one-page" data-title={title}>
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

      <h3 className="sheet-section-title">1. ข้อมูลที่ใช้ในการคำนวณ</h3>
      <table className="report-table compact pairs avoid-break">
        <tbody>
          {pairUp(inputRows).map(([left, right], i) => (
            <tr key={i}>
              <th>{left[0]}</th>
              <td>{left[1]}</td>
              <th>{right?.[0] ?? ''}</th>
              <td>{right?.[1] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="sheet-section-title">
        2. คุณสมบัติหน้าตัด — {detailing.sectionName}
      </h3>
      <table className="report-table compact pairs avoid-break">
        <tbody>
          {pairUp(propertyRows).map(([left, right], i) => (
            <tr key={i}>
              <th>{left[0]}</th>
              <td>{left[1]}</td>
              <th>{right?.[0] ?? ''}</th>
              <td>{right?.[1] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="sheet-section-title">3. ขั้นตอนการคำนวณ</h3>
      <div className="sheet-two-col avoid-break">
        {splitInTwo(steps.filter((s) => !STEPS_SHOWN_IN_PROPERTIES.has(s.symbol))).map((half, col) => (
          <table className="report-table compact" key={col}>
            <thead>
              <tr>
                <th style={{ width: '16%' }}>ตัวแปร</th>
                <th>สูตรและการแทนค่า</th>
                <th style={{ width: '26%' }}>ผลลัพธ์</th>
              </tr>
            </thead>
            <tbody>
              {half.map((step) => (
                <tr key={step.symbol}>
                  <td>{step.symbol}</td>
                  <td>
                    <div>{step.label}</div>
                    {(step.formula || step.substitution) && (
                      <div style={{ fontSize: '10.5pt', color: '#374151' }}>
                        {[step.formula, step.substitution].filter(Boolean).join('  ·  ')}
                      </div>
                    )}
                  </td>
                  <td className="num">
                    {fmtUnit(step.value, step.unit, step.decimals ?? 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      <h3 className="sheet-section-title">4. การตรวจสอบตามมาตรฐาน</h3>
      <table className="report-table compact avoid-break">
        <thead>
          <tr>
            <th>รายการตรวจสอบ</th>
            <th style={{ width: '17%' }}>ค่าที่เกิดขึ้น</th>
            <th style={{ width: '17%' }}>ค่าที่ยอมให้</th>
            <th style={{ width: '8%' }}>อัตราส่วน</th>
            <th style={{ width: '9%' }}>ผล</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((check) => (
            <tr key={check.id}>
              <td>
                {check.label}
                {check.formula && (
                  <span style={{ fontSize: '10.5pt', color: '#374151' }}>
                    {'  ·  '}
                    {check.formula}
                  </span>
                )}
              </td>
              <td className="num">
                {fmtSymbolValue(check.actualSymbol, check.actual, check.unit)}
              </td>
              <td className="num">
                {fmtSymbolValue(check.allowableSymbol, check.allowable, check.unit)}
              </td>
              <td className="num">{fmt(check.ratio, 2)}</td>
              <td style={{ fontWeight: 700 }}>{STATUS_TEXT[check.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sheet-summary">
        สรุปผล: {STATUS_TEXT[overall]}
        {conclusion}
      </div>

      <div className="sheet-bottom avoid-break">
        <div className="sheet-figure">
          {figure ?? (
            <>
              <SteelSectionDiagram detailing={detailing} caption={false} />
              <div className="sheet-figure-caption">
                {detailing.sectionName} · {detailing.gradeLabel.split(' ')[0]}
                <br />
                θs = {detailing.sectionAngle}° · θm = {detailing.memberAngle}°
              </div>
            </>
          )}
        </div>
        <div className="sheet-notes">
          {warnings.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: '11.5pt', marginBottom: '1pt' }}>
                ข้อจำกัดและข้อสังเกตของการคำนวณนี้
              </div>
              <ul className="sheet-warnings">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </>
          )}
          <div style={{ fontWeight: 700, fontSize: '11.5pt', margin: '3pt 0 1pt' }}>
            หมายเหตุของวิศวกร
          </div>
          <div className="sheet-note-box">{remarks.trim() || '—'}</div>
        </div>
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
