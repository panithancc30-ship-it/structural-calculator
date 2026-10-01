import { Fragment, useEffect, useState } from 'react'
import { CRITERIA_PRINT_PAGES } from '../features/design-criteria/criteriaModel'
import { DesignCriteriaSheets } from '../features/design-criteria/DesignCriteriaSheets'
import { inputWithTitle, sheetType } from '../features/registry'
import { StandardDrawingSheets } from '../features/standard-drawings/StandardDrawingSheets'
import { selectedStandardDrawings } from '../features/standard-drawings/standardDrawings'
import type { CalcSheet, Project } from '../engine/shared/types'
import { CoverPage } from './CoverPage'
import {
  applyPrintFit,
  clearPrintFit,
  measureSheets,
  MIN_SCALE,
  type FitResult,
} from './fitToPage'
import { TableOfContents } from './TableOfContents'

interface Props {
  project: Project
  sheets: CalcSheet[]
}

/** หน้าปก + สารบัญ = 2 หน้า ตามด้วยเกณฑ์การออกแบบ รายการคำนวณ และแบบมาตรฐานที่เลือกแนบ */
const CRITERIA_FIRST_PAGE = 3
const FIRST_SHEET_PAGE = CRITERIA_FIRST_PAGE + CRITERIA_PRINT_PAGES.length

export function ReportLayout({ project, sheets }: Props) {
  const drawings = selectedStandardDrawings(project.standardDrawings)
  const firstDrawingPage = FIRST_SHEET_PAGE + sheets.length
  const totalPages = firstDrawingPage - 1 + drawings.length
  const [fit, setFit] = useState<FitResult[]>([])

  useEffect(() => {
    let cancelled = false
    // วัดหลังฟอนต์โหลดเสร็จ เพราะความสูงของตัวอักษรไทยต่างกันมากระหว่างฟอนต์
    void document.fonts.ready.then(() => {
      if (!cancelled) setFit(measureSheets())
    })

    window.addEventListener('beforeprint', applyPrintFit)
    window.addEventListener('afterprint', clearPrintFit)
    return () => {
      cancelled = true
      window.removeEventListener('beforeprint', applyPrintFit)
      window.removeEventListener('afterprint', clearPrintFit)
    }
  }, [project, sheets])

  const scaled = fit.filter((f) => f.scale < 1 && f.fits)
  const overflowing = fit.filter((f) => !f.fits)

  return (
    <>
      {(scaled.length > 0 || overflowing.length > 0) && (
        <div className="no-print mx-auto mb-4 max-w-[21cm] space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {scaled.length > 0 && (
            <p>
              ย่อขนาดตอนพิมพ์ให้พอดี 1 หน้า:{' '}
              {scaled.map((f) => `${f.title} (${Math.round(f.scale * 100)}%)`).join(', ')}
            </p>
          )}
          {overflowing.length > 0 && (
            <p>
              ยาวเกิน 1 หน้าแม้ย่อถึง {Math.round(MIN_SCALE * 100)}% แล้ว — ควรตัดหมายเหตุให้สั้นลง:{' '}
              {overflowing.map((f) => f.title).join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="report-root">
        <CoverPage project={project} />
        <TableOfContents
          project={project}
          sheets={sheets}
          criteriaPage={CRITERIA_FIRST_PAGE}
          firstSheetPage={FIRST_SHEET_PAGE}
          drawings={drawings}
          firstDrawingPage={firstDrawingPage}
        />
        <DesignCriteriaSheets project={project} firstPage={CRITERIA_FIRST_PAGE} totalPages={totalPages} />
        {sheets.map((sheet, index) => (
          <Fragment key={sheet.id}>
            {sheetType(sheet.kind).renderSheet({
              project,
              title: sheet.title,
              input: inputWithTitle(sheetType(sheet.kind), sheet.input, sheet.title),
              remarks: sheet.remarks,
              pageNumber: FIRST_SHEET_PAGE + index,
              totalPages,
            })}
          </Fragment>
        ))}
        <StandardDrawingSheets project={project} drawings={drawings} firstPage={firstDrawingPage} totalPages={totalPages} />
      </div>
    </>
  )
}
