import { useMemo, type MouseEvent } from 'react';
import type { SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab';
import type { SlabInput, SlabLayout } from '@/engine/concrete/slab/types';
import { Frame, usePickHandlers } from '../footing/FootingDrawings';
import { DetailTitleText } from './GroundSlabDrawings';
import { buildSlabDetail, detailTitleText, LEVEL_SUFFIX, rolePick, type DetailRole } from './slabDetailModel';
import { pickKey, type SlabPick } from './slabDrawingModel';

const INK = '#111';
const BAR = '#1d5fbf';
const CONTEXT = '#8a96a8';
const HIGHLIGHT = '#e8590c';

interface Props {
  input: SlabInput;
  analysis: SlabAnalysis;
  layout: SlabLayout;
  denom: number;
  interactive?: boolean;
  /** คีย์ของชุดเหล็กที่เลือกอยู่ (ผิว-ทิศ) */
  selectedKey?: string | null;
  onPick?: (pick: SlabPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  physicalSize?: boolean;
}

/** แบบขยายพื้น S1 — คลิกเหล็กหรือป้ายเหล็กเพื่อแก้เหล็กชุดนั้น */
export function SlabDetailDrawing(props: Props) {
  const { input, analysis, layout, denom, interactive = false, selectedKey = null, onBackgroundClick, physicalSize = false } = props;
  const m = useMemo(() => buildSlabDetail(input, analysis, layout, denom), [input, analysis, layout, denom]);
  const pick = usePickHandlers<SlabPick>(props);
  const u = m.u;
  const roleHandlers = (role: DetailRole) => pick(rolePick(role, analysis)) as { className?: string };
  // ชุดที่เลือกวาดทีหลังสุด สีไฮไลต์จึงไม่ถูกเหล็กชุดอื่นที่ซ้อนแนวเดียวกันทับ
  const bars = [...m.bars].sort((a, b) => Number(a.key === selectedKey) - Number(b.key === selectedKey));

  return (
    <Frame
      view={m.view}
      sizeMm={m.sizeMm}
      physicalSize={physicalSize}
      interactive={interactive}
      label={`${detailTitleText(input)} ${LEVEL_SUFFIX[m.level]}`}
      onBackgroundClick={onBackgroundClick}
      className="slab-drawing"
    >
      <path d={m.concrete} fill="#fff" stroke={INK} strokeWidth={0.3 * u} strokeLinejoin="round" />
      <path d={m.breakLine} fill="none" stroke={INK} strokeWidth={0.15 * u} />
      <path
        d={m.centerLines}
        stroke="#888"
        strokeWidth={0.09 * u}
        strokeDasharray={`${2.5 * u} ${0.6 * u} ${0.4 * u} ${0.6 * u}`}
      />

      {/* เหล็กพื้นข้างเคียง (พื้นลดระดับ) */}
      {m.context.map((b, i) => (
        <path key={i} d={b.path} fill="none" stroke={CONTEXT} strokeWidth={b.width} strokeLinecap="round" strokeLinejoin="round" />
      ))}

      {/* เหล็กคอม้าและเสริมพิเศษ */}
      {bars.map((b, i) => (
        <path
          key={i}
          d={b.path}
          fill="none"
          stroke={b.key === selectedKey ? HIGHLIGHT : BAR}
          strokeWidth={b.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {m.dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.key === selectedKey ? HIGHLIGHT : BAR} />
      ))}
      {interactive &&
        bars.map((b, i) => (
          <path key={i} {...roleHandlers(b.role)} d={b.path} fill="none" stroke="transparent" strokeWidth={1.6 * u} />
        ))}
      {interactive && (
        <g {...roleHandlers('cross')}>
          {m.dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={1.2 * u} fill="transparent" />
          ))}
        </g>
      )}

      {/* เส้นบอกระยะ L/4, L/5, Short Span และความหนา */}
      <g stroke={INK} fill="none">
        <path d={m.dims.lines} strokeWidth={0.13 * u} />
        <path d={m.dims.ticks} strokeWidth={0.3 * u} />
        <path d={m.dims.crosses} strokeWidth={0.18 * u} />
      </g>
      <g fill="#fff" stroke={INK} strokeWidth={0.13 * u}>
        {m.dims.origins.map((o, i) => (
          <circle key={i} cx={o.x} cy={o.y} r={0.4 * u} />
        ))}
      </g>
      <g fontSize={m.sizes.dim} fill={INK}>
        {m.dims.labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} textAnchor={l.anchor}>
            {l.text}
          </text>
        ))}
      </g>

      {/* ป้ายชี้เหล็ก — แตะเพื่อแก้เหล็กชุดนั้น */}
      {m.callouts.map((c) => {
        const role = c.role === 'cover' ? null : c.role;
        const target = role ? rolePick(role, analysis) : null;
        const selected = target !== null && pickKey(target.face, target.dir) === selectedKey;
        const color = selected ? HIGHLIGHT : INK;
        const { className, ...handlers } = role ? roleHandlers(role) : {};
        return (
          <g key={c.role} className={className ? 'label hit' : 'label'} {...handlers}>
            {c.lines.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={color} strokeWidth={0.13 * u} />
            ))}
            {c.arrows && <path d={c.arrows} fill={color} stroke="none" />}
            {c.ring && <circle cx={c.ring.x} cy={c.ring.y} r={c.ring.r} fill="none" stroke={color} strokeWidth={0.13 * u} />}
            <text x={c.text.x} y={c.text.y} fontSize={m.sizes.label} fill={color} textAnchor={c.text.anchor}>
              {c.text.text}
            </text>
          </g>
        );
      })}

      <DetailTitleText title={m.title} sizes={m.sizes} u={u} />
    </Frame>
  );
}
