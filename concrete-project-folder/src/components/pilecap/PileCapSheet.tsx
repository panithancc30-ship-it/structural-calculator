import { ACI318_WSD_PILECAP } from '../../domain/codes/aci318Wsd';
import { fmt } from '../../domain/format';
import type { PileCapAnalysis } from '../../domain/pilecap/analyzePileCap';
import type { PileCapInput } from '../../domain/pilecap/types';
import { CalcSteps } from '../results/CalcSteps';
import { CheckTable } from '../results/CheckTable';
import { StatusBadge } from '../results/StatusBadge';
import { PileCapPlan, PileCapSection } from './PileCapDrawings';
import { PILE_LENGTH_NOTE, pileText } from './pileCapDrawingModel';

const m2 = (cm: number) => fmt(cm / 100, 2);

interface Props {
  input: PileCapInput;
  analysis: PileCapAnalysis;
  /** มาตราส่วนเดียวทั้งแปลนและรูปตัด */
  denom: number;
}

/** ใบรายการคำนวณฐานรากเสาเข็ม A4 หน้าเดียว */
export function PileCapSheet({ input, analysis, denom }: Props) {
  const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const { dims, loads, pile } = analysis;
  const n = loads.piles.nominal.length;

  return (
    <div className="sheet">
      <header className="sheet-head">
        <div className="sheet-title">
          <strong>รายการคำนวณฐานรากเสาเข็ม คสล.</strong>
          <span>วิธีหน่วยแรงใช้งาน (WSD) — {ACI318_WSD_PILECAP.label}</span>
        </div>
        <table className="sheet-meta">
          <tbody>
            <tr>
              <th>โครงการ</th>
              <td>{input.projectName || '-'}</td>
              <th>ฐานราก</th>
              <td>{input.capName || '-'}</td>
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
              Bx × By × t = {m2(dims.B)} × {m2(dims.L)} × {m2(dims.t)} ม.
            </td>
            <td>
              เสา {fmt(input.cx, 0)} × {fmt(input.cy, 0)} ซม., เยื้อง ex = {m2(input.ex)}, ey = {m2(input.ey)} ม.
            </td>
            <td>
              covering = {fmt(input.cover, 1)} ซม., Df = {fmt(input.Df, 2)} ม.
            </td>
          </tr>
          <tr>
            <th>เสาเข็ม</th>
            <td>
              {pileText(input)} × {n} ต้น, ยาว L (ขึ้นอยู่กับผลทดสอบดิน)
            </td>
            <td>
              Pa = {fmt(input.pileCapacity, 2)} ตัน/ต้น, Ta = {fmt(input.pileTension, 2)} ตัน/ต้น
            </td>
            <td>
              s = {m2(input.spacing)} ม., เยื้องหลังตอกสูงสุด {fmt(pile.maxOffset, 1)} ซม.
            </td>
          </tr>
          <tr>
            <th>วัสดุ / แรง</th>
            <td>
              f′c = {fmt(input.fc, 0)} ksc, fy = {fmt(input.fy, 0)} ksc
            </td>
            <td>P = {fmt(input.P / 1000, 2)} ตัน</td>
            <td>
              Mx = {fmt(input.Mx / 1000, 2)}, My = {fmt(input.My / 1000, 2)} t·m
            </td>
          </tr>
          <tr>
            <th>ผลออกแบบ</th>
            <td>
              Rmax = {fmt(pile.Rmax / 1000, 2)}, Rmin = {fmt(pile.Rmin / 1000, 2)} ตัน/ต้น
            </td>
            <td>R: {loads.service.R.map((r) => fmt(r / 1000, 1)).join(', ')} ตัน</td>
            <td>
              เหล็ก X {analysis.x.count}-{analysis.x.size}, Y {analysis.y.count}-{analysis.y.size}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="sheet-footing-body sheet-pilecap-body">
        <figure className="plan">
          <PileCapPlan input={input} analysis={analysis} denom={denom} physicalSize />
        </figure>
        <div className="sections-stack">
          {(['x', 'y'] as const).map((dir) => (
            <figure key={dir}>
              <PileCapSection input={input} analysis={analysis} denom={denom} dir={dir} physicalSize />
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
          <div>หมายเหตุ: หน่วย kg, cm, ksc — ฐานรากแข็ง แรงในเข็มแปรผันเชิงเส้นรอบศูนย์ถ่วงกลุ่มเข็มจริง รวมผลเยื้องศูนย์ของเสาและเข็ม</div>
          <div>ออกแบบโครงสร้างด้วยแรงเข็มจาก P, M (น้ำหนักฐานรากถ่ายลงเข็มโดยตรง); เข็มคร่อมหน้าตัดวิกฤตคิดตามสัดส่วน (ACI 15.5.4)</div>
          <div>{PILE_LENGTH_NOTE}</div>
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
