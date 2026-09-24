import { REBARS } from '../rebar';
import type { BarDir, FootingDims, FootingInput, FootingLayout } from './types';

/** พิกัดขอบเสาซ้าย/ขวา (x) และล่าง/บน (y) หรือระยะยื่นของฐานรากจากผิวเสาแต่ละด้าน (ซม.) */
export interface Sides {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface ColumnLocation {
  xc: number;
  yc: number;
  faces: Sides;
  overhang: Sides;
}

type LocationInput = Pick<FootingInput, 'cx' | 'cy' | 'position' | 'ex' | 'ey' | 'edgeSide' | 'cornerSide' | 'edgeGap'>;

/** ตำแหน่งศูนย์เสาเทียบศูนย์ถ่วงฐานราก */
export function columnCenter(input: LocationInput, dims: Pick<FootingDims, 'B' | 'L'>): { xc: number; yc: number } {
  const hx = dims.B / 2 - input.edgeGap - input.cx / 2;
  const hy = dims.L / 2 - input.edgeGap - input.cy / 2;
  switch (input.position) {
    case 'offset':
      return { xc: input.ex, yc: input.ey };
    case 'edge':
      if (input.edgeSide === 'left') return { xc: -hx, yc: 0 };
      if (input.edgeSide === 'right') return { xc: hx, yc: 0 };
      if (input.edgeSide === 'bottom') return { xc: 0, yc: -hy };
      return { xc: 0, yc: hy };
    case 'corner':
      return {
        xc: input.cornerSide.endsWith('left') ? -hx : hx,
        yc: input.cornerSide.startsWith('bottom') ? -hy : hy,
      };
    default:
      return { xc: 0, yc: 0 };
  }
}

export function columnLocation(input: LocationInput, dims: Pick<FootingDims, 'B' | 'L'>): ColumnLocation {
  const { xc, yc } = columnCenter(input, dims);
  const faces = { left: xc - input.cx / 2, right: xc + input.cx / 2, bottom: yc - input.cy / 2, top: yc + input.cy / 2 };
  return {
    xc,
    yc,
    faces,
    overhang: {
      left: faces.left + dims.B / 2,
      right: dims.B / 2 - faces.right,
      bottom: faces.bottom + dims.L / 2,
      top: dims.L / 2 - faces.top,
    },
  };
}

export const otherDir = (dir: BarDir): BarDir => (dir === 'x' ? 'y' : 'x');
/** ความยาวด้านที่เหล็กทิศนี้วางยาวตาม */
export const spanOf = (dims: Pick<FootingDims, 'B' | 'L'>, dir: BarDir) => (dir === 'x' ? dims.B : dims.L);
/** ความกว้างที่เหล็กทิศนี้กระจายอยู่ */
export const widthOf = (dims: Pick<FootingDims, 'B' | 'L'>, dir: BarDir) => (dir === 'x' ? dims.L : dims.B);

/** ตำแหน่งเหล็ก n เส้น เรียงเท่ากันเต็มความกว้าง (ศูนย์กลางเหล็ก) */
export function barPositions(width: number, cover: number, db: number, n: number): number[] {
  const count = Math.max(1, Math.round(n));
  if (count === 1) return [0];
  const start = -width / 2 + cover + db / 2;
  const pitch = (width - 2 * cover - db) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * pitch);
}

export interface FootingGeometry {
  db: Record<BarDir, number>;
  /** ระดับศูนย์เหล็กจากท้องฐานราก */
  z: Record<BarDir, number>;
  d: Record<BarDir, number>;
  dAvg: number;
  /** พิกัดเหล็ก: ทิศ x → ค่า y ของแต่ละเส้น, ทิศ y → ค่า x */
  positions: Record<BarDir, number[]>;
}

export function footingGeometry(cover: number, dims: FootingDims, layout: FootingLayout): FootingGeometry {
  const top = otherDir(layout.bottom);
  const db = { x: REBARS[layout.x.size].dia, y: REBARS[layout.y.size].dia };
  const z = { x: 0, y: 0 };
  z[layout.bottom] = cover + db[layout.bottom] / 2;
  z[top] = cover + db[layout.bottom] + db[top] / 2;
  const d = { x: dims.t - z.x, y: dims.t - z.y };
  return {
    db,
    z,
    d,
    dAvg: (d.x + d.y) / 2,
    positions: {
      x: barPositions(dims.L, cover, db.x, layout.x.count),
      y: barPositions(dims.B, cover, db.y, layout.y.count),
    },
  };
}
