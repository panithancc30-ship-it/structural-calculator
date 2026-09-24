import type { Project } from '../engine/shared/types'

function formatThaiDate(iso: string): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ]
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`
}

export function CoverPage({ project }: { project: Project }) {
  const rows: Array<[string, string]> = [
    ['ชื่อโครงการ', project.name || '-'],
    ['สถานที่ก่อสร้าง', project.location || '-'],
    ['เจ้าของอาคาร', project.owner || '-'],
    ['ขอบเขตการคำนวณ', project.scope || '-'],
    ['วันที่', formatThaiDate(project.documentDate)],
  ]

  return (
    <section className="report-page">
      <div style={{ marginTop: '3cm' }}>
        <div className="cover-title">รายการคำนวณ</div>
        <div className="cover-title" style={{ fontSize: '24pt', marginTop: '6pt' }}>
          งานวิศวกรรมโครงสร้าง
        </div>
      </div>

      <table className="report-table" style={{ marginTop: '2.4cm' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th style={{ width: '32%' }}>{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="signature-grid">
        <div className="signature-box">
          <div>({project.engineerName || '.'.repeat(28)})</div>
          <div>ผู้คำนวณออกแบบ</div>
          <div>ใบอนุญาตเลขที่ {project.engineerLicense || '..............'}</div>
        </div>
        <div className="signature-box">
          <div>({project.checkerName || '.'.repeat(28)})</div>
          <div>ผู้ตรวจสอบ</div>
          <div>ใบอนุญาตเลขที่ {project.checkerLicense || '..............'}</div>
        </div>
      </div>

      <div style={{ marginTop: 'auto', fontSize: '13pt', color: '#4b5563' }}>
        หมายเหตุ: รายการคำนวณนี้จัดทำด้วยโปรแกรมช่วยคำนวณ
        ผู้ออกแบบได้ตรวจสอบความถูกต้องของสมมติฐานและผลลัพธ์แล้ว
      </div>
    </section>
  )
}
