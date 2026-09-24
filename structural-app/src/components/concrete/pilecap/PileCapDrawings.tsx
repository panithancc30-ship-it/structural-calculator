import { useId, useMemo, type MouseEvent } from 'react';
import type { BarDir } from '@/engine/concrete/footing/types';
import type { PileCapAnalysis } from '@/engine/concrete/pilecap/analyzePileCap';
import type { PileCapInput } from '@/engine/concrete/pilecap/types';
import { Dim, Frame, Leaders, Notes, Title, useHandlers } from '../footing/FootingDrawings';
import { buildPlanModel, buildSectionModel, LENGTH_NOTE_SHORT, type PileCapPick } from './pileCapDrawingModel';

const INK = '#111';
const HIGHLIGHT = '#e8590c';
const OVER = '#c92a2a';

interface CommonProps {
  input: PileCapInput;
  analysis: PileCapAnalysis;
  denom: number;
  interactive?: boolean;
  selectedDir?: BarDir | null;
  onPick?: (pick: PileCapPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  physicalSize?: boolean;
}

export function PileCapPlan(props: CommonProps) {
  const { input, analysis, denom, interactive = false, selectedDir = null, onBackgroundClick, physicalSize = false } = props;
  const m = useMemo(() => buildPlanModel(input, analysis, denom), [input, analysis, denom]);
  const pick = useHandlers(props);
  const id = useId().replace(/:/g, '');
  const { u, B, L } = m;
  const D = input.pileSize;
  const dash = `${1 * u} ${0.6 * u}`;

  return (
    <Frame
      view={m.view} sizeMm={m.sizeMm} physicalSize={physicalSize} interactive={interactive}
      label={`${m.titleBlock.title} แปลนฐานรากเสาเข็ม`} onBackgroundClick={onBackgroundClick}
    >
      <defs>
        <pattern id={`col-${id}`} patternUnits="userSpaceOnUse" width={1.2 * u} height={1.2 * u} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={1.2 * u} stroke={INK} strokeWidth={0.15 * u} />
        </pattern>
      </defs>

      {/* เส้นศูนย์กลางกลุ่มเสาเข็ม */}
      <path
        d={`M${-B / 2 - 1.5 * u},${m.center.y} H${B / 2 + 1.5 * u} M${m.center.x},${-L / 2 - 1.5 * u} V${L / 2 + 1.5 * u}`}
        stroke="#888" strokeWidth={0.09 * u} strokeDasharray={`${2.5 * u} ${0.6 * u} ${0.4 * u} ${0.6 * u}`}
      />

      {/* เหล็กเสริม */}
      {(['y', 'x'] as const).map((dir) => (
        <g key={dir} stroke={selectedDir === dir ? HIGHLIGHT : '#444'} strokeWidth={0.16 * u} strokeLinecap="round">
          {m.lines[dir].map((l, i) => (
            <line key={i} {...l} />
          ))}
        </g>
      ))}
      {interactive &&
        (['y', 'x'] as const).map((dir) => (
          <g key={`hit-${dir}`} stroke="transparent" strokeWidth={1.4 * u} {...pick(dir)}>
            {m.lines[dir].map((l, i) => (
              <line key={i} {...l} />
            ))}
          </g>
        ))}

      <rect x={-B / 2} y={-L / 2} width={B} height={L} fill="none" stroke={INK} strokeWidth={0.45 * u} />

      {/* เสาเข็ม (อยู่ใต้ฐาน → เส้นประ) + ตำแหน่งตามแบบเมื่อเยื้อง */}
      {m.piles.map((p, i) => (
        <g key={i}>
          {p.nominal && (
            <g stroke="#6b7580" strokeWidth={0.13 * u} fill="none">
              <path d={`M${p.nominal.x - 1.4 * u},${p.nominal.y} h${2.8 * u} M${p.nominal.x},${p.nominal.y - 1.4 * u} v${2.8 * u}`} />
              <path d={`M${p.nominal.x},${p.nominal.y} L${p.x},${p.y}`} strokeDasharray={`${0.5 * u} ${0.4 * u}`} />
            </g>
          )}
          {input.pileShape === 'circle' ? (
            <circle cx={p.x} cy={p.y} r={D / 2} fill="#fff" fillOpacity={0.85} stroke={p.over ? OVER : INK} strokeWidth={0.28 * u} strokeDasharray={dash} />
          ) : (
            <rect
              x={p.x - D / 2} y={p.y - D / 2} width={D} height={D}
              fill="#fff" fillOpacity={0.85} stroke={p.over ? OVER : INK} strokeWidth={0.28 * u} strokeDasharray={dash}
            />
          )}
        </g>
      ))}

      {/* เสา */}
      <rect x={m.column.x} y={m.column.y} width={m.column.w} height={m.column.h} fill="#fff" />
      <rect x={m.column.x} y={m.column.y} width={m.column.w} height={m.column.h} fill={`url(#col-${id})`} stroke={INK} strokeWidth={0.35 * u} />

      {/* หมายเลขเข็มและแรงในเข็ม (ตัน) */}
      <g fontSize={m.sizes.small} textAnchor="middle" stroke="#fff" strokeWidth={0.45 * u} paintOrder="stroke">
        {m.piles.map((p, i) => (
          <g key={i} fill={p.over ? OVER : INK}>
            <text x={p.number.x} y={p.number.y} fontWeight={700}>
              {p.number.text}
            </text>
            <text x={p.reaction.x} y={p.reaction.y}>
              {p.reaction.text}
            </text>
          </g>
        ))}
      </g>

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

export function PileCapSection({ input, analysis, denom, dir, selectedDir = null, physicalSize = false }: {
  input: PileCapInput;
  analysis: PileCapAnalysis;
  denom: number;
  dir: BarDir;
  selectedDir?: BarDir | null;
  physicalSize?: boolean;
}) {
  const m = useMemo(() => buildSectionModel(input, analysis, dir, denom), [input, analysis, dir, denom]);
  const pick = useHandlers({ interactive: false });
  const id = useId().replace(/:/g, '');
  const { u, span, t, pileSize: D } = m;
  const other: BarDir = dir === 'x' ? 'y' : 'x';

  return (
    <Frame view={m.view} sizeMm={m.sizeMm} physicalSize={physicalSize} interactive={false} label={`${m.title.text} รูปตัดฐานรากเสาเข็ม`}>
      <defs>
        <pattern id={`soil-${id}`} patternUnits="userSpaceOnUse" width={1.1 * u} height={1.1 * u} patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={1.1 * u} stroke="#555" strokeWidth={0.1 * u} />
        </pattern>
      </defs>

      {m.groundPath && (
        <g>
          <path d={m.groundPath} stroke={INK} strokeWidth={0.18 * u} fill="none" />
          {m.groundHatch.map((h, i) => (
            <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} fill={`url(#soil-${id})`} />
          ))}
        </g>
      )}

      {/* ตอม่อ (ตัดย่อ) */}
      <path d={m.pedestalPath} stroke={INK} strokeWidth={0.35 * u} fill="none" />
      <path d={m.breakPath} stroke={INK} strokeWidth={0.15 * u} fill="none" />

      {/* เสาเข็ม: ในแนวตัดเส้นทึบ หลังแนวตัดเส้นประ — หัวเข็มฝังในฐาน, ปลายตัดย่อ */}
      {m.piles.map((p, i) => (
        <path
          key={i}
          d={`M${p.x - D / 2},${-m.embed} V${m.pileStub} M${p.x + D / 2},${-m.embed} V${m.pileStub} M${p.x - D / 2},${-m.embed} H${p.x + D / 2}`}
          stroke={INK} strokeWidth={(p.onCut ? 0.3 : 0.18) * u} strokeDasharray={p.onCut ? undefined : `${1 * u} ${0.6 * u}`} fill="none"
        />
      ))}
      <path d={m.pileBreaks} stroke={INK} strokeWidth={0.15 * u} fill="none" />

      <rect x={-span / 2} y={-t} width={span} height={t} fill="none" stroke={INK} strokeWidth={0.45 * u} />

      {/* เหล็ก */}
      <path d={m.alongPath} fill="none" stroke={selectedDir === dir ? HIGHLIGHT : INK} strokeWidth={m.alongWidth} strokeLinecap="round" strokeLinejoin="round" />
      <g fill={selectedDir === other ? HIGHLIGHT : INK}>
        {m.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>

      <path d={m.extensions} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      {m.dims.map((d, i) => (
        <Dim key={i} line={d} size={m.sizes.dim} u={u} />
      ))}
      <path d={m.arrow} stroke={INK} strokeWidth={0.2 * u} fill="none" strokeLinejoin="round" />
      <text x={m.lengthLabel.x} y={m.lengthLabel.y} textAnchor={m.lengthLabel.anchor} fill={INK}>
        <tspan fontSize={m.sizes.dim * 1.15} fontWeight={700}>
          {m.lengthLabel.text}
        </tspan>
        <tspan fontSize={m.sizes.small}> {LENGTH_NOTE_SHORT}</tspan>
      </text>

      <Leaders leaders={m.leaders} u={u} size={m.sizes.label} subSize={m.sizes.small} selectedDir={selectedDir} pick={pick} />
      <Notes notes={m.notes} size={m.sizes.small} u={u} />

      {/* ชื่อรูป + มาตราส่วน บรรทัดเดียว */}
      <g fill={INK}>
        <text x={m.title.x} y={m.title.y} fontSize={m.title.size} fontWeight={700}>
          {m.title.text}
        </text>
        <path
          d={`M${m.title.x},${m.title.y + 0.8 * u} h${m.title.width} M${m.title.x},${m.title.y + 1.4 * u} h${m.title.width}`}
          stroke={INK} strokeWidth={0.2 * u}
        />
        <text x={m.title.scaleX} y={m.title.y} fontSize={m.title.scaleSize}>
          {m.title.scaleText}
        </text>
      </g>
    </Frame>
  );
}
