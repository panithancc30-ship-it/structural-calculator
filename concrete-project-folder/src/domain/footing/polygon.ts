/** รูปหลายเหลี่ยมนูน: ตัดด้วยครึ่งระนาบ และอินทิเกรตโมเมนต์พื้นที่แบบแม่นตรง */

export interface Pt {
  x: number;
  y: number;
}

/** ∫dA, ∫x dA, ∫y dA, ∫x² dA, ∫y² dA, ∫xy dA */
export interface AreaMoments {
  A: number;
  Sx: number;
  Sy: number;
  Ixx: number;
  Iyy: number;
  Ixy: number;
}

const ZERO: AreaMoments = { A: 0, Sx: 0, Sy: 0, Ixx: 0, Iyy: 0, Ixy: 0 };

/** สี่เหลี่ยมทวนเข็มนาฬิกา */
export function rectPolygon(x1: number, x2: number, y1: number, y2: number): Pt[] {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

/** เก็บเฉพาะส่วนที่ a + b·x + c·y ≥ 0 (Sutherland–Hodgman) */
export function clipHalfPlane(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const out: Pt[] = [];
  const f = (p: Pt) => a + b * p.x + c * p.y;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = f(p);
    const fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const s = fp / (fp - fq);
      out.push({ x: p.x + s * (q.x - p.x), y: p.y + s * (q.y - p.y) });
    }
  }
  return out;
}

export function polygonMoments(poly: Pt[]): AreaMoments {
  if (poly.length < 3) return ZERO;
  let A = 0;
  let Sx = 0;
  let Sy = 0;
  let Ixx = 0;
  let Iyy = 0;
  let Ixy = 0;
  for (let i = 0; i < poly.length; i++) {
    const { x: x0, y: y0 } = poly[i];
    const { x: x1, y: y1 } = poly[(i + 1) % poly.length];
    const cr = x0 * y1 - x1 * y0;
    A += cr;
    Sx += (x0 + x1) * cr;
    Sy += (y0 + y1) * cr;
    Ixx += (x0 * x0 + x0 * x1 + x1 * x1) * cr;
    Iyy += (y0 * y0 + y0 * y1 + y1 * y1) * cr;
    Ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * cr;
  }
  const sign = A < 0 ? -1 : 1;
  return { A: (sign * A) / 2, Sx: (sign * Sx) / 6, Sy: (sign * Sy) / 6, Ixx: (sign * Ixx) / 12, Iyy: (sign * Iyy) / 12, Ixy: (sign * Ixy) / 24 };
}
