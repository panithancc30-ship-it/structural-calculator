import { useMemo, type MouseEvent } from 'react';
import type { ColumnInput, ColumnLayout } from '../../domain/column/types';
import { DRAWING_FONT } from '../drawing/drawingModel';
import { hookPath, roundedRectPath } from '../drawing/paths';
import { buildColumnDrawing, type ColumnPick } from './columnDrawingModel';

const INK = '#111';
const HIGHLIGHT = '#e8590c';

interface Props {
  input: ColumnInput;
  layout: ColumnLayout;
  denom: number;
  title: string;
  subtitle: string;
  interactive?: boolean;
  selectedId?: string | null;
  onPick?: (pick: ColumnPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  physicalSize?: boolean;
}

export function ColumnDrawing({
  input, layout, denom, title, subtitle,
  interactive = false, selectedId = null, onPick, onBackgroundClick, physicalSize = false,
}: Props) {
  const m = useMemo(() => buildColumnDrawing(input, layout, denom, title, subtitle), [input, layout, denom, title, subtitle]);
  const { u, geom, view, halfW, halfH } = m;
  const thin = 0.14 * u;
  const tieWidth = Math.max(0.28 * u, geom.ds * 0.7);
  const tieColor = selectedId === 'tie' ? HIGHLIGHT : INK;
  const pick = (p: ColumnPick) => (e: MouseEvent<SVGElement>) => {
    e.stopPropagation();
    onPick?.(p, e);
  };
  const tick = (x: number, y: number) => `M${x - 0.9 * u},${y + 0.9 * u} L${x + 0.9 * u},${y - 0.9 * u}`;
  const hitTie = interactive ? { className: 'hit', onClick: pick({ kind: 'tie' }) } : {};

  const tieShapes: string[] = [];
  if (geom.tieRect) {
    const t = geom.tieRect;
    const rect = { x: -t.hx, y: -t.hy, w: 2 * t.hx, h: 2 * t.hy, r: t.r };
    tieShapes.push(roundedRectPath(rect), hookPath(rect, m.hookLen));
    const L = m.hookLen * 0.7;
    const k = Math.SQRT1_2 * L;
    for (const ct of geom.crossTies) {
      if (ct.dir === 'vertical') {
        tieShapes.push(`M${ct.pos},${-t.hy} V${t.hy} M${ct.pos},${-t.hy} l${k},${k} M${ct.pos},${t.hy} h${L}`);
      } else {
        tieShapes.push(`M${-t.hx},${-ct.pos} H${t.hx} M${-t.hx},${-ct.pos} l${k},${k} M${t.hx},${-ct.pos} v${-L}`);
      }
    }
  }

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
      {m.circle ? (
        <circle cx={0} cy={0} r={halfW} fill="none" stroke={INK} strokeWidth={0.5 * u} />
      ) : (
        <rect x={-halfW} y={-halfH} width={2 * halfW} height={2 * halfH} fill="none" stroke={INK} strokeWidth={0.5 * u} />
      )}

      {/* เส้นศูนย์กลาง */}
      <g stroke="#777" strokeWidth={0.1 * u} strokeDasharray={`${3 * u} ${0.8 * u} ${0.6 * u} ${0.8 * u}`}>
        <path d={`M${-halfW - 2.5 * u},0 H${halfW + 2 * u} M0,${-halfH - 2.5 * u} V${halfH + 2 * u}`} />
      </g>
      <g fill="#555" fontSize={m.font * 0.85} fontStyle="italic">
        <text x={halfW + 1.2 * u} y={-0.7 * u}>x</text>
        <text x={0.7 * u} y={-halfH - 2.2 * u}>y</text>
      </g>

      {/* เหล็กปลอก / เกลียว / เหล็กถ่าง */}
      <g fill="none" stroke={tieColor} strokeWidth={tieWidth} strokeLinecap="round" strokeLinejoin="round">
        {geom.spiralR !== null && <circle cx={0} cy={0} r={geom.spiralR} />}
        {tieShapes.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {interactive && (
        <g fill="none" stroke="transparent" strokeWidth={2.4 * u}>
          {geom.spiralR !== null && <circle cx={0} cy={0} r={geom.spiralR} {...hitTie} />}
          {tieShapes.map((d, i) => (
            <path key={i} d={d} {...hitTie} />
          ))}
        </g>
      )}

      {/* เหล็กยืน */}
      {geom.bars.map((bar) => {
        const selected = selectedId === bar.id;
        return (
          <g key={bar.id}>
            <circle cx={bar.x} cy={-bar.y} r={bar.dia / 2} fill={selected ? HIGHLIGHT : INK} />
            {selected && <circle cx={bar.x} cy={-bar.y} r={bar.dia / 2 + 0.8 * u} fill="none" stroke={HIGHLIGHT} strokeWidth={0.35 * u} />}
            {interactive && (
              <circle
                className="hit"
                cx={bar.x}
                cy={-bar.y}
                r={Math.max(bar.dia / 2 + 0.6 * u, 1.6 * u)}
                fill="transparent"
                onClick={pick({ kind: 'bar', barId: bar.id })}
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
            `M${-halfW},${m.circle ? 0 : halfH + 0.8 * u} V${m.dimY + 1.2 * u} M${halfW},${m.circle ? 0 : halfH + 0.8 * u} V${m.dimY + 1.2 * u} ` +
            `M${-halfW - 1.2 * u},${m.dimY} H${halfW + 1.2 * u}` +
            (m.circle ? '' : ` M${-halfW - 0.8 * u},${-halfH} H${m.dimX - 1.2 * u} M${-halfW - 0.8 * u},${halfH} H${m.dimX - 1.2 * u} M${m.dimX},${-halfH - 1.2 * u} V${halfH + 1.2 * u}`)
          }
        />
        <path
          strokeWidth={0.32 * u}
          d={`${tick(-halfW, m.dimY)} ${tick(halfW, m.dimY)}` + (m.circle ? '' : ` ${tick(m.dimX, -halfH)} ${tick(m.dimX, halfH)}`)}
        />
      </g>
      <g fill={INK} fontSize={m.font} textAnchor="middle">
        <text x={0} y={m.dimY - 0.8 * u}>
          {m.circle ? `Ø ${(input.D / 100).toFixed(2)}` : (input.b / 100).toFixed(2)}
        </text>
        {!m.circle && <text transform={`translate(${m.dimX - 0.8 * u},0) rotate(-90)`}>{(input.h / 100).toFixed(2)}</text>}
      </g>

      {/* ป้าย */}
      {m.labels.map((l) => (
        <g key={l.key} className={interactive ? 'label hit' : 'label'} onClick={interactive ? pick(l.target) : undefined}>
          <polyline points={`${l.ax},${l.ay} ${m.elbowX},${l.y} ${m.labelX - 0.6 * u},${l.y}`} fill="none" stroke={INK} strokeWidth={thin} />
          {l.dot && <circle cx={l.ax} cy={l.ay} r={0.45 * u} fill={INK} />}
          <text x={m.labelX} y={l.y + m.font * 0.35} fontSize={m.font} fill={INK}>
            {l.text}
          </text>
        </g>
      ))}

      {/* ชื่อรูป */}
      <g fill={INK} textAnchor="middle">
        <text x={0} y={m.titleY} fontSize={m.titleFont} fontWeight={700}>
          {title}
        </text>
        <path d={`M${-m.titleW / 2},${m.titleY + u} h${m.titleW}`} stroke={INK} strokeWidth={0.4 * u} />
        <path d={`M${-m.titleW / 2},${m.titleY + 1.7 * u} h${m.titleW}`} stroke={INK} strokeWidth={0.14 * u} />
        <text x={0} y={m.subY} fontSize={m.subFont}>
          {m.subText}
        </text>
      </g>
    </svg>
  );
}
