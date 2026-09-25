import { fmt } from '@/engine/concrete/format';
import type { LedgeBeamInput } from '@/engine/concrete/ledge/types';
import { DRAWING_FONT } from '../drawing/drawingModel';

const INK = '#1f2937';
const CONCRETE = '#e5e7eb';
const WALL = '#f3d9c4';
const LOAD = '#c2410c';

/**
 * รูปอธิบายข้อมูลนำเข้า (ไม่ตามมาตราส่วน) — บอกว่า Lc วัดจากศูนย์กลางคาน
 * และผนังที่ปลายพื้นทำให้คานบิด ส่วนผนังบนคานไม่ทำให้บิด
 */
export function LedgeSketch({ input }: { input: LedgeBeamInput }) {
  const beam = { x: 56, y: 52, w: 30, h: 58 };
  const cx = beam.x + beam.w / 2;
  const tipX = 266;
  const slabBottom = beam.y + 12;
  const hasTipWall = input.tipWallH > 0;
  const hasBeamWall = input.beamWallH > 0;
  const arrowX0 = beam.x + beam.w + 24;
  const arrowX1 = tipX - (hasTipWall ? 34 : 26);
  const arrowXs = Array.from({ length: 6 }, (_, i) => arrowX0 + ((arrowX1 - arrowX0) * i) / 5);

  return (
    <svg
      className="ledge-sketch"
      viewBox="0 0 320 150"
      width="100%"
      style={{ display: 'block', marginBottom: 6 }}
      role="img"
      aria-label="รูปอธิบายคานรับพื้นยื่น"
      fontFamily={DRAWING_FONT}
      fontSize={9.5}
      fill={INK}
    >
      <defs>
        <marker id="ledge-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={LOAD} />
        </marker>
        <marker id="ledge-tick" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M1,5 L5,1" stroke={INK} strokeWidth={1} />
        </marker>
      </defs>

      {hasBeamWall && (
        <g>
          <rect x={beam.x + 5} y={10} width={beam.w - 10} height={beam.y - 10} fill={WALL} stroke={INK} strokeWidth={0.8} />
          <text x={beam.x - 4} y={24} textAnchor="end">
            ผนังบนคาน
          </text>
          <text x={beam.x - 4} y={35} textAnchor="end">
            {fmt(input.beamWallH, 2)} ม.
          </text>
        </g>
      )}

      {/* คานและพื้นยื่นหล่อเป็นเนื้อเดียว ผิวบนเสมอกัน */}
      <path
        d={`M${beam.x},${beam.y} H${tipX} V${slabBottom} H${beam.x + beam.w} V${beam.y + beam.h} H${beam.x} Z`}
        fill={CONCRETE}
        stroke={INK}
        strokeWidth={1.2}
      />
      <text x={beam.x - 4} y={beam.y + 30} textAnchor="end">
        คาน
      </text>
      <text x={beam.x - 4} y={beam.y + 41} textAnchor="end">
        {fmt(input.b, 0)}×{fmt(input.h, 0)}
      </text>

      {hasTipWall && (
        <g>
          <rect x={tipX - 10} y={18} width={10} height={beam.y - 18} fill={WALL} stroke={INK} strokeWidth={0.8} />
          <text x={tipX + 4} y={30}>
            ผนังปลาย
          </text>
          <text x={tipX + 4} y={41}>
            {fmt(input.tipWallH, 2)} ม.
          </text>
        </g>
      )}

      {/* น้ำหนักแผ่บนพื้นยื่น */}
      {arrowXs.map((x) => (
        <line key={x} x1={x} y1={30} x2={x} y2={beam.y - 1.5} stroke={LOAD} strokeWidth={1} markerEnd="url(#ledge-arrow)" />
      ))}
      <line x1={arrowXs[0]} y1={30} x2={arrowXs[arrowXs.length - 1]} y2={30} stroke={LOAD} strokeWidth={1} />
      <text x={arrowXs[0]} y={25} fill={LOAD}>
        ปูผิว {fmt(input.finishDL, 0)} + จร {fmt(input.LL, 0)} กก./ตร.ม.
      </text>
      <text x={(beam.x + beam.w + tipX) / 2} y={slabBottom + 11} textAnchor="middle">
        t = {fmt(input.slabT, 0)} ซม.
      </text>

      {/* แรงบิดรอบศูนย์กลางคาน */}
      <path
        d={`M${cx + 20},${beam.y + beam.h - 6} A22,22 0 0 1 ${cx - 17},${beam.y + beam.h + 2}`}
        fill="none"
        stroke={LOAD}
        strokeWidth={1}
        markerEnd="url(#ledge-arrow)"
      />
      <text x={cx + 24} y={beam.y + beam.h + 4} fill={LOAD}>
        T
      </text>

      {/* ศูนย์กลางคานและระยะ Lc */}
      <line x1={cx} y1={beam.y - 8} x2={cx} y2={142} stroke={INK} strokeWidth={0.6} strokeDasharray="6 2 1.5 2" />
      <line x1={tipX} y1={slabBottom + 3} x2={tipX} y2={142} stroke={INK} strokeWidth={0.5} />
      <line
        x1={cx}
        y1={136}
        x2={tipX}
        y2={136}
        stroke={INK}
        strokeWidth={0.7}
        markerStart="url(#ledge-tick)"
        markerEnd="url(#ledge-tick)"
      />
      <text x={(cx + tipX) / 2} y={132} textAnchor="middle">
        Lc = {fmt(input.slabLength, 2)} ม.
      </text>
    </svg>
  );
}
