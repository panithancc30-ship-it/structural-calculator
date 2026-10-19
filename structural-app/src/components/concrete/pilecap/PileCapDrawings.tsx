import { useId, useMemo, type MouseEvent } from 'react';
import type { BarDir } from '@/engine/concrete/footing/types';
import type { PileCapAnalysis } from '@/engine/concrete/pilecap/analyzePileCap';
import type { PileCapInput } from '@/engine/concrete/pilecap/types';
import { textWidth } from '../drawing/drawingModel';
import { Dim, Frame, usePickHandlers } from '../footing/FootingDrawings';
import type { DimLine } from '../footing/footingDrawingModel';
import { buildPlanModel, buildSectionModel, type DimPick, type PileCapPick } from './pileCapDrawingModel';

const INK = '#111';
const HIGHLIGHT = '#e8590c';
const OVER = '#c92a2a';

interface CommonProps {
  input: PileCapInput;
  analysis: PileCapAnalysis;
  denom: number;
  interactive?: boolean;
  selected?: PileCapPick | null;
  onPick?: (pick: PileCapPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  physicalSize?: boolean;
}

const sameDim = (a: PileCapPick | null | undefined, b: DimPick) =>
  !!a && a.kind === 'dim' && a.key === b.key && Math.abs(a.value - b.value) < 1e-6;
const barsSelected = (s: PileCapPick | null | undefined, dir: BarDir) => !!s && s.kind === 'bars' && s.dir === dir;
const cageSelected = (s: PileCapPick | null | undefined) => !!s && s.kind === 'cage';

/** เส้นบอกขนาดที่แตะตัวเลขแล้วแก้ระยะได้ */
function Dims({ m, selected, pick }: {
  m: { dims: DimLine[]; dimPicks: (DimPick | null)[][]; sizes: { dim: number }; u: number };
  selected?: PileCapPick | null;
  pick: ReturnType<typeof usePickHandlers<PileCapPick>>;
}) {
  return (
    <>
      {m.dims.map((d, i) => (
        <Dim
          key={i}
          line={d}
          size={m.sizes.dim}
          u={m.u}
          pickText={(j) => {
            const p = m.dimPicks[i]?.[j];
            if (!p) return {};
            const handlers = pick(p) as { className?: string };
            return handlers.className ? { ...handlers, className: `${handlers.className}${sameDim(selected, p) ? ' selected' : ''}` } : {};
          }}
        />
      ))}
    </>
  );
}

export function PileCapSection(props: CommonProps) {
  const { input, analysis, denom, interactive = false, selected = null, onBackgroundClick, physicalSize = false } = props;
  const m = useMemo(() => buildSectionModel(input, analysis, denom), [input, analysis, denom]);
  const pick = usePickHandlers<PileCapPick>(props);
  const id = useId().replace(/:/g, '');
  const { u, B, t, pileSize: D } = m;
  const cageColor = cageSelected(selected) ? HIGHLIGHT : INK;

  return (
    <Frame
      view={m.view} sizeMm={m.sizeMm} physicalSize={physicalSize} interactive={interactive}
      label={`รูปตัดฐานรากเสาเข็ม ${input.capName}`} onBackgroundClick={onBackgroundClick}
    >
      <defs>
        {/* คอนกรีตหยาบ: จุดห่าง + เม็ดหิน, ทราย: จุดถี่ */}
        <pattern id={`lean-${id}`} patternUnits="userSpaceOnUse" width={2.4 * u} height={2.4 * u}>
          <circle cx={0.5 * u} cy={0.6 * u} r={0.12 * u} fill="#444" />
          <circle cx={1.7 * u} cy={1.5 * u} r={0.1 * u} fill="#444" />
          <path d={`M${1.1 * u},${0.4 * u} l${0.3 * u},${0.25 * u} l${-0.35 * u},${0.05 * u} Z`} fill="#444" />
          <circle cx={0.9 * u} cy={2 * u} r={0.08 * u} fill="#444" />
        </pattern>
        <pattern id={`sand-${id}`} patternUnits="userSpaceOnUse" width={0.9 * u} height={0.9 * u}>
          <circle cx={0.2 * u} cy={0.25 * u} r={0.07 * u} fill="#555" />
          <circle cx={0.65 * u} cy={0.7 * u} r={0.07 * u} fill="#555" />
        </pattern>
      </defs>

      {/* คอนกรีตหยาบ + ทรายรองพื้น */}
      {m.lean.map((b, i) => (
        <rect key={`l${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={`url(#lean-${id})`} stroke={INK} strokeWidth={0.13 * u} />
      ))}
      {m.sand.map((b, i) => (
        <rect key={`s${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={`url(#sand-${id})`} stroke={INK} strokeWidth={0.13 * u} />
      ))}

      {/* ระดับที่กำหนด */}
      {m.levelPath && (
        <path d={m.levelPath} stroke={INK} strokeWidth={0.13 * u} strokeDasharray={`${2.5 * u} ${0.6 * u} ${0.4 * u} ${0.6 * u}`} fill="none" />
      )}
      {m.levelLabel && (
        <text x={m.levelLabel.x} y={m.levelLabel.y} fontSize={m.sizes.label} fill={INK}>
          {m.levelLabel.text}
        </text>
      )}

      {/* ตอม่อ (ตัดย่อ) */}
      <path d={m.pedestalPath} stroke={INK} strokeWidth={0.35 * u} fill="none" />
      <path d={m.breakPath} stroke={INK} strokeWidth={0.15 * u} fill="none" />

      {/* เสาเข็ม: ในแนวตัดเส้นทึบ หลังแนวตัดเส้นประ — หัวเข็มฝังในฐาน ปลายตัดย่อ */}
      {m.piles.map((p, i) => (
        <path
          key={i}
          d={`M${p.x - D / 2},${m.pileTop} V${m.pileBottom} M${p.x + D / 2},${m.pileTop} V${m.pileBottom} M${p.x - D / 2},${m.pileTop} H${p.x + D / 2}`}
          stroke={INK} strokeWidth={(p.onCut ? 0.3 : 0.18) * u} strokeDasharray={p.onCut ? undefined : `${1 * u} ${0.6 * u}`} fill="none"
        />
      ))}
      <path d={m.pileBreaks} stroke={INK} strokeWidth={0.15 * u} fill="none" />

      <rect x={-B / 2} y={-t} width={B} height={t} fill="none" stroke={INK} strokeWidth={0.45 * u} />
      <path d={m.centerLine} stroke="#666" strokeWidth={0.12 * u} strokeDasharray={`${1.6 * u} ${0.6 * u}`} fill="none" />

      {/* เหล็กเสริม */}
      {m.cagePath && (
        <path d={m.cagePath} fill="none" stroke={cageColor} strokeWidth={m.cageWidth} strokeLinecap="round" strokeLinejoin="round" />
      )}
      {m.ties.map((tie, i) => (
        <line key={i} x1={tie.x1} y1={tie.y} x2={tie.x2} y2={tie.y} stroke={cageColor} strokeWidth={m.tieWidth} strokeDasharray={`${1.1 * u} ${0.55 * u}`} />
      ))}
      {m.alongPath && (
        <path
          d={m.alongPath} fill="none" stroke={barsSelected(selected, 'x') ? HIGHLIGHT : INK} strokeWidth={m.alongWidth}
          strokeLinecap="round" strokeLinejoin="round"
        />
      )}
      <g fill={barsSelected(selected, 'y') ? HIGHLIGHT : INK}>
        {m.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>
      <path d={m.pedestalBars} fill="none" stroke={INK} strokeWidth={0.28 * u} strokeLinejoin="round" />

      {interactive && (
        <>
          {m.cagePath && <path d={m.cagePath} fill="none" stroke="transparent" strokeWidth={2 * u} {...pick({ kind: 'cage' })} />}
          {m.ties.length > 0 && (
            <g stroke="transparent" strokeWidth={1.4 * u} {...pick({ kind: 'cage' })}>
              {m.ties.map((tie, i) => (
                <line key={i} x1={tie.x1} y1={tie.y} x2={tie.x2} y2={tie.y} />
              ))}
            </g>
          )}
          {m.alongPath && <path d={m.alongPath} fill="none" stroke="transparent" strokeWidth={2 * u} {...pick({ kind: 'bars', dir: 'x' })} />}
          {m.dots.length > 0 && (
            <g fill="transparent" {...pick({ kind: 'bars', dir: 'y' })}>
              {m.dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={Math.max(d.r + 0.6 * u, 1.2 * u)} />
              ))}
            </g>
          )}
        </>
      )}

      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      <Dims m={m} selected={selected} pick={pick} />
      {m.layerLabels.map((l) => {
        const { className, ...handlers } = pick(l.pick) as { className?: string };
        const w = textWidth(l.text, m.sizes.small) + 0.8 * u;
        const h = m.sizes.small * 1.3;
        return (
          <g key={l.pick.key} className={className ? `dim-text ${className}${sameDim(selected, l.pick) ? ' selected' : ''}` : undefined} {...handlers}>
            {className && <rect x={l.x - w + 0.4 * u} y={l.y - 0.95 * m.sizes.small} width={w} height={h} rx={0.3 * u} className="dim-hit" />}
            <text x={l.x} y={l.y} fontSize={m.sizes.small} fill={INK} textAnchor="end">
              {l.text}
            </text>
          </g>
        );
      })}

      {/* ป้ายชี้ */}
      {m.callouts.map((c) => {
        const active =
          (c.pick?.kind === 'cage' && cageSelected(selected)) ||
          (c.pick?.kind === 'bars' && barsSelected(selected, c.pick.dir)) ||
          (c.pick?.kind === 'dim' && sameDim(selected, c.pick));
        const color = active ? HIGHLIGHT : INK;
        const { className, ...handlers } = (c.pick ? pick(c.pick) : {}) as { className?: string };
        return (
          <g key={c.key} className={className ? 'label hit' : 'label'} {...handlers}>
            {className && (
              // พื้นที่แตะคลุมข้อความ (ใช้นิ้วบนมือถือได้)
              <rect
                x={c.lines[0].x - 0.6 * u}
                y={c.lines[0].y - 1.05 * m.sizes.label}
                width={Math.max(...c.lines.map((l) => textWidth(l.text, m.sizes.label))) + 1.2 * u}
                height={(c.lines[c.lines.length - 1].y - c.lines[0].y) + 1.5 * m.sizes.label}
                fill="transparent"
              />
            )}
            <polyline points={c.points} fill="none" stroke={color} strokeWidth={0.13 * u} />
            <path d={c.arrows} fill={color} stroke="none" />
            {c.lines.map((l, i) => (
              <text key={i} x={l.x} y={l.y} fontSize={m.sizes.label} fill={color}>
                {l.text}
              </text>
            ))}
          </g>
        );
      })}
    </Frame>
  );
}

export function PileCapPlan(props: CommonProps) {
  const { input, analysis, denom, interactive = false, selected = null, onBackgroundClick, physicalSize = false } = props;
  const m = useMemo(() => buildPlanModel(input, analysis, denom), [input, analysis, denom]);
  const pick = usePickHandlers<PileCapPick>(props);
  const id = useId().replace(/:/g, '');
  const { u, B, L } = m;
  const D = input.pileSize;
  const dash = `${1 * u} ${0.6 * u}`;
  const cageColor = cageSelected(selected) ? HIGHLIGHT : INK;

  return (
    <Frame
      view={m.view} sizeMm={m.sizeMm} physicalSize={physicalSize} interactive={interactive}
      label={`แปลนฐานรากเสาเข็ม ${m.title.text}`} onBackgroundClick={onBackgroundClick}
    >
      <defs>
        <pattern id={`col-${id}`} patternUnits="userSpaceOnUse" width={1.2 * u} height={1.2 * u} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={1.2 * u} stroke={INK} strokeWidth={0.15 * u} />
        </pattern>
      </defs>

      {/* เข็มกลุ่ม: เหล็กตะแกรงสองทิศ */}
      {(['y', 'x'] as const).map((dir) => (
        <g key={dir} stroke={barsSelected(selected, dir) ? HIGHLIGHT : '#444'} strokeWidth={0.16 * u} strokeLinecap="round">
          {m.lines[dir].map((l, i) => (
            <line key={i} {...l} />
          ))}
        </g>
      ))}
      {interactive &&
        (['y', 'x'] as const).map((dir) => (
          <g key={`hit-${dir}`} stroke="transparent" strokeWidth={1.4 * u} {...pick({ kind: 'bars', dir })}>
            {m.lines[dir].map((l, i) => (
              <line key={i} {...l} />
            ))}
          </g>
        ))}

      {/* เข็มต้นเดียว: ปลอกรอบนอก + ปลอกข้าวหลามตัด + เหล็กยืน */}
      {m.tie && (
        <g stroke={cageColor} strokeWidth={m.tie.width} fill="none" strokeLinejoin="round">
          <rect x={m.tie.x} y={m.tie.y} width={m.tie.w} height={m.tie.h} rx={m.tie.r} />
          {m.diamond && <path d={m.diamond} />}
        </g>
      )}
      <g fill={cageColor}>
        {m.bars.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} />
        ))}
      </g>
      {interactive && m.tie && (
        <g stroke="transparent" strokeWidth={1.6 * u} fill="none" {...pick({ kind: 'cage' })}>
          <rect x={m.tie.x} y={m.tie.y} width={m.tie.w} height={m.tie.h} rx={m.tie.r} />
          {m.diamond && <path d={m.diamond} />}
        </g>
      )}

      <rect x={-B / 2} y={-L / 2} width={B} height={L} fill="none" stroke={INK} strokeWidth={0.45 * u} />

      {/* เสาเข็มใต้ฐาน (เส้นประ) + ตำแหน่งตามแบบเมื่อเยื้อง */}
      {m.piles.map((p, i) => (
        <g key={i}>
          {p.nominal && (
            <g stroke="#6b7580" strokeWidth={0.13 * u} fill="none">
              <path d={`M${p.nominal.x - 1.4 * u},${p.nominal.y} h${2.8 * u} M${p.nominal.x},${p.nominal.y - 1.4 * u} v${2.8 * u}`} />
              <path d={`M${p.nominal.x},${p.nominal.y} L${p.x},${p.y}`} strokeDasharray={`${0.5 * u} ${0.4 * u}`} />
            </g>
          )}
          {input.pileShape === 'circle' ? (
            <circle cx={p.x} cy={p.y} r={D / 2} fill="none" stroke={p.over ? OVER : INK} strokeWidth={0.22 * u} strokeDasharray={dash} />
          ) : (
            <rect x={p.x - D / 2} y={p.y - D / 2} width={D} height={D} fill="none" stroke={p.over ? OVER : INK} strokeWidth={0.22 * u} strokeDasharray={dash} />
          )}
        </g>
      ))}

      {/* ตอม่อ แรเงา + เครื่องหมายศูนย์ */}
      <rect x={m.column.x} y={m.column.y} width={m.column.w} height={m.column.h} fill="#fff" />
      <rect x={m.column.x} y={m.column.y} width={m.column.w} height={m.column.h} fill={`url(#col-${id})`} stroke={INK} strokeWidth={0.35 * u} />
      <path d={m.cross} stroke={INK} strokeWidth={0.18 * u} fill="none" />

      <g fontSize={m.sizes.small} textAnchor="middle" stroke="#fff" strokeWidth={0.45 * u} paintOrder="stroke" fontWeight={700}>
        {m.piles.map((p, i) =>
          p.number ? (
            <text key={i} x={p.number.x} y={p.number.y} fill={p.over ? OVER : INK}>
              {p.number.text}
            </text>
          ) : null,
        )}
      </g>

      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      <Dims m={m} selected={selected} pick={pick} />

      <g fill={INK} textAnchor="middle">
        <text x={0} y={m.title.y} fontSize={m.title.size} fontWeight={700}>
          {m.title.text}
        </text>
        <text x={0} y={m.title.scaleY} fontSize={m.title.scaleSize}>
          {m.title.scaleText}
        </text>
      </g>
    </Frame>
  );
}
