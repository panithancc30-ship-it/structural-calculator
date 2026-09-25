import type { ColumnAnalysis } from '@/engine/concrete/column/analyzeColumn';
import type { InteractionCurve } from '@/engine/concrete/column/interaction';
import { DRAWING_FONT } from '../drawing/drawingModel';

interface Series {
  key: string;
  name: string;
  curve: InteractionCurve;
  /** kg·cm */
  M: number;
  color: string;
  dash?: string;
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function axis(maxValue: number) {
  const step = niceStep(Math.max(maxValue, 1e-6) / 5);
  const max = Math.ceil((maxValue * 1.05) / step) * step || step;
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  return { max, ticks };
}

const label = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2))));

/** เส้นกำลังยอมให้ P–M ตาม วสท. พร้อมจุดแรงใช้งาน — หน่วย ตัน, t·m */
export function InteractionChart({ analysis, P }: { analysis: ColumnAnalysis; P: number }) {
  const finite = (v: number) => (Number.isFinite(v) ? v : 0);
  const series: Series[] = analysis.spiral
    ? [{ key: 'r', name: 'กำลังยอมให้ (ลัพธ์)', curve: analysis.curveX, M: finite(Math.hypot(analysis.Mx, analysis.My)), color: '#1d5fbf' }]
    : [
        { key: 'x', name: 'รอบแกน x', curve: analysis.curveX, M: finite(analysis.Mx), color: '#1d5fbf' },
        { key: 'y', name: 'รอบแกน y', curve: analysis.curveY, M: finite(analysis.My), color: '#c2410c', dash: '5 3' },
      ];

  const W = 340;
  const H = 250;
  const L = 44;
  const R = 12;
  const T = 12;
  /** ขอบล่างรวมตัวเลขแกน ชื่อแกน และแถวคำอธิบายสัญลักษณ์ */
  const B = 54;
  const xs = axis(Math.max(...series.flatMap((s) => [...s.curve.points.map((p) => p.M / 1e5), s.M / 1e5])));
  const ys = axis(Math.max(...series.map((s) => s.curve.Pmax / 1000), P / 1000));
  const sx = (mTm: number) => L + (mTm / xs.max) * (W - L - R);
  const sy = (pTon: number) => H - B - (pTon / ys.max) * (H - T - B);

  return (
    <svg className="interaction-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="แผนภาพ P–M" fontFamily={DRAWING_FONT}>
      <rect x={0} y={0} width={W} height={H} fill="#fff" />
      <g stroke="#e3e6ea" strokeWidth={0.8}>
        {xs.ticks.map((t) => (
          <line key={`gx${t}`} x1={sx(t)} x2={sx(t)} y1={T} y2={H - B} />
        ))}
        {ys.ticks.map((t) => (
          <line key={`gy${t}`} x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} />
        ))}
      </g>
      <g stroke="#333" strokeWidth={1}>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} />
        <line x1={L} x2={L} y1={T} y2={H - B} />
      </g>
      <g fontSize={9} fill="#444">
        {xs.ticks.map((t) => (
          <text key={`tx${t}`} x={sx(t)} y={H - B + 12} textAnchor="middle">
            {label(t)}
          </text>
        ))}
        {ys.ticks.map((t) => (
          <text key={`ty${t}`} x={L - 5} y={sy(t) + 3} textAnchor="end">
            {label(t)}
          </text>
        ))}
        <text x={(L + W - R) / 2} y={H - B + 26} textAnchor="middle" fontSize={10}>
          M (t·m)
        </text>
        <text transform={`translate(11,${(T + H - B) / 2}) rotate(-90)`} textAnchor="middle" fontSize={10}>
          P (ตัน)
        </text>
      </g>

      {series.map((s) => (
        <g key={s.key}>
          <polyline
            points={s.curve.points.map((p) => `${sx(p.M / 1e5)},${sy(p.P / 1000)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={1.8}
            strokeDasharray={s.dash}
            strokeLinejoin="round"
          />
          <line x1={L} y1={H - B} x2={sx(s.M / 1e5)} y2={sy(P / 1000)} stroke={s.color} strokeWidth={0.8} strokeDasharray="2 2" />
          <circle cx={sx(s.M / 1e5)} cy={sy(P / 1000)} r={4} fill={s.color} stroke="#fff" strokeWidth={1.2} />
        </g>
      ))}

      {/* คำอธิบายสัญลักษณ์เป็นแถวใต้กราฟ — เส้นกำลังผ่านได้ทุกมุมของพื้นที่กราฟ จึงไม่วางทับในกราฟ */}
      <g fontSize={9.5} fill="#222">
        {series.map((s, i) => (
          <g key={s.key} transform={`translate(${L + i * 100},${H - 6})`}>
            <line x1={0} x2={18} y1={-3} y2={-3} stroke={s.color} strokeWidth={1.8} strokeDasharray={s.dash} />
            <text x={23} y={0}>
              {s.name}
            </text>
          </g>
        ))}
        <g transform={`translate(${L + series.length * 100},${H - 6})`}>
          <circle cx={9} cy={-3} r={3.5} fill="#555" />
          <text x={23} y={0}>
            จุดแรงใช้งาน
          </text>
        </g>
      </g>
    </svg>
  );
}
