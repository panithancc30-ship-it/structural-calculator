import { ACI318_WSD_COLUMN } from '../../domain/codes/aci318Wsd';
import { METHOD_TH, type ColumnAnalysis } from '../../domain/column/analyzeColumn';
import type { ColumnInput, ColumnLayout } from '../../domain/column/types';
import { fmt } from '../../domain/format';
import { CalcSteps } from '../results/CalcSteps';
import { CheckTable } from '../results/CheckTable';
import { StatusBadge } from '../results/StatusBadge';
import { ColumnDrawing } from './ColumnDrawing';
import { InteractionChart } from './InteractionChart';

interface Props {
  input: ColumnInput;
  layout: ColumnLayout;
  analysis: ColumnAnalysis;
  denom: number;
}

/** ใบรายการคำนวณเสา A4 หน้าเดียว */
export function ColumnSheet({ input, layout, analysis, denom }: Props) {
  const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = `SECTION ${input.columnName || 'C1'}`;
  const subtitle = input.shape === 'rect' ? 'เสาปลอกเดี่ยว' : 'เสาปลอกเกลียว';
  const util = Number.isFinite(analysis.utilization) ? fmt(analysis.utilization, 2) : '—';

  return (
    <div className="sheet">
      <header className="sheet-head">
        <div className="sheet-title">
          <strong>รายการคำนวณออกแบบเสาคอนกรีตเสริมเหล็ก</strong>
          <span>วิธีหน่วยแรงใช้งาน (WSD) — {ACI318_WSD_COLUMN.label}</span>
        </div>
        <table className="sheet-meta">
          <tbody>
            <tr>
              <th>โครงการ</th>
              <td>{input.projectName || '-'}</td>
              <th>เสา</th>
              <td>{input.columnName || '-'}</td>
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
            <th>หน้าตัด</th>
            <td>{input.shape === 'rect' ? `b × h = ${fmt(input.b, 0)} × ${fmt(input.h, 0)} ซม.` : `D = ${fmt(input.D, 0)} ซม.`}</td>
            <td>covering = {fmt(input.cover, 1)} ซม.</td>
            <td>
              Lu = {fmt(input.Lu, 2)} ม. (k = {ACI318_WSD_COLUMN.autoK.toFixed(1)}, M1/M2 = {ACI318_WSD_COLUMN.autoM1M2.toFixed(1)}, βd = {ACI318_WSD_COLUMN.autoBetaD})
            </td>
          </tr>
          <tr>
            <th>วัสดุ</th>
            <td>f′c = {fmt(input.fc, 0)} ksc</td>
            <td>fy เหล็กยืน = {fmt(input.fy, 0)} ksc</td>
            <td>
              fy {input.shape === 'rect' ? 'ปลอก' : 'เกลียว'} = {fmt(input.fyv, 0)} ksc
            </td>
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
              อัตราส่วนใช้งาน = {util} ({METHOD_TH[analysis.method]})
            </td>
            <td>P ยอมให้ = {fmt(analysis.curveX.Pmax / 1000, 2)} ตัน</td>
            <td>
              ρg = {fmt(analysis.rho * 100)} %, φ = {analysis.phi}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="sheet-column-body">
        <figure>
          <ColumnDrawing input={input} layout={layout} denom={denom} title={title} subtitle={subtitle} physicalSize />
        </figure>
        <figure>
          <InteractionChart analysis={analysis} P={input.P} />
          <figcaption>แผนภาพ P–M กำลังยอมให้ (0.4φ) และจุดแรงใช้งาน</figcaption>
        </figure>
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
          <div>หมายเหตุ: หน่วย kg, cm, ksc — กำลังยอมให้ = 0.4 × กำลังออกแบบ SDM (φ = 0.70 ปลอกเดี่ยว, 0.75 ปลอกเกลียว)</div>
          <div>ผลความชะลูดใช้วิธีขยายโมเมนต์ โดยแทน Pu ด้วย 2.5P; แรงดัดสองแกนตรวจด้วยวิธี Bresler / load contour</div>
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
