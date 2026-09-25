import type { Project } from '@/engine/shared/types'
import { CRITERIA_PRINT_PAGES, CRITERIA_SECTIONS, type CriteriaBlock, type CriteriaSection } from './criteriaModel'

interface Props {
  project: Project
  /** เลขหน้าของหน้าแรกของเกณฑ์การออกแบบในรูปเล่ม */
  firstPage: number
  totalPages: number
}

/** เลขหมวดตามลำดับบนหน้าจอ เพื่อให้รูปเล่มกับหน้าจออ้างอิงเลขเดียวกัน */
const SECTION_BY_ID = new Map(CRITERIA_SECTIONS.map((section, i) => [section.id, { section, number: i + 1 }]))

function BlockBody({ block }: { block: CriteriaBlock }) {
  switch (block.type) {
    case 'table':
      return (
        <table className="report-table compact">
          <thead>
            <tr>
              {block.columns.map((col, i) => (
                <th key={i} className={col.num ? 'num' : undefined}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} className={block.columns[i].num ? 'num' : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'facts':
      return (
        <table className="report-table compact criteria-facts">
          <tbody>
            {block.items.map(({ label, value, hint }) => (
              <tr key={label}>
                <th>{label}</th>
                <td>
                  {value}
                  {hint && <div className="criteria-hint">{hint}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'list':
      return block.ordered ? (
        <ol className="criteria-text criteria-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : (
        <div className="criteria-text">{block.items.join(' · ')}</div>
      )
    case 'formulas':
      return (
        <div className="criteria-text">
          {block.items.map((f) => (
            <div key={f} className="criteria-formula">
              {f}
            </div>
          ))}
        </div>
      )
    case 'note':
      return <div className="criteria-text criteria-note">{block.text}</div>
    case 'side-by-side':
      // รูปเล่มแบ่งสองคอลัมน์อยู่แล้ว — ถูกแตกเป็นบล็อกเดี่ยวก่อนถึงตรงนี้
      return null
  }
}

function PrintSection({ section, number }: { section: CriteriaSection; number: number }) {
  const blocks = section.blocks.flatMap((b) => (b.type === 'side-by-side' ? b.blocks : [b]))
  return (
    <>
      {blocks.map((block, i) => {
        const title = 'title' in block ? block.title : undefined
        return (
          // หัวหมวดอยู่ในบล็อกแรกเสมอ จึงไม่ถูกทิ้งไว้ท้ายคอลัมน์โดยไม่มีเนื้อหา
          <div key={i} className="criteria-block">
            {i === 0 && (
              <h3 className="criteria-section-title">
                {number}. {section.title}
              </h3>
            )}
            {title && <div className="criteria-block-title">{title}</div>}
            <BlockBody block={block} />
          </div>
        )
      })}
    </>
  )
}

/** หน้าเกณฑ์การออกแบบในรูปเล่ม — จำนวนหน้าคงที่ตาม CRITERIA_PRINT_PAGES */
export function DesignCriteriaSheets({ project, firstPage, totalPages }: Props) {
  return (
    <>
      {CRITERIA_PRINT_PAGES.map((ids, i) => (
        <section
          key={i}
          className="report-page fit-one-page criteria-page"
          data-title={`Design Criteria หน้า ${i + 1}`}
        >
          <div className="sheet-header tight">
            <div>
              <strong>{project.name || 'โครงการ'}</strong>
              <div style={{ fontSize: '11.5pt' }}>{project.location}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>เกณฑ์การออกแบบ</strong>
              <div style={{ fontSize: '11.5pt' }}>Design Criteria</div>
            </div>
          </div>

          <div className="criteria-cols">
            {ids.map((id) => {
              const entry = SECTION_BY_ID.get(id)
              return entry && <PrintSection key={id} section={entry.section} number={entry.number} />
            })}
          </div>

          <div className="sheet-footer">
            <span>{project.name}</span>
            <span>
              หน้า {firstPage + i} / {totalPages}
            </span>
          </div>
        </section>
      ))}
    </>
  )
}
