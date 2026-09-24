import { ACI318_WSD_FOOTING } from '../../domain/codes/aci318Wsd';
import type { FootingAnalysis } from '../../domain/footing/analyzeFooting';
import type { FootingInput } from '../../domain/footing/types';
import { fmt } from '../../domain/format';
import { CalcSteps } from '../results/CalcSteps';
import { CheckTable } from '../results/CheckTable';
import { StatusBadge } from '../results/StatusBadge';
import { FootingPlan, FootingSection } from './FootingDrawings';
import { POSITION_TH, planTitle, sectionTitle } from './footingDrawingModel';

const m2 = (cm: number) => fmt(cm / 100, 2);

interface Props {
  input: FootingInput;
  analysis: FootingAnalysis;
  planDenom: number;
  sectionDenom: number;
}

/** ใบรายการคำนวณฐานราก A4 หน้าเดียว */
export function FootingSheet({ input, analysis, planDenom, sectionDenom }: Props) {
  const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const { dims, loads } = analysis;
  const p = loads.pressure;

  return (
    <div className="sheet">
      <header className="sheet-head">
        <div className="sheet-title">
          <strong>รายการคำนวณออกแบบฐานรากแผ่คอนกรีตเสริมเหล็ก</strong>
          <span>วิธีหน่วยแรงใช้งาน (WSD) — {ACI318_WSD_FOOTING.label}</span>
        </div>
        <table className="sheet-meta">
          <tbody>
            <tr>
              <th>โครงการ</th>
              <td>{input.projectName || '-'}</td>
              <th>ฐานราก</th>
              <td>{input.footingName || '-'}</td>
            </tr>
            <tr>
              <th>ผู้ออกแบบ</th>
              <td>{input.designer || '-'}</td>
              <th>วันที่</th>
              <td>{date}</td>
            </tr>
          </tbody>
        </table>
      </header>

      <table className="sheet-inputs">
        <tbody>
          <tr>
            <th>ฐานราก</th>
            <td>
              B × L × t = {m2(dims.B)} × {m2(dims.L)} × {m2(dims.t)} ม. ({input.sizeMode === 'auto' ? 'อัตโนมัติ' : 'กำหนดเอง'})
            </td>
            <td>
              เสา {fmt(input.cx, 0)} × {fmt(input.cy, 0)} ซม. — {POSITION_TH[input.position]}
            </td>
            <td>
              covering = {fmt(input.cover, 1)} ซม., Df = {fmt(input.Df, 2)} ม.
            </td>
          </tr>
          <tr>
            <th>ดิน / วัสดุ</th>
            <td>
              qa = {fmt(input.qa, 2)} t/m², γs = {fmt(input.gammaSoil, 2)} t/m³
            </td>
            <td>f′c = {fmt(input.fc, 0)} ksc</td>
            <td>fy = {fmt(input.fy, 0)} ksc</td>
          </tr>
          <tr>
            <th>แรงใช้งาน</th>
            <td>P = {fmt(input.P / 1000, 2)} ตัน</td>
            <td>Mx = {fmt(input.Mx / 1000, 2)} t·m</td>
            <td>My = {fmt(input.My / 1000, 2)} t·m</td>
          </tr>
          <tr>
            <th>ผลออกแบบ</th>
            <td>
              qmax = {fmt(p.qmax * 10, 2)} t/m² (ดินรับแรง {fmt(p.contactRatio * 100, 0)}%)
            </td>
            <td>
              ex = {m2(loads.ex)}, ey = {m2(loads.ey)} ม.
            </td>
            <td>
              เหล็ก X {analysis.x.count}-{analysis.x.size}, Y {analysis.y.count}-{analysis.y.size}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="sheet-footing-body">
        <figure className="plan">
          <FootingPlan input={input} analysis={analysis} denom={planDenom} title={planTitle(input)} physicalSize />
        </figure>
        <div className="sections-stack">
          {(['x', 'y'] as const).map((dir) => (
            <figure key={dir}>
              <FootingSection input={input} analysis={analysis} denom={sectionDenom} dir={dir} title={sectionTitle(dir)} physicalSize />
            </figure>
          ))}
        </div>
      </div>

      <div className="sheet-results">
        <section>
          <h3>
            <span>ผลการตรวจสอบ</span>
            <StatusBadge status={analysis.status} />
          </h3>
          <CheckTable checks={analysis.checks} compact />
        </section>
        <section>
          <h3>
            <span>ค่าคำนวณหลัก</span>
          </h3>
          <CalcSteps steps={analysis.steps.filter((s) => s.print)} />
        </section>
      </div>

      <footer className="sheet-foot">
        <div className="sheet-notes">
          <div>หมายเหตุ: หน่วย kg, cm, ksc — แรงดันดินจากแรงใช้งาน ฐานรากแข็ง ดินไม่รับแรงดึง; qa เทียบแรงดันรวมน้ำหนักฐานรากและดินถม</div>
          <div>ออกแบบโครงสร้างด้วยแรงดันสุทธิ (q − w); เฉือนทะลุรวมผลโมเมนต์ถ่ายเท γv·M·c/J; ตีนเป็ดให้ดินรับโมเมนต์จากการเยื้องศูนย์ทั้งหมด</div>
        </div>
        <div className="sheet-sign">
          <div>
            ผลการตรวจสอบรวม: <StatusBadge status={analysis.status} />
          </div>
          <div className="sign-line">ลงชื่อ ....................................... ผู้ออกแบบ</div>
        </div>
      </footer>
    </div>
  );
}
