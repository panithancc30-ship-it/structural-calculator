import { REBARS } from '../rebar';
import type { BarDir } from '../footing/types';
import type { Face, SupportCondition } from '../types';
import type { EdgeSupport, SlabDims, SlabInput, SlabLayout } from './types';

export const FACES: Face[] = ['bottom', 'top'];
export const DIRS: BarDir[] = ['x', 'y'];

/** ช่วงที่เหล็กทิศนั้นพาด */
export const spanOf = (dims: Pick<SlabDims, 'lx' | 'ly'>, dir: BarDir) => (dir === 'x' ? dims.lx : dims.ly);
/** ความกว้างที่เหล็กทิศนั้นกระจายออกไป */
export const widthOf = (dims: Pick<SlabDims, 'lx' | 'ly'>, dir: BarDir) => (dir === 'x' ? dims.ly : dims.lx);

/** ขอบสองด้านที่รองรับช่วงของทิศนั้น */
export function edgesOf(input: SlabInput, dir: BarDir): [EdgeSupport, EdgeSupport] {
  return dir === 'x' ? [input.edgeX1, input.edgeX2] : [input.edgeY1, input.edgeY2];
}

/**
 * ยุบสภาพขอบสองด้านให้เป็นสภาพรองรับแบบเดียวกับคาน
 * เพื่อใช้ตารางสัมประสิทธิ์โมเมนต์และความหนาขั้นต่ำชุดเดียวกัน
 */
export function supportConditionOf(input: SlabInput, dir: BarDir): SupportCondition {
  const edges = edgesOf(input, dir);
  if (edges.includes('free')) return 'cantilever';
  const continuous = edges.filter((e) => e === 'continuous').length;
  if (continuous >= 2) return 'bothEnds';
  return continuous === 1 ? 'oneEnd' : 'simple';
}

/** ตำแหน่งเหล็กที่เรียงด้วยระยะคงที่ กระจายให้สมมาตรรอบกึ่งกลางพื้น */
export function runPositions(width: number, cover: number, db: number, spacing: number): number[] {
  const net = width - 2 * cover - db;
  if (net <= 0 || spacing <= 0) return [0];
  const count = Math.floor(net / spacing + 1e-9) + 1;
  const used = (count - 1) * spacing;
  const start = -used / 2;
  return Array.from({ length: count }, (_, i) => start + i * spacing);
}

export interface SlabGeometry {
  /** เส้นผ่านศูนย์กลางเหล็กของแต่ละผิว/ทิศ (0 เมื่อไม่มีเหล็กชุดนั้น) */
  db: Record<Face, Record<BarDir, number>>;
  /** ระยะจากผิวคอนกรีตถึงศูนย์กลางเหล็ก */
  z: Record<Face, Record<BarDir, number>>;
  /** ความลึกประสิทธิผล */
  d: Record<Face, Record<BarDir, number>>;
  isOuter: Record<Face, Record<BarDir, boolean>>;
}

/**
 * ความลึกประสิทธิผลของเหล็กแต่ละชุด
 *
 * เหล็กสองทิศของผิวเดียวกันวางซ้อนกัน ทิศที่เป็น outerLayer อยู่ชิดผิวคอนกรีต
 * อีกทิศจึงถูกดันเข้ามาเท่ากับเส้นผ่านศูนย์กลางของทิศแรก
 */
export function slabGeometry(cover: number, t: number, layout: SlabLayout): SlabGeometry {
  const db = {} as SlabGeometry['db'];
  const z = {} as SlabGeometry['z'];
  const d = {} as SlabGeometry['d'];
  const isOuter = {} as SlabGeometry['isOuter'];

  for (const face of FACES) {
    const outer = layout.outerLayer[face];
    db[face] = { x: 0, y: 0 };
    z[face] = { x: 0, y: 0 };
    d[face] = { x: 0, y: 0 };
    isOuter[face] = { x: false, y: false };

    for (const dir of DIRS) {
      const run = layout[face][dir];
      db[face][dir] = run ? REBARS[run.size].dia : 0;
    }
    for (const dir of DIRS) {
      const run = layout[face][dir];
      if (!run) continue;
      const outerRun = layout[face][outer];
      const behind = dir === outer || !outerRun ? 0 : REBARS[outerRun.size].dia;
      isOuter[face][dir] = dir === outer || !outerRun;
      z[face][dir] = cover + behind + db[face][dir] / 2;
      d[face][dir] = t - z[face][dir];
    }
  }
  return { db, z, d, isOuter };
}
