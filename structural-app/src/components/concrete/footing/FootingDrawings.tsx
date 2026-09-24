import { useId, useMemo, type MouseEvent } from 'react';
import type { FootingAnalysis } from '@/engine/concrete/footing/analyzeFooting';
import type { BarDir, FootingInput } from '@/engine/concrete/footing/types';
import { DRAWING_FONT, textWidth } from '../drawing/drawingModel';
import {
  buildPlanModel,
  buildSectionModel,
  dimBaseline,
  type DimLine,
  type FootingPick,
  type Leader,
  type NoteText,
  type TitleBlock,
} from './footingDrawingModel';

const INK = '#111';
const HIGHLIGHT = '#e8590c';

interface CommonProps {
  input: FootingInput;
  analysis: FootingAnalysis;
  denom: number;
  title: string;
  interactive?: boolean;
  selectedDir?: BarDir | null;
  onPick?: (pick: FootingPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  physicalSize?: boolean;
}

export function useHandlers({ interactive, onPick }: Pick<CommonProps, 'interactive' | 'onPick'>) {
  return (dir: BarDir) =>
    interactive
      ? {
          className: 'hit',
          onClick: (e: MouseEvent<SVGElement>) => {
            e.stopPropagation();
            onPick?.({ kind: 'bars', dir }, e);
          },
        }
      : {};
}

/** ตัวช่วยคลิกแบบทั่วไป ใช้กับโมดูลที่ข้อมูลการเลือกไม่ใช่แค่ทิศ (เช่น พื้นที่เลือกทั้งผิวและทิศ) */
export function usePickHandlers<P>({ interactive, onPick }: {
  interactive?: boolean;
  onPick?: (pick: P, event: MouseEvent<SVGElement>) => void;
}) {
  return (pick: P) =>
    interactive
      ? {
          className: 'hit',
          onClick: (e: MouseEvent<SVGElement>) => {
            e.stopPropagation();
            onPick?.(pick, e);
          },
        }
      : {};
}

/** เส้นบอกขนาด + เครื่องหมายขีด 45° — เส้นยื่นไปถึงตัวเลขที่ย้ายออกนอกช่วง */
export function Dim({ line, size, u }: { line: DimLine; size: number; u: number }) {
  if (line.ticks.length === 0) return null;
  const { row, vertical } = line;
  let lo = line.ticks[0] - 1.2 * u;
  let hi = line.ticks[line.ticks.length - 1] + 1.2 * u;
  for (const t of line.texts) {
    if (t.side > 0) continue;
    const w = textWidth(t.text, size);
    lo = Math.min(lo, t.center - w / 2);
    hi = Math.max(hi, t.center + w / 2);
  }
  const main = line.path ?? (vertical ? `M${row},${lo} V${hi}` : `M${lo},${row} H${hi}`);
  const tick = (p: number) =>
    vertical ? `M${row - 0.9 * u},${p + 0.9 * u} L${row + 0.9 * u},${p - 0.9 * u}` : `M${p - 0.9 * u},${row + 0.9 * u} L${p + 0.9 * u},${row - 0.9 * u}`;
  return (
    <g>
      <path stroke={INK} strokeWidth={0.13 * u} fill="none" d={main} />
      <path stroke={INK} strokeWidth={0.3 * u} fill="none" d={line.ticks.map(tick).join(' ')} />
      <g fill={INK} fontSize={size} textAnchor="middle">
        {line.texts.map((t, i) => {
          const base = dimBaseline(row, t.side, size, u);
          return vertical ? (
            <text key={i} transform={`translate(${base},${t.center}) rotate(-90)`}>
              {t.text}
            </text>
          ) : (
            <text key={i} x={t.center} y={base}>
              {t.text}
            </text>
          );
        })}
      </g>
    </g>
  );
}

export function Leaders({
  leaders, u, size, subSize, selectedDir, pick, selectedKey, pickOf,
}: {
  leaders: Leader[];
  u: number;
  size: number;
  subSize: number;
  selectedDir: BarDir | null;
  pick: ReturnType<typeof useHandlers>;
  /** เทียบกับ Leader.key แทนทิศ — ใช้เมื่อหนึ่งทิศมีได้หลายชุด (พื้นมีทั้งผิวบนและล่าง) */
  selectedKey?: string | null;
  /** กำหนดตัวจัดการคลิกเอง เมื่อข้อมูลการเลือกไม่ใช่แค่ทิศ */
  pickOf?: (leader: Leader) => Record<string, unknown>;
}) {
  return (
    <>
      {leaders.map((l) => {
        const selected = selectedKey !== undefined ? l.key === selectedKey : selectedDir === l.dir;
        const color = selected ? HIGHLIGHT : INK;
        const { className, ...handlers } = (pickOf ? pickOf(l) : pick(l.dir)) as { className?: string };
        return (
          <g key={l.key} className={className ? 'label hit' : 'label'} {...handlers}>
            <polyline points={l.points} fill="none" stroke={color} strokeWidth={0.13 * u} />
            <text x={l.tx} y={l.ty} fontSize={size} fill={color} textAnchor={l.anchor}>
              {l.text}
            </text>
            {l.sub && (
              <text x={l.sub.x} y={l.sub.y} fontSize={subSize} fill={color} textAnchor={l.anchor}>
                {l.sub.text}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

export function Notes({ notes, size, halo = false, u }: { notes: NoteText[]; size: number; halo?: boolean; u: number }) {
  return (
    <g fontSize={size} fill="#222" {...(halo ? { stroke: '#fff', strokeWidth: 0.45 * u, paintOrder: 'stroke' } : {})}>
      {notes.map((n, i) => (
        <text key={i} x={n.x} y={n.y} textAnchor={n.anchor}>
          {n.text}
        </text>
      ))}
    </g>
  );
}

export function Title({ tb, u }: { tb: TitleBlock; u: number }) {
  return (
    <g fill={INK} textAnchor="middle">
      <text x={0} y={tb.titleY} fontSize={tb.titleSize} fontWeight={700}>
        {tb.title}
      </text>
      <path d={`M${-tb.titleW / 2},${tb.titleY + 0.9 * u} h${tb.titleW}`} stroke={INK} strokeWidth={0.35 * u} />
      <path d={`M${-tb.titleW / 2},${tb.titleY + 1.5 * u} h${tb.titleW}`} stroke={INK} strokeWidth={0.13 * u} />
      <text x={0} y={tb.subY} fontSize={tb.subSize}>
        {tb.subText}
      </text>
    </g>
  );
}

export function Frame({
  view, sizeMm, physicalSize, interactive, label, onBackgroundClick, children, className = 'footing-drawing',
}: {
  view: { x: number; y: number; w: number; h: number };
  sizeMm: { w: number; h: number };
  physicalSize: boolean;
  interactive: boolean;
  label: string;
  onBackgroundClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      className={`section-drawing ${className}${interactive ? ' interactive' : ''}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      width={physicalSize ? `${sizeMm.w}mm` : '100%'}
      height={physicalSize ? `${sizeMm.h}mm` : undefined}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      fontFamily={DRAWING_FONT}
      onClick={interactive ? onBackgroundClick : undefined}
    >
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="#fff" />
      {children}
    </svg>
  );
}

export function FootingPlan(props: CommonProps) {
  const { input, analysis, denom, title, interactive = false, selectedDir = null, onBackgroundClick, physicalSize = false } = props;
  const m = useMemo(() => buildPlanModel(input, analysis, denom, title), [input, analysis, denom, title]);
  const pick = useHandlers(props);
  const id = useId().replace(/:/g, '');
  const { u, B, L } = m;

  return (
    <Frame
      view={m.view} sizeMm={m.sizeMm} physicalSize={physicalSize} interactive={interactive}
      label={`${title} แปลนฐานราก`} onBackgroundClick={onBackgroundClick}
    >
      <defs>
        <pattern id={`col-${id}`} patternUnits="userSpaceOnUse" width={1.2 * u} height={1.2 * u} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={1.2 * u} stroke={INK} strokeWidth={0.15 * u} />
        </pattern>
        <pattern id={`gap-${id}`} patternUnits="userSpaceOnUse" width={1.8 * u} height={1.8 * u} patternTransform="rotate(-45)">
          <line x1={0} y1={0} x2={0} y2={1.8 * u} stroke="#9aa3ad" strokeWidth={0.1 * u} />
        </pattern>
      </defs>

      {/* ส่วนที่ดินไม่รับแรงดัน */}
      {m.noContact && <polygon points={m.noContact} fill={`url(#gap-${id})`} stroke="none" />}
      {m.zeroLine && (
        <line
          x1={m.zeroLine.x1} y1={m.zeroLine.y1} x2={m.zeroLine.x2} y2={m.zeroLine.y2}
          stroke="#6b7580" strokeWidth={0.18 * u} strokeDasharray={`${1.2 * u} ${0.6 * u}`}
        />
      )}

      {/* เส้นศูนย์กลางฐานราก */}
      <path
        d={`M${-B / 2 - 1.5 * u},0 H${B / 2 + 1.5 * u} M0,${-L / 2 - 1.5 * u} V${L / 2 + 1.5 * u}`}
        stroke="#888" strokeWidth={0.09 * u} strokeDasharray={`${2.5 * u} ${0.6 * u} ${0.4 * u} ${0.6 * u}`}
      />

      {/* เหล็กเสริม */}
      {(['y', 'x'] as const).map((dir) => (
        <g key={dir} stroke={selectedDir === dir ? HIGHLIGHT : INK} strokeWidth={0.18 * u} strokeLinecap="round">
          {m.lines[dir].map((l, i) => (
            <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
          ))}
        </g>
      ))}
      {interactive &&
        (['y', 'x'] as const).map((dir) => (
          <g key={`hit-${dir}`} stroke="transparent" strokeWidth={1.4 * u} {...pick(dir)}>
            {m.lines[dir].map((l, i) => (
              <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
            ))}
          </g>
        ))}

      {/* ฐานราก + เสา */}
      <rect x={-B / 2} y={-L / 2} width={B} height={L} fill="none" stroke={INK} strokeWidth={0.45 * u} />
      <rect x={m.column.x} y={m.column.y} width={m.column.w} height={m.column.h} fill="#fff" />
      <rect x={m.column.x} y={m.column.y} width={m.column.w} height={m.column.h} fill={`url(#col-${id})`} stroke={INK} strokeWidth={0.35 * u} />

      <Notes notes={m.corners} size={m.sizes.small} halo u={u} />

      {/* เส้นบอกขนาด */}
      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      {m.dims.map((d, i) => (
        <Dim key={i} line={d} size={m.sizes.dim} u={u} />
      ))}

      <Leaders leaders={m.leaders} u={u} size={m.sizes.label} subSize={m.sizes.small} selectedDir={selectedDir} pick={pick} />
      <Title tb={m.titleBlock} u={u} />
      <Notes notes={m.notes} size={m.sizes.small} u={u} />
    </Frame>
  );
}

export function FootingSection(props: CommonProps & { dir: BarDir }) {
  const { input, analysis, denom, title, dir, interactive = false, selectedDir = null, onBackgroundClick, physicalSize = false } = props;
  const m = useMemo(() => buildSectionModel(input, analysis, dir, denom, title), [input, analysis, dir, denom, title]);
  const pick = useHandlers(props);
  const id = useId().replace(/:/g, '');
  const { u, span, t } = m;
  const other: BarDir = dir === 'x' ? 'y' : 'x';

  return (
    <Frame
      view={m.view} sizeMm={m.sizeMm} physicalSize={physicalSize} interactive={interactive}
      label={`${title} รูปตัดฐานราก`} onBackgroundClick={onBackgroundClick}
    >
      <defs>
        <pattern id={`soil-${id}`} patternUnits="userSpaceOnUse" width={1.1 * u} height={1.1 * u} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={1.1 * u} stroke="#555" strokeWidth={0.1 * u} />
        </pattern>
      </defs>

      {/* ผิวดิน */}
      {m.groundZ !== null && (
        <g>
          <path d={m.groundPath} stroke={INK} strokeWidth={0.18 * u} fill="none" />
          {m.groundHatch.map((h, i) => (
            <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} fill={`url(#soil-${id})`} />
          ))}
        </g>
      )}
      {m.groundLabel && <Notes notes={[m.groundLabel]} size={m.sizes.small} u={u} />}

      {/* ตอม่อ (ตัดย่อ) + ฐานราก */}
      <path d={m.pedestalPath} stroke={INK} strokeWidth={0.35 * u} fill="none" />
      <path d={m.breakPath} stroke={INK} strokeWidth={0.15 * u} fill="none" />
      <rect x={-span / 2} y={-t} width={span} height={t} fill="none" stroke={INK} strokeWidth={0.45 * u} />

      {/* เหล็ก */}
      <path d={m.alongPath} fill="none" stroke={selectedDir === dir ? HIGHLIGHT : INK} strokeWidth={m.alongWidth} strokeLinecap="round" strokeLinejoin="round" />
      <g fill={selectedDir === other ? HIGHLIGHT : INK}>
        {m.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>
      {interactive && (
        <>
          <path d={m.alongPath} fill="none" stroke="transparent" strokeWidth={2 * u} {...pick(dir)} />
          <g fill="transparent" {...pick(other)}>
            {m.dots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={Math.max(d.r + 0.6 * u, 1.2 * u)} />
            ))}
          </g>
        </>
      )}

      {/* แรงดันดิน */}
      {m.pressure && (
        <g>
          <path d={m.pressure.hatch} stroke="#777" strokeWidth={0.1 * u} />
          <polygon points={m.pressure.outline} fill="none" stroke={INK} strokeWidth={0.18 * u} />
          <Notes notes={m.pressure.texts} size={m.sizes.small} u={u} />
        </g>
      )}

      {/* เส้นบอกขนาด */}
      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      {m.dims.map((d, i) => (
        <Dim key={i} line={d} size={m.sizes.dim} u={u} />
      ))}

      <Leaders leaders={m.leaders} u={u} size={m.sizes.label} subSize={m.sizes.small} selectedDir={selectedDir} pick={pick} />
      <Title tb={m.titleBlock} u={u} />
    </Frame>
  );
}
