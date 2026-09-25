import { KIND_LABEL } from '../features/registry'
import type { CalcSheet, Project } from '../engine/shared/types'

interface Props {
  project: Project
  sheets: CalcSheet[]
  /** เลขหน้าแรกของเกณฑ์การออกแบบ */
  criteriaPage: number
  /** เลขหน้าเริ่มต้นของรายการคำนวณแผ่นแรก */
  firstSheetPage: number
}

export function TableOfContents({ project, sheets, criteriaPage, firstSheetPage }: Props) {
  return (
    <section className="report-page">
      <div className="sheet-header">
        <div>{project.name || 'โครงการ'}</div>
        <div>สารบัญ</div>
      </div>

      <h2 style={{ fontSize: '22pt', margin: '0 0 12pt' }}>สารบัญรายการคำนวณ</h2>

      <div className="toc-row" style={{ fontWeight: 700 }}>
        <span>รายการ</span>
        <span className="toc-dots" />
        <span>หน้า</span>
      </div>

      <div className="toc-row">
        <span>เกณฑ์การออกแบบ (Design Criteria)</span>
        <span className="toc-dots" />
        <span>{criteriaPage}</span>
      </div>

      {sheets.length === 0 && <div>— ยังไม่มีรายการคำนวณในเล่มนี้ —</div>}

      {sheets.map((sheet, index) => (
        <div className="toc-row" key={sheet.id}>
          <span>
            {index + 1}. {sheet.title} ({KIND_LABEL[sheet.kind]})
          </span>
          <span className="toc-dots" />
          <span>{firstSheetPage + index}</span>
        </div>
      ))}

      <div className="sheet-footer">
        <span>{project.name}</span>
        <span>หน้า 2</span>
      </div>
    </section>
  )
}
