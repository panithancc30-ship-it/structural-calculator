import type { CalcStep } from '@/engine/concrete/types';

export function CalcSteps({ steps }: { steps: CalcStep[] }) {
  // ค่าในคอลัมน์ขวาไม่ตัดบรรทัด — จอแคบให้เลื่อนตารางในกรอบตัวเอง ไม่ดันทั้งหน้าให้กว้างเกินจอ
  return (
    <div className="table-scroll">
      <table className="steps">
        <tbody>
          {steps.map((s, i) => (
            <tr key={`${s.label}-${i}`}>
              <th>{s.label}</th>
              <td className="formula">{s.formula}</td>
              <td className="num">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
