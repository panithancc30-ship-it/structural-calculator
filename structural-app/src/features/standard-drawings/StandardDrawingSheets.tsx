import type { Project } from '@/engine/shared/types'
import type { StandardDrawing } from './standardDrawings'

interface Props {
  project: Project
  drawings: StandardDrawing[]
  /** เลขหน้าของแบบแผ่นแรกในรูปเล่ม */
  firstPage: number
  totalPages: number
}

/** รูปแบบมาตรฐานเป็นภาพ ใช้ viewBox ตัดขอบต้นฉบับออกโดยไม่แก้ไฟล์ภาพ */
function DrawingFigure({ drawing }: { drawing: StandardDrawing }) {
  const { x, y, width, height } = drawing.crop ?? { x: 0, y: 0, width: drawing.width, height: drawing.height }
  return (
    <svg
      className="standard-drawing"
      viewBox={`${x} ${y} ${width} ${height}`}
      role="img"
      aria-label={drawing.title}
    >
      <image href={drawing.src} width={drawing.width} height={drawing.height} />
    </svg>
  )
}

/** หน้าแบบมาตรฐานท้ายรูปเล่ม — 1 แบบต่อ 1 หน้า ไม่มีการคำนวณ */
export function StandardDrawingSheets({ project, drawings, firstPage, totalPages }: Props) {
  return (
    <>
      {drawings.map((drawing, i) => (
        <section key={drawing.id} className="report-page fit-one-page" data-title={drawing.title}>
          <div className="sheet-header tight">
            <div>
              <strong>{project.name || 'โครงการ'}</strong>
              <div style={{ fontSize: '11.5pt' }}>{project.location}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong>{drawing.title}</strong>
              <div style={{ fontSize: '11.5pt' }}>แบบมาตรฐาน ไม่มีการคำนวณ</div>
            </div>
          </div>

          <div className="standard-drawing-figure">
            <DrawingFigure drawing={drawing} />
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
