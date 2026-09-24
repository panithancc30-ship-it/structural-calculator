import { useMemo, type MouseEvent } from 'react';
import type { BeamInput, SectionLayout } from '@/engine/concrete/types';
import { buildDrawingModel, DRAWING_FONT, type DrawingPick } from './drawingModel';
import { hookPath, roundedRectPath } from './paths';

const INK = '#111';
const HIGHLIGHT = '#e8590c';

interface Props {
  input: BeamInput;
  layout: SectionLayout;
  denom: number;
  title: string;
  subtitle: string;
  interactive?: boolean;
  selectedId?: string | null;
  onPick?: (pick: DrawingPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  /** กำหนดขนาดจริงเป็น มม. (ใช้ในใบพิมพ์) */
  physicalSize?: boolean;
}

export function SectionDrawing({
  input,
  layout,
  denom,
  title,
  subtitle,
  interactive = false,
  selectedId = null,
  onPick,
  onBackgroundClick,
  physicalSize = false,
}: Props) {
  const m = useMemo(
    () => buildDrawingModel(input, layout, denom, title, subtitle),
    [input, layout, denom, title, subtitle],
  );
  const { u, geom, view, b, h } = m;
  const thin = 0.14 * u;
  const stirrupWidth = Math.max(0.28 * u, geom.outer.ds * 0.7);
  const stirrupSelected = selectedId === 'stirrup';

  const pick = (p: DrawingPick) => (e: MouseEvent<SVGElement>) => {
    e.stopPropagation();
    onPick?.(p, e);
  };
  const tick = (x: number, y: number) => `M${x - 0.9 * u},${y + 0.9 * u} L${x + 0.9 * u},${y - 0.9 * u}`;

  return (
    <svg
      className={`section-drawing${interactive ? ' interactive' : ''}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      width={physicalSize ? `${m.sizeMm.w}mm` : '100%'}
      height={physicalSize ? `${m.sizeMm.h}mm` : undefined}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${title} ${subtitle}`}
      fontFamily={DRAWING_FONT}
      onClick={interactive ? onBackgroundClick : undefined}
    >
      <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="#fff" />

      {/* คอนกรีต */}
      <rect x={0} y={0} width={b} height={h} fill="none" stroke={INK} strokeWidth={0.5 * u} />

      {/* เหล็กปลอก */}
      {[geom.outer, geom.inner].map(
        (g, i) =>
          g && (
            <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={roundedRectPath(g)} stroke={stirrupSelected ? HIGHLIGHT : INK} strokeWidth={stirrupWidth} />
              <path d={hookPath(g, m.hookLen)} stroke={stirrupSelected ? HIGHLIGHT : INK} strokeWidth={stirrupWidth} />
              {interactive && (
                <path
                  className="hit"
                  d={roundedRectPath(g)}
                  stroke="transparent"
                  strokeWidth={2.4 * u}
                  onClick={pick({ kind: 'stirrup' })}
                />
              )}
            </g>
          ),
      )}

      {/* เหล็กยืน */}
      {geom.bars.map((bar) => {
        const selected = bar.face === 'side' ? selectedId === bar.layerId : selectedId === bar.id;
        const target: DrawingPick =
          bar.face === 'side'
            ? { kind: 'side', rowId: bar.layerId }
            : { kind: 'bar', face: bar.face, layerId: bar.layerId, barId: bar.id };
        return (
          <g key={bar.id}>
            <circle cx={bar.x} cy={bar.y} r={bar.dia / 2} fill={selected ? HIGHLIGHT : INK} />
            {selected && (
              <circle cx={bar.x} cy={bar.y} r={bar.dia / 2 + 0.8 * u} fill="none" stroke={HIGHLIGHT} strokeWidth={0.35 * u} />
            )}
            {interactive && (
              <circle
                className="hit"
                cx={bar.x}
                cy={bar.y}
                r={Math.max(bar.dia / 2 + 0.6 * u, 1.6 * u)}
                fill="transparent"
                onClick={pick(target)}
              />
            )}
          </g>
        );
      })}

      {/* เส้นบอกขนาด */}
      <g stroke={INK} fill="none">
        <path
          strokeWidth={thin}
          d={
            `M0,${h + 0.8 * u} V${m.dimBY + 1.2 * u} M${b},${h + 0.8 * u} V${m.dimBY + 1.2 * u} ` +
            `M${-1.2 * u},${m.dimBY} H${b + 1.2 * u} ` +
            `M${-0.8 * u},0 H${m.dimHX - 1.2 * u} M${-0.8 * u},${h} H${m.dimHX - 1.2 * u} ` +
            `M${m.dimHX},${-1.2 * u} V${h + 1.2 * u}`
          }
        />
        <path strokeWidth={0.32 * u} d={`${tick(0, m.dimBY)} ${tick(b, m.dimBY)} ${tick(m.dimHX, 0)} ${tick(m.dimHX, h)}`} />
      </g>
      <g fill={INK} fontSize={m.font} textAnchor="middle">
        <text x={b / 2} y={m.dimBY - 0.8 * u}>
          {(b / 100).toFixed(2)}
        </text>
        <text transform={`translate(${m.dimHX - 0.8 * u},${h / 2}) rotate(-90)`}>{(h / 100).toFixed(2)}</text>
      </g>

      {/* ป้ายเหล็ก */}
      {m.labels.map((l) => (
        <g key={l.key} className={interactive ? 'label hit' : 'label'} onClick={interactive ? pick(l.target) : undefined}>
          <polyline
            points={`${l.ax},${l.ay} ${m.elbowX},${l.y} ${m.labelX - 0.6 * u},${l.y}`}
            fill="none"
            stroke={INK}
            strokeWidth={thin}
          />
          {l.dot && <circle cx={l.ax} cy={l.ay} r={0.45 * u} fill={INK} />}
          <text x={m.labelX} y={l.y + m.font * 0.35} fontSize={m.font} fill={INK}>
            {l.text}
          </text>
        </g>
      ))}

      {/* ชื่อรูป */}
      <g fill={INK} textAnchor="middle">
        <text x={b / 2} y={m.titleY} fontSize={m.titleFont} fontWeight={700}>
          {title}
        </text>
        <path
          d={`M${b / 2 - m.titleW / 2},${m.titleY + 1 * u} h${m.titleW}`}
          stroke={INK}
          strokeWidth={0.4 * u}
        />
        <path
          d={`M${b / 2 - m.titleW / 2},${m.titleY + 1.7 * u} h${m.titleW}`}
          stroke={INK}
          strokeWidth={0.14 * u}
        />
        <text x={b / 2} y={m.subY} fontSize={m.subFont}>
          {m.subText}
        </text>
      </g>
    </svg>
  );
}
