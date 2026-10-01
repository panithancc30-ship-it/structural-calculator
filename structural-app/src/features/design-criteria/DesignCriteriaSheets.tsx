import type { Project } from '@/engine/shared/types'
import {
  CRITERIA_PRINT_PAGES,
  printBlocks,
  resolvePrintPart,
  type CriteriaBlock,
  type ResolvedPrintPart,
} from './criteriaModel'

interface Props {
  project: Project
  /** เลขหน้าของหน้าแรกของเกณฑ์การออกแบบในรูปเล่ม */
  firstPage: number
  totalPages: number
}

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
            {block.rows.map((row, r) =>
              row.length === 1 && block.columns.length > 1 ? (
                <tr key={r} className="criteria-subhead">
                  <td colSpan={block.columns.length}>{row[0]}</td>
                </tr>
              ) : (
                <tr key={r}>
                  {row.map((cell, i) => (
                    <td key={i} className={block.columns[i].num ? 'num' : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ),
            )}
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

/** หมวดทั้งหมดหรือบางช่วงบล็อก — ช่วงที่ต่อจากหน้าก่อนติดคำว่า "(ต่อ)" ที่หัวหมวด */
function PrintSection({ section, number, from, to }: ResolvedPrintPart) {
  const blocks = printBlocks(section).slice(from, to)
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
                {from > 0 && ' (ต่อ)'}
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
      {CRITERIA_PRINT_PAGES.map((parts, i) => (
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
            {parts.map((part) => {
              const resolved = resolvePrintPart(part)
              return resolved && <PrintSection key={`${resolved.section.id}-${resolved.from}`} {...resolved} />
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
