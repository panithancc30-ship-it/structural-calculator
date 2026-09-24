import type { BeamAnalysis } from '../../domain/design/designBeam';
import { worstStatus } from '../../domain/design/sectionCheck';
import { ACI318_WSD } from '../../domain/codes/aci318Wsd';
import { fmt } from '../../domain/format';
import type { BeamInput, SectionKey, SectionLayout } from '../../domain/types';
import { SectionDrawing } from '../drawing/SectionDrawing';
import { SECTION_TITLES, SUPPORT_TH } from '../labels';
import { CheckTable } from '../results/CheckTable';
import { StatusBadge, StatusIcon } from '../results/StatusBadge';

interface Props {
  input: BeamInput;
  layouts: Record<SectionKey, SectionLayout>;
  analysis: BeamAnalysis;
  denom: number;
}

/** ใบรายการคำนวณ A4 หน้าเดียว (190 × 277 มม. ภายในขอบกระดาษ 10 มม.) */
export function PrintSheet({ input, layouts, analysis, denom }: Props) {
  const p = analysis.params;
  const date = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  const overall = worstStatus([...analysis.A.checks, ...analysis.B.checks, ...analysis.beamChecks]);
  const keys: SectionKey[] = ['A', 'B'];

  return (
    <div className="sheet">
      <header className="sheet-head">
        <div className="sheet-title">
          <strong>รายการคำนวณออกแบบคานคอนกรีตเสริมเหล็ก</strong>
          <span>วิธีหน่วยแรงใช้งาน (WSD) — {ACI318_WSD.label}</span>
        </div>
        <table className="sheet-meta">
          <tbody>
            <tr>
              <th>โครงการ</th>
              <td>{input.projectName || '-'}</td>
              <th>คาน</th>
              <td>{input.beamName || '-'}</td>
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
            <td>
              b × h = {fmt(input.b, 0)} × {fmt(input.h, 0)} ซม.
            </td>
            <td>
              L = {fmt(input.L, 2)} ม. ({SUPPORT_TH[input.support]})
            </td>
            <td>covering = {fmt(input.cover, 1)} ซม.</td>
          </tr>
          <tr>
            <th>วัสดุ</th>
            <td>f′c = {fmt(input.fc, 0)} ksc</td>
            <td>fy เหล็กยืน = {fmt(input.fy, 0)} ksc</td>
            <td>fy เหล็กปลอก = {fmt(input.fyv, 0)} ksc</td>
          </tr>
          <tr>
            <th>แรงภายใน</th>
            <td>M = ±{fmt(input.M, 0)} kg·m</td>
            <td>V = {fmt(input.V, 0)} kg</td>
            <td>T = {fmt(input.T, 0)} kg·m</td>
          </tr>
          <tr>
            <th>ค่าออกแบบ</th>
            <td>
              n = {p.n}, k = {fmt(p.k, 3)}, j = {fmt(p.j, 3)}
            </td>
            <td>
              fc = {fmt(p.fcAllow, 1)}, fs = {fmt(p.fsAllow, 0)}, fv = {fmt(p.fvAllow, 0)} ksc
            </td>
            <td>R = {fmt(p.R, 2)} ksc</td>
          </tr>
        </tbody>
      </table>

      <div className="sheet-drawings">
        {keys.map((key) => (
          <figure key={key}>
            <SectionDrawing
              input={input}
              layout={layouts[key]}
              denom={denom}
              title={SECTION_TITLES[key].title}
              subtitle={SECTION_TITLES[key].subtitle}
              physicalSize
            />
          </figure>
        ))}
      </div>

      <div className="sheet-results">
        {keys.map((key) => {
          const a = analysis[key];
          const t = SECTION_TITLES[key];
          return (
            <section key={key}>
              <h3>
                <span>
                  {t.title} — {t.subtitle} ({t.moment})
                </span>
                <StatusBadge status={a.status} />
              </h3>
              <CheckTable checks={a.checks} compact />
              <div className="sheet-steps">
                {a.steps
                  .filter((s) => s.print)
                  .map((s, i) => (
                    <span key={i}>
                      <b>{s.label}</b> = {s.value}
                    </span>
                  ))}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="sheet-foot">
        <div className="sheet-notes">
          {analysis.beamChecks.map((c) => (
            <div key={c.id}>
              <StatusIcon status={c.status} /> {c.label}: {c.required} ใช้ {c.provided}
            </div>
          ))}
          <div>
            หมายเหตุ: หน่วย kg, cm, ksc — ใช้ M ค่าเดียวออกแบบทั้ง M+ (A-A) และ M− (B-B); V และ T ใช้ตรวจทั้งสองหน้าตัด
          </div>
        </div>
        <div className="sheet-sign">
          <div>
            ผลการตรวจสอบรวม: <StatusBadge status={overall} />
          </div>
          <div className="sign-line">ลงชื่อ ....................................... ผู้ออกแบบ</div>
        </div>
      </footer>
    </div>
  );
}
