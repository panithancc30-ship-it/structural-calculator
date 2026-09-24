import type { CalcStep } from '../../domain/types';

export function CalcSteps({ steps }: { steps: CalcStep[] }) {
  return (
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
  );
}
