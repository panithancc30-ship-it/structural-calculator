import type { ColumnLocation, Sides } from './geometry';
import type { FootingDims } from './types';

/**
 * หน้าตัดวิกฤตเฉือนทะลุ ห่างผิวเสา d/2 — ด้านที่เลยขอบฐานรากถูกตัดออก (เสาขอบ 3 ด้าน, เสามุม 2 ด้าน)
 * Jx: ค่าคล้ายโมเมนต์ความเฉื่อยเชิงขั้ว สำหรับโมเมนต์ที่ทำให้หน่วยแรงเปลี่ยนตามแกน x (ACI R11.12.6.2)
 */
export interface PunchingPerimeter {
  d: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  sides: Record<keyof Sides, boolean>;
  nSides: number;
  b0: number;
  xg: number;
  yg: number;
  Jx: number;
  Jy: number;
  cX: number;
  cY: number;
  gammaX: number;
  gammaY: number;
}

interface Segment {
  kind: 'v' | 'h';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const gamma = (b1: number, b2: number) => (b1 > 0 && b2 > 0 ? 1 - 1 / (1 + (2 / 3) * Math.sqrt(b1 / b2)) : 0);

export function punchingPerimeter(loc: ColumnLocation, dims: Pick<FootingDims, 'B' | 'L'>, d: number): PunchingPerimeter {
  const { B, L } = dims;
  const eps = 1e-6;
  const h = d / 2;
  const sides = {
    left: loc.faces.left - h > -B / 2 + eps,
    right: loc.faces.right + h < B / 2 - eps,
    bottom: loc.faces.bottom - h > -L / 2 + eps,
    top: loc.faces.top + h < L / 2 - eps,
  };
  const x1 = Math.max(-B / 2, loc.faces.left - h);
  const x2 = Math.min(B / 2, loc.faces.right + h);
  const y1 = Math.max(-L / 2, loc.faces.bottom - h);
  const y2 = Math.min(L / 2, loc.faces.top + h);

  const segs: Segment[] = [];
  if (sides.left) segs.push({ kind: 'v', x1, y1, x2: x1, y2 });
  if (sides.right) segs.push({ kind: 'v', x1: x2, y1, x2, y2 });
  if (sides.bottom) segs.push({ kind: 'h', x1, y1, x2, y2: y1 });
  if (sides.top) segs.push({ kind: 'h', x1, y1: y2, x2, y2 });

  const len = (s: Segment) => Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
  const b0 = segs.reduce((sum, s) => sum + len(s), 0);
  const xg = b0 > 0 ? segs.reduce((sum, s) => sum + (len(s) * (s.x1 + s.x2)) / 2, 0) / b0 : loc.xc;
  const yg = b0 > 0 ? segs.reduce((sum, s) => sum + (len(s) * (s.y1 + s.y2)) / 2, 0) / b0 : loc.yc;

  let Jx = 0;
  let Jy = 0;
  for (const s of segs) {
    const l = len(s);
    const own = (d * l ** 3) / 12 + (d ** 3 * l) / 12;
    if (s.kind === 'v') {
      Jx += l * d * (s.x1 - xg) ** 2;
      Jy += own + l * d * ((s.y1 + s.y2) / 2 - yg) ** 2;
    } else {
      Jx += own + l * d * ((s.x1 + s.x2) / 2 - xg) ** 2;
      Jy += l * d * (s.y1 - yg) ** 2;
    }
  }
  const cX = segs.length ? Math.max(...segs.flatMap((s) => [Math.abs(s.x1 - xg), Math.abs(s.x2 - xg)])) : 0;
  const cY = segs.length ? Math.max(...segs.flatMap((s) => [Math.abs(s.y1 - yg), Math.abs(s.y2 - yg)])) : 0;
  const nSides = segs.length;

  return {
    d, x1, x2, y1, y2, sides, nSides, b0,
    xg, yg, Jx, Jy, cX, cY,
    gammaX: gamma(x2 - x1, y2 - y1),
    gammaY: gamma(y2 - y1, x2 - x1),
  };
}
