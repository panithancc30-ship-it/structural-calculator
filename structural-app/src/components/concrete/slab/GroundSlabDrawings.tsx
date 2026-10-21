import { useId, useMemo, type MouseEvent } from 'react';
import type { SlabAnalysis } from '@/engine/concrete/slab/analyzeSlab';
import type { SlabInput, SlabLayout } from '@/engine/concrete/slab/types';
import { Frame, usePickHandlers } from '../footing/FootingDrawings';
import type { TextSizes } from '../footing/footingDrawingModel';
import {
  buildGroundDetail,
  GROUND_DETAIL_SUFFIX,
  groundTitle,
  type DetailTitle,
  type GroundDetailKind,
} from './groundSlabDrawingModel';
import type { SlabPick } from './slabDrawingModel';

const INK = '#111';
const BAR = '#1d5fbf';
const HIGHLIGHT = '#e8590c';

interface Props {
  input: SlabInput;
  analysis: SlabAnalysis;
  layout: SlabLayout;
  kind: GroundDetailKind;
  denom: number;
  interactive?: boolean;
  /** เลือกตะแกรงอยู่ (แก้ทั้งสองทิศพร้อมกัน) */
  selected?: boolean;
  onPick?: (pick: SlabPick, event: MouseEvent<SVGElement>) => void;
  onBackgroundClick?: () => void;
  physicalSize?: boolean;
}

/** แบบขยายพื้น GS หนึ่งรูป — คลิกเหล็กหรือป้ายเหล็กเพื่อแก้ตะแกรง */
export function GroundSlabDetail(props: Props) {
  const { input, analysis, layout, kind, denom, interactive = false, selected = false, onBackgroundClick, physicalSize = false } = props;
  const m = useMemo(() => buildGroundDetail(input, analysis, layout, kind, denom), [input, analysis, layout, kind, denom]);
  const pick = usePickHandlers<SlabPick>(props);
  const id = useId().replace(/:/g, '');
  const u = m.u;
  const meshPick = pick({ kind: 'bars', face: 'bottom', dir: m.lineDir }) as { className?: string };
  const barColor = selected ? HIGHLIGHT : BAR;

  return (
    <Frame
      view={m.view}
      sizeMm={m.sizeMm}
      physicalSize={physicalSize}
      interactive={interactive}
      label={`${groundTitle(input)} ${GROUND_DETAIL_SUFFIX[kind]}`}
      onBackgroundClick={onBackgroundClick}
      className="slab-drawing"
    >
      <defs>
        {/* ทรายอัดแน่น: จุดถี่, ดินเดิม: ลายตาราง 45° */}
        <pattern id={`sand-${id}`} patternUnits="userSpaceOnUse" width={0.9 * u} height={0.9 * u}>
          <circle cx={0.2 * u} cy={0.25 * u} r={0.07 * u} fill="#555" />
          <circle cx={0.65 * u} cy={0.7 * u} r={0.07 * u} fill="#555" />
        </pattern>
        <pattern id={`soil-${id}`} patternUnits="userSpaceOnUse" width={0.8 * u} height={0.8 * u} patternTransform="rotate(45)">
          <path d={`M0,0 V${0.8 * u} M0,0 H${0.8 * u}`} stroke="#777" strokeWidth={0.08 * u} />
        </pattern>
      </defs>

      <rect {...boxProps(m.groundBand)} fill={`url(#soil-${id})`} stroke="none" />
      <path d={m.sandPath} fill={`url(#sand-${id})`} stroke="none" />

      {/* คานคอดินสองข้าง (ด้านสั้นภายใน) */}
      {m.beams.map((b, i) => (
        <rect key={i} {...boxProps(b)} fill="#fff" stroke={INK} strokeWidth={0.3 * u} />
      ))}

      <path d={m.slabPath} fill="#fff" stroke={INK} strokeWidth={0.3 * u} strokeLinejoin="round" />

      {/* ร่องยาแนวระหว่างพื้นกับคาน */}
      {m.grooves.map((g, i) => (
        <rect key={i} {...boxProps(g)} fill={INK} />
      ))}

      {/* เหล็กตะแกรง: เส้น = ทิศตามรูป, จุด = ทิศตั้งฉาก */}
      {m.bar && (
        <path d={m.bar.path} fill="none" stroke={barColor} strokeWidth={m.bar.width} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <g fill={barColor}>
        {m.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} />
        ))}
      </g>
      {interactive && (
        <g {...meshPick}>
          {m.bar && <path d={m.bar.path} fill="none" stroke="transparent" strokeWidth={1.6 * u} />}
          {m.dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={1.2 * u} fill="transparent" />
          ))}
        </g>
      )}

      {/* ความหนา — ตัวเลขแนวนอนตามแบบ */}
      <path d={m.dim.path} stroke={INK} strokeWidth={0.13 * u} fill="none" />
      <path d={m.dim.ticks} stroke={INK} strokeWidth={0.3 * u} fill="none" />
      <g fontSize={m.sizes.dim} fill={INK}>
        {m.dim.labels.map((l, i) => (
          <text key={i} x={l.x} y={l.y} textAnchor={l.anchor}>
            {l.text}
          </text>
        ))}
      </g>

      {/* ป้ายชี้ */}
      {m.callouts.map((c) => {
        const isMesh = c.key === 'mesh';
        const color = isMesh && selected ? HIGHLIGHT : INK;
        const { className, ...handlers } = (isMesh ? meshPick : {}) as { className?: string };
        return (
          <g key={c.key} className={className ? 'label hit' : 'label'} {...handlers}>
            {c.lines.map((d, i) => (
              <path key={i} d={d} fill="none" stroke={color} strokeWidth={0.13 * u} />
            ))}
            <path d={c.arrows} fill={color} stroke="none" />
            <text x={c.text.x} y={c.text.y} fontSize={m.sizes.label} fill={color}>
              {c.text.text}
            </text>
          </g>
        );
      })}

      <DetailTitleText title={m.title} sizes={m.sizes} u={u} />
    </Frame>
  );
}

/** ชื่อรูปแบบขยาย (ใช้ร่วมกับแบบขยายพื้น S1) */
export function DetailTitleText({ title, sizes, u }: { title: DetailTitle; sizes: TextSizes; u: number }) {
  return (
    <g fill={INK}>
      <text x={title.title.x} y={title.title.y} fontSize={title.titleSize}>
        {title.title.text}
      </text>
      <path d={title.underline} stroke={INK} strokeWidth={0.15 * u} />
      <text x={title.scaleLabel.x} y={title.scaleLabel.y} fontSize={sizes.small}>
        {title.scaleLabel.text}
      </text>
      <text x={title.scaleValue.x} y={title.scaleValue.y} fontSize={sizes.small} textAnchor="end">
        {title.scaleValue.text}
      </text>
      <text x={title.suffix.x} y={title.suffix.y} fontSize={sizes.label}>
        {title.suffix.text}
      </text>
    </g>
  );
}

const boxProps = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x, y: b.y, width: b.w, height: b.h });
