import type { Project } from '@/engine/shared/types'

interface Props {
  project: Project
  title: string
  pageNumber: number
  totalPages: number
}

/** หน้าแทนรายการที่ข้อมูลไม่สมบูรณ์ — ยังนับเป็นหนึ่งหน้าเพื่อให้เลขหน้าในสารบัญตรง */
export function ConcreteSheetFallback({ project, title, pageNumber, totalPages }: Props) {
  return (
    <section className="report-page" data-title={title}>
      <div className="sheet-header tight">
        <strong>{project.name || 'โครงการ'}</strong>
        <strong>{title}</strong>
      </div>
      <p>ข้อมูลของรายการนี้ไม่สมบูรณ์ จึงคำนวณไม่ได้ — เปิดรายการในแท็บ “รายการคำนวณ” เพื่อตรวจสอบและแก้ไข</p>
      <div className="sheet-footer">
        <span>{project.name}</span>
        <span>
          หน้า {pageNumber} / {totalPages}
        </span>
      </div>
    </section>
  )
}
