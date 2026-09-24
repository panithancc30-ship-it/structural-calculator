import { useMemo, type MouseEvent } from 'react';
import type { SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab';
import type { SlabInput, SlabLayout } from '@/engine/concrete/slab/types';
import { Dim, Frame, Leaders, Notes, Title, usePickHandlers } from '../footing/FootingDrawings';
import {
  buildPlanModel,
  buildSectionModel,
  pickKey,
  planTitle,
  sectionTitle,
  type SlabPick,
} from './slabDrawingModel';
import type { BarDir } from '@/engine/concrete/footing/types';

const INK = '#111';
const SUPPORT = '#94a3b8';

interface CommonProps {
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

export function SlabPlan(props: CommonProps) {
  const { input, analysis, layout, denom, interactive = false, selectedKey = null, onPick, onBackgroundClick, physicalSize = false } = props;
  const title = planTitle(input);
  const m = useMemo(
    () => buildPlanModel(input, analysis, layout, denom, title),
    [input, analysis, layout, denom, title],
  );
  const pick = usePickHandlers<SlabPick>({ interactive, onPick });
  const u = m.u;

  return (
    <Frame
      view={m.view}
      sizeMm={m.sizeMm}
      physicalSize={physicalSize}
      interactive={interactive}
      label={`${title} แปลนพื้น`}
      onBackgroundClick={onBackgroundClick}
      className="slab-drawing"
    >
      {/* เหล็กเสริมแต่ละชุด */}
      {m.runs.map((r) => {
        const selected = selectedKey === r.key;
        const handlers = pick({ kind: 'bars', face: r.face, dir: r.dir }) as { className?: string };
        const { className, ...rest } = handlers;
        return (
          <g key={r.key}>
            <g
              stroke={selected ? '#e8590c' : '#1d5fbf'}
              strokeWidth={0.22 * u}
              strokeDasharray={r.dashed ? `${1.2 * u} ${0.8 * u}` : undefined}
            >
              {r.lines.map((l, i) => (
                <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
              ))}
            </g>
            {interactive && (
              <g className={className} {...rest} stroke="transparent" strokeWidth={1.6 * u}>
                {r.lines.map((l, i) => (
                  <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
                ))}
              </g>
            )}
          </g>
        );
      })}

      {/* ขอบพื้นและสภาพรองรับ — ขอบต่อเนื่องวาดเส้นคู่ ขอบอิสระวาดเส้นบาง */}
      {m.edges.map((e) => (
        <g key={e.key}>
          <line
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={INK}
            strokeWidth={e.support === 'free' ? 0.18 * u : 0.4 * u}
            strokeDasharray={e.support === 'free' ? `${1.5 * u} ${1 * u}` : undefined}
          />
          {e.support === 'continuous' && (
            <line
              x1={e.x1 + (e.x1 === e.x2 ? (e.x1 < 0 ? 1.1 * u : -1.1 * u) : 0)}
              y1={e.y1 + (e.y1 === e.y2 ? (e.y1 < 0 ? 1.1 * u : -1.1 * u) : 0)}
              x2={e.x2 + (e.x1 === e.x2 ? (e.x1 < 0 ? 1.1 * u : -1.1 * u) : 0)}
              y2={e.y2 + (e.y1 === e.y2 ? (e.y1 < 0 ? 1.1 * u : -1.1 * u) : 0)}
              stroke={SUPPORT}
              strokeWidth={0.25 * u}
            />
          )}
        </g>
      ))}

      <Notes notes={m.notes} size={m.sizes.small} halo u={u} />
      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      {m.dims.map((line, i) => (
        <Dim key={i} line={line} size={m.sizes.dim} u={u} />
      ))}
      <Leaders
        leaders={m.leaders}
        u={u}
        size={m.sizes.label}
        subSize={m.sizes.small}
        selectedDir={null}
        pick={() => ({})}
        selectedKey={selectedKey}
        pickOf={(l) => {
          const [face, dir] = l.key.split('-') as ['bottom' | 'top', BarDir];
          return pick({ kind: 'bars', face, dir });
        }}
      />
      <Title tb={m.titleBlock} u={u} />
    </Frame>
  );
}

export function SlabSection(props: CommonProps & { dir: BarDir }) {
  const { input, analysis, layout, denom, dir, interactive = false, selectedKey = null, onPick, onBackgroundClick, physicalSize = false } = props;
  const title = sectionTitle(dir);
  const m = useMemo(
    () => buildSectionModel(input, analysis, layout, dir, denom, title),
    [input, analysis, layout, dir, denom, title],
  );
  const pick = usePickHandlers<SlabPick>({ interactive, onPick });
  const u = m.u;

  return (
    <Frame
      view={m.view}
      sizeMm={m.sizeMm}
      physicalSize={physicalSize}
      interactive={interactive}
      label={`${title} รูปตัดพื้น`}
      onBackgroundClick={onBackgroundClick}
      className="slab-drawing"
    >
      {/* คานรองรับใต้ท้องพื้น — วาดก่อนแผ่นพื้นเพื่อให้เส้นท้องพื้นทับด้านบนของคาน */}
      {m.beams.map((b, i) => (
        <rect
          key={i}
          x={b.x - b.w / 2}
          y={m.t}
          width={b.w}
          height={b.h}
          fill="#fff"
          stroke={INK}
          strokeWidth={0.25 * u}
        />
      ))}

      {/* ดินใต้พื้น */}
      {m.ground && (
        <g stroke={INK} strokeWidth={0.13 * u} fill="none">
          <path d={m.ground.path} strokeWidth={0.3 * u} />
          <path d={m.ground.hatch} />
        </g>
      )}

      {/* หน้าตัดพื้น */}
      <rect
        x={m.slab.x1}
        y={0}
        width={m.slab.x2 - m.slab.x1}
        height={m.t}
        fill="none"
        stroke={INK}
        strokeWidth={0.3 * u}
      />

      {/* เหล็กที่ขนานกับระนาบตัด */}
      {m.runs.map((r) => {
        const selected = selectedKey === r.key;
        const { className, ...rest } = pick({
          kind: 'bars',
          face: r.face,
          dir,
        }) as { className?: string };
        return (
          <g key={r.key}>
            <path d={r.path} fill="none" stroke={selected ? '#e8590c' : '#1d5fbf'} strokeWidth={Math.max(r.width, 0.35 * u)} strokeLinecap="round" />
            {interactive && (
              <path className={className} {...rest} d={r.path} fill="none" stroke="transparent" strokeWidth={1.6 * u} />
            )}
          </g>
        );
      })}

      {/* เหล็กที่ตั้งฉากกับระนาบตัด */}
      {m.dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={Math.max(d.r, 0.22 * u)}
          fill={selectedKey === d.key ? '#e8590c' : '#1d5fbf'}
        />
      ))}

      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      {m.dims.map((line, i) => (
        <Dim key={i} line={line} size={m.sizes.dim} u={u} />
      ))}
      <Notes notes={m.notes} size={m.sizes.small} u={u} />
      <Leaders
        leaders={m.leaders}
        u={u}
        size={m.sizes.label}
        subSize={m.sizes.small}
        selectedDir={null}
        pick={() => ({})}
        selectedKey={selectedKey}
        pickOf={(l) => {
          const [face] = l.key.split('-') as ['bottom' | 'top'];
          return pick({ kind: 'bars', face, dir });
        }}
      />
      <Title tb={m.titleBlock} u={u} />
    </Frame>
  );
}

export { pickKey };
