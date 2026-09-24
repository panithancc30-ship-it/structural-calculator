import { useMemo, type MouseEvent } from 'react';
import type { StairAnalysis } from '@/engine/concrete/stair/analyzeStair';
import type { StairBarKey, StairInput, StairLayout } from '@/engine/concrete/stair/types';
import { Dim, Frame, Title, usePickHandlers } from '../footing/FootingDrawings';
import { buildStairModel, stairTitle, type StairPick } from './stairDrawingModel';

const INK = '#111';
const STEEL = '#1d5fbf';
const HIGHLIGHT = '#e8590c';

interface Props {
  input: StairInput;
  analysis: StairAnalysis;
  layout: StairLayout;
  denom: number;
  interactive?: boolean;
  /** เหล็กชุดที่เลือกอยู่ */
  selectedKey?: StairBarKey | null;
  onPick?: (pick: StairPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  physicalSize?: boolean;
}

export function StairSection(props: Props) {
  const {
    input, analysis, layout, denom, interactive = false, selectedKey = null, onPick, onBackgroundClick,
    physicalSize = false,
  } = props;
  const m = useMemo(() => buildStairModel(input, analysis, layout, denom), [input, analysis, layout, denom]);
  const pick = usePickHandlers<StairPick>({ interactive, onPick });
  const u = m.u;
  const colorOf = (key: string) => (key === selectedKey ? HIGHLIGHT : STEEL);

  return (
    <Frame
      view={m.view}
      sizeMm={m.sizeMm}
      physicalSize={physicalSize}
      interactive={interactive}
      label={`${stairTitle(input)} รูปตัดบันได`}
      onBackgroundClick={onBackgroundClick}
      className="stair-drawing"
    >
      {/* เส้นศูนย์กลางคานรองรับ */}
      <path
        d={m.axes}
        stroke={INK}
        strokeWidth={0.13 * u}
        strokeDasharray={`${3 * u} ${0.8 * u} ${0.4 * u} ${0.8 * u}`}
        fill="none"
      />

      {/* คอนกรีต — ท้องบันได ขั้นบันได ส่วนราบ และคานรองรับเป็นรูปเดียว */}
      <path d={m.outline} fill="#fff" stroke={INK} strokeWidth={0.3 * u} strokeLinejoin="miter" />

      {/* เหล็กที่ขนานกับระนาบตัด */}
      {m.bars.map((b, i) => {
        const { className, ...rest } = pick({ kind: 'bars', key: b.key }) as { className?: string };
        return (
          <g key={i}>
            <path
              d={b.path}
              fill="none"
              stroke={colorOf(b.key)}
              strokeWidth={Math.max(b.width, 0.3 * u)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {interactive && (
              <path className={className} {...rest} d={b.path} fill="none" stroke="transparent" strokeWidth={1.4 * u} />
            )}
          </g>
        );
      })}

      {/* เหล็กที่ตั้งฉากกับระนาบตัด */}
      {m.dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={Math.max(d.r, 0.22 * u)} fill={colorOf(d.key)} />
      ))}

      {/* เครื่องหมายระดับ */}
      <g stroke={INK} strokeWidth={0.13 * u}>
        {m.levels.map((l, i) => (
          <g key={i}>
            <path d={l.line} fill="none" />
            <path d={l.path} fill="none" />
            <text
              x={l.text.x}
              y={l.text.y}
              fontSize={m.sizes.small}
              textAnchor={l.text.anchor}
              fill={INK}
              stroke="none"
            >
              {l.text.text}
            </text>
          </g>
        ))}
      </g>

      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      {m.dims.map((line, i) => (
        <Dim key={i} line={line} size={m.sizes.dim} u={u} />
      ))}

      {/* ป้ายกำกับเหล็ก — ตัวอักษรมีขอบขาวเพื่อให้อ่านได้เมื่อพาดผ่านเส้นศูนย์กลาง */}
      {m.leaders.map((l) => {
        const color = colorOf(l.key);
        const { className, ...handlers } = pick({ kind: 'bars', key: l.key as StairBarKey }) as { className?: string };
        return (
          <g key={l.key} className={className ? 'label hit' : 'label'} {...handlers}>
            <polyline points={l.points} fill="none" stroke={color} strokeWidth={0.13 * u} />
            <g fill={color} stroke="#fff" strokeWidth={0.5 * u} paintOrder="stroke" textAnchor={l.anchor}>
              <text x={l.tx} y={l.ty} fontSize={m.sizes.label}>
                {l.text}
              </text>
              {l.sub && (
                <text x={l.sub.x} y={l.sub.y} fontSize={m.sizes.small}>
                  {l.sub.text}
                </text>
              )}
            </g>
          </g>
        );
      })}

      <Title tb={m.titleBlock} u={u} />
    </Frame>
  );
}
