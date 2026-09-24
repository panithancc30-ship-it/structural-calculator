import { clipHalfPlane, polygonMoments, rectPolygon, type AreaMoments, type Pt } from './polygon';

/**
 * แรงดันดินใต้ฐานรากแข็งสี่เหลี่ยม B × L (ดินไม่รับแรงดึง)
 * q(x, y) = max(0, q0 + gx·x + gy·y) — หน่วย ksc, พิกัด ซม. จากศูนย์ถ่วงฐานราก
 */
export interface SoilPressure {
  B: number;
  L: number;
  N: number;
  ex: number;
  ey: number;
  /** แรงลัพธ์อยู่ภายในฐาน */
  stable: boolean;
  /** ดินรับแรงดันเต็มพื้นที่ (แรงลัพธ์อยู่ใน kern) */
  full: boolean;
  q0: number;
  gx: number;
  gy: number;
  contact: Pt[];
  contactRatio: number;
  qmax: number;
  qmin: number;
  /** มุม ล่างซ้าย, ล่างขวา, บนขวา, บนซ้าย */
  corners: (Pt & { q: number })[];
}

export function pressureAt(p: SoilPressure, x: number, y: number): number {
  return Math.max(0, p.q0 + p.gx * x + p.gy * y);
}

const UNIT_SQUARE = rectPolygon(-1, 1, -1, 1);

function solve3(H: number[][], g: number[]): number[] {
  const m = H.map((row, i) => [...row, g[i]]);
  for (let c = 0; c < 3; c++) {
    let piv = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    [m[c], m[piv]] = [m[piv], m[c]];
    const d = m[c][c] || 1e-300;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const k = m[r][c] / d;
      for (let j = c; j < 4; j++) m[r][j] -= k * m[c][j];
    }
  }
  return [m[0][3] / (m[0][0] || 1e-300), m[1][3] / (m[1][1] || 1e-300), m[2][3] / (m[2][2] || 1e-300)];
}

/**
 * บนสี่เหลี่ยมมาตรฐาน [−1, 1]² หา p = a + b·u + c·v ที่ ∫p⁺ = 1, ∫p⁺u = u0, ∫p⁺v = v0
 * = จุดต่ำสุดของฟังก์ชันนูน Φ = ½∫(p⁺)² − (a + b·u0 + c·v0) → Newton + backtracking ลู่เข้าเสมอเมื่อ (u0, v0) อยู่ในสี่เหลี่ยม
 */
function solveNormalized(u0: number, v0: number): { th: number[]; m: AreaMoments; poly: Pt[] } {
  const evaluate = (th: number[]) => {
    const poly = clipHalfPlane(UNIT_SQUARE, th[0], th[1], th[2]);
    const m = polygonMoments(poly);
    const [a, b, c] = th;
    const I0 = a * m.A + b * m.Sx + c * m.Sy;
    const Iu = a * m.Sx + b * m.Ixx + c * m.Ixy;
    const Iv = a * m.Sy + b * m.Ixy + c * m.Iyy;
    const phi = 0.5 * (a * I0 + b * Iu + c * Iv) - (a + b * u0 + c * v0);
    return { poly, m, phi, g: [I0 - 1, Iu - u0, Iv - v0] };
  };

  // เริ่มจากคำตอบแบบยืดหยุ่น (สัมผัสเต็ม) ซึ่งให้ Φ < 0 เสมอ
  let th = [0.25, 0.75 * u0, 0.75 * v0];
  let cur = evaluate(th);
  for (let it = 0; it < 200; it++) {
    if (Math.hypot(...cur.g) < 1e-14) break;
    const { m } = cur;
    const eps = 1e-12;
    const H = [
      [m.A + eps, m.Sx, m.Sy],
      [m.Sx, m.Ixx + eps, m.Ixy],
      [m.Sy, m.Ixy, m.Iyy + eps],
    ];
    const step = solve3(H, cur.g);
    const slope = -(cur.g[0] * step[0] + cur.g[1] * step[1] + cur.g[2] * step[2]);
    let s = 1;
    let next = cur;
    let nextTh = th;
    while (s > 1e-12) {
      nextTh = [th[0] - s * step[0], th[1] - s * step[1], th[2] - s * step[2]];
      next = evaluate(nextTh);
      if (next.phi <= cur.phi + 1e-4 * s * slope) break;
      s /= 2;
    }
    if (s <= 1e-12) break;
    th = nextTh;
    cur = next;
  }
  return { th, m: cur.m, poly: cur.poly };
}

export function solvePressure(B: number, L: number, N: number, ex: number, ey: number): SoilPressure {
  const u0 = ex / (B / 2);
  const v0 = ey / (L / 2);
  const cornerPts = [
    { x: -B / 2, y: -L / 2 },
    { x: B / 2, y: -L / 2 },
    { x: B / 2, y: L / 2 },
    { x: -B / 2, y: L / 2 },
  ];
  const base = { B, L, N, ex, ey };

  if (!(N > 0) || !(Math.abs(u0) < 1 - 1e-9) || !(Math.abs(v0) < 1 - 1e-9)) {
    return {
      ...base, stable: false, full: false, q0: 0, gx: 0, gy: 0, contact: [], contactRatio: 0,
      qmax: Infinity, qmin: 0, corners: cornerPts.map((p) => ({ ...p, q: 0 })),
    };
  }

  const full = 3 * (Math.abs(u0) + Math.abs(v0)) <= 1 + 1e-12;
  let th: number[];
  let contactRatio = 1;
  let contact = rectPolygon(-B / 2, B / 2, -L / 2, L / 2);
  if (full) {
    th = [0.25, 0.75 * u0, 0.75 * v0];
  } else {
    const r = solveNormalized(u0, v0);
    th = r.th;
    contactRatio = r.m.A / 4;
    contact = r.poly.map((p) => ({ x: (p.x * B) / 2, y: (p.y * L) / 2 }));
  }

  const k = (4 * N) / (B * L);
  const p: SoilPressure = {
    ...base, stable: true, full,
    q0: k * th[0], gx: (k * th[1]) / (B / 2), gy: (k * th[2]) / (L / 2),
    contact, contactRatio, qmax: 0, qmin: 0, corners: [],
  };
  p.corners = cornerPts.map((c) => ({ ...c, q: pressureAt(p, c.x, c.y) }));
  p.qmax = Math.max(...p.corners.map((c) => c.q));
  p.qmin = Math.min(...p.corners.map((c) => c.q));
  return p;
}

/** ∫(q⁺ − w)dA, ∫(q⁺ − w)x dA, ∫(q⁺ − w)y dA บนสี่เหลี่ยม [x1, x2] × [y1, y2] — w = น้ำหนักฐานรากและดินถมต่อพื้นที่ (ksc) */
export function integrateNet(p: SoilPressure, w: number, x1: number, x2: number, y1: number, y2: number) {
  if (!(x2 > x1) || !(y2 > y1)) return { F: 0, Sx: 0, Sy: 0 };
  const rect = rectPolygon(x1, x2, y1, y2);
  const m = polygonMoments(p.stable ? clipHalfPlane(rect, p.q0, p.gx, p.gy) : []);
  const area = (x2 - x1) * (y2 - y1);
  return {
    F: p.q0 * m.A + p.gx * m.Sx + p.gy * m.Sy - w * area,
    Sx: p.q0 * m.Sx + p.gx * m.Ixx + p.gy * m.Ixy - (w * area * (x1 + x2)) / 2,
    Sy: p.q0 * m.Sy + p.gx * m.Ixy + p.gy * m.Iyy - (w * area * (y1 + y2)) / 2,
  };
}
