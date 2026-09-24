import { describe, expect, it } from 'vitest';
import { REBARS } from '../rebar';
import { analyzeFooting, footingLoads } from './analyzeFooting';
import { autoDims, autoFootingLayout, footingDims } from './designFooting';
import { columnLocation } from './geometry';
import { clipHalfPlane, polygonMoments, rectPolygon } from './polygon';
import { integrateNet, solvePressure } from './pressure';
import { punchingPerimeter } from './punching';
import type { FootingInput, FootingLayout } from './types';
import { validateFootingInput } from './validate';

const base: FootingInput = {
  projectName: 't', footingName: 'F1', designer: '',
  cx: 30, cy: 30, position: 'center', ex: 0, ey: 0, edgeSide: 'left', cornerSide: 'bottom-left', edgeGap: 0,
  sizeMode: 'manual', B: 200, L: 200, t: 50, cover: 7.5,
  Df: 1.5, qa: 20, gammaSoil: 1.8,
  fc: 240, fy: 4000,
  P: 40000, Mx: 0, My: 0,
  bar: 'DB16',
};
const layout16: FootingLayout = { x: { size: 'DB16', count: 12 }, y: { size: 'DB16', count: 12 }, bottom: 'x' };

describe('รูปหลายเหลี่ยม', () => {
  it('โมเมนต์พื้นที่สี่เหลี่ยม [0,2]×[0,3]', () => {
    const m = polygonMoments(rectPolygon(0, 2, 0, 3));
    expect(m.A).toBeCloseTo(6, 10);
    expect(m.Sx).toBeCloseTo(6, 10);
    expect(m.Sy).toBeCloseTo(9, 10);
    expect(m.Ixx).toBeCloseTo(8, 10);
    expect(m.Iyy).toBeCloseTo(18, 10);
    expect(m.Ixy).toBeCloseTo(9, 10);
  });
  it('ตัดด้วยครึ่งระนาบ x + y ≤ 1 ได้สามเหลี่ยม', () => {
    const m = polygonMoments(clipHalfPlane(rectPolygon(0, 1, 0, 1), 1, -1, -1));
    expect(m.A).toBeCloseTo(0.5, 10);
    expect(m.Sx).toBeCloseTo(1 / 6, 10);
    expect(m.Ixx).toBeCloseTo(1 / 12, 10);
    expect(m.Ixy).toBeCloseTo(1 / 24, 10);
  });
});

describe('แรงดันดิน (คำนวณมือ)', () => {
  const N = 52000;
  it('แกนเดียวใน kern: N/A(1 ± 6e/B)', () => {
    const p = solvePressure(200, 150, N, 20, 0);
    expect(p.full).toBe(true);
    expect(p.qmax).toBeCloseTo((N / 30000) * 1.6, 8);
    expect(p.qmin).toBeCloseTo((N / 30000) * 0.4, 8);
  });
  it('แกนเดียวนอก kern: qmax = 2N/(3L(B/2 − e)), กว้างสัมผัส 3(B/2 − e)', () => {
    const p = solvePressure(200, 150, N, 50, 0);
    expect(p.full).toBe(false);
    expect(p.qmax).toBeCloseTo((2 * N) / (3 * 150 * 50), 6);
    expect(p.contactRatio).toBeCloseTo(0.75, 6);
    expect(p.qmin).toBe(0);
  });
  it('สองแกนสัมผัสบางส่วน: สมดุลแรงและโมเมนต์', () => {
    const p = solvePressure(200, 150, N, 50, 35);
    expect(p.stable).toBe(true);
    expect(p.full).toBe(false);
    const r = integrateNet(p, 0, -100, 100, -75, 75);
    expect(Math.abs(r.F - N) / N).toBeLessThan(1e-6);
    expect(Math.abs(r.Sx - N * 50) / (N * 100)).toBeLessThan(1e-6);
    expect(Math.abs(r.Sy - N * 35) / (N * 75)).toBeLessThan(1e-6);
  });
  it('แรงลัพธ์นอกฐาน → ไม่เสถียร', () => {
    expect(solvePressure(200, 150, N, 100, 0).stable).toBe(false);
    expect(solvePressure(200, 150, N, 0, -80).stable).toBe(false);
  });
});

describe('ฐานรากศูนย์กลาง 2.00 × 2.00 × 0.50 (คำนวณมือ)', () => {
  const a = analyzeFooting(base, footingDims(base), layout16);
  it('w = 0.3 ksc, q = 1.3 ksc, q สุทธิ = P/A = 1.0 ksc', () => {
    expect(a.loads.w).toBeCloseTo(0.3, 10);
    expect(a.loads.pressure.qmax).toBeCloseTo(1.3, 10);
    expect(a.loads.pressure.qmin).toBeCloseTo(1.3, 10);
  });
  it('M ผิวเสา = q·L·a²/2, a = 85 ซม.', () => {
    expect(a.x.Mdesign).toBeCloseTo((1.0 * 200 * 85 ** 2) / 2, 3);
    expect(a.y.Mdesign).toBeCloseTo((1.0 * 200 * 85 ** 2) / 2, 3);
  });
  it('V คานที่ระยะ d = q·L·(a − d)', () => {
    const d = 50 - 7.5 - 0.8;
    expect(a.x.d).toBeCloseTo(d, 10);
    expect(Math.max(a.x.V.neg, a.x.V.pos)).toBeCloseTo(1.0 * 200 * (85 - d), 3);
  });
  it('V ทะลุ = P − q·(c + d)², ไม่มีโมเมนต์ถ่ายเท', () => {
    const d = (50 - 7.5 - 0.8 + (50 - 7.5 - 1.6 - 0.8)) / 2;
    expect(a.punching!.V).toBeCloseTo(40000 - (30 + d) ** 2, 3);
    expect(a.punching!.b0).toBeCloseTo(4 * (30 + d), 8);
    expect(Math.abs(a.punching!.Mux)).toBeLessThan(1e-3);
    expect(a.punching!.vc).toBeCloseTo(0.53 * Math.sqrt(240), 8);
  });
});

describe('เฉือนทะลุ: หน้าตัดวิกฤต', () => {
  const dims = { B: 200, L: 200 };
  it('เสาภายใน 4 ด้าน, Jc ตรงสูตร ACI', () => {
    const per = punchingPerimeter(columnLocation(base, dims), dims, 40);
    const b1 = 70;
    expect(per.nSides).toBe(4);
    expect(per.alphaS).toBe(40);
    expect(per.b0).toBeCloseTo(280, 8);
    expect(per.Jx).toBeCloseTo((40 * b1 ** 3) / 6 + (b1 * 40 ** 3) / 6 + (40 * b1 * b1 ** 2) / 2, 3);
  });
  it('ตีนเป็ดชิดขอบ 3 ด้าน, ชิดมุม 2 ด้าน', () => {
    const edge = punchingPerimeter(columnLocation({ ...base, position: 'edge', edgeSide: 'left' }, dims), dims, 40);
    expect(edge.nSides).toBe(3);
    expect(edge.alphaS).toBe(30);
    expect(edge.b0).toBeCloseTo(50 + 50 + 70, 8);
    const corner = punchingPerimeter(columnLocation({ ...base, position: 'corner', cornerSide: 'top-right' }, dims), dims, 40);
    expect(corner.nSides).toBe(2);
    expect(corner.alphaS).toBe(20);
    expect(corner.b0).toBeCloseTo(100, 8);
  });
});

describe('ออกแบบอัตโนมัติ', () => {
  const auto: FootingInput = { ...base, sizeMode: 'auto', qa: 15 };
  const noFail = (input: FootingInput) => {
    const dims = autoDims(input);
    const a = analyzeFooting(input, dims, autoFootingLayout(input, dims));
    const fails = a.checks.filter((c) => c.status === 'fail').map((c) => `${c.label}: ${c.provided} (${c.required})`);
    expect(fails).toEqual([]);
    for (const v of [dims.B, dims.L, dims.t]) expect(v % 5).toBe(0);
    return { dims, a };
  };

  it('ศูนย์กลาง เสาสี่เหลี่ยมจัตุรัส → ฐานจัตุรัส', () => {
    const { dims } = noFail(auto);
    expect(dims.B).toBe(dims.L);
  });
  it('ศูนย์กลาง + โมเมนต์สองแกน', () => noFail({ ...auto, P: 60000, Mx: -3000, My: 4000 }));
  it('เยื้องศูนย์กำหนดระยะ', () => noFail({ ...auto, position: 'offset', ex: 25, ey: -15, My: -1500 }));
  for (const edgeSide of ['left', 'right', 'bottom', 'top'] as const) {
    it(`ตีนเป็ดชิดขอบ${edgeSide}`, () => noFail({ ...auto, position: 'edge', edgeSide }));
  }
  for (const cornerSide of ['bottom-left', 'bottom-right', 'top-left', 'top-right'] as const) {
    it(`ตีนเป็ดชิดมุม ${cornerSide}`, () => noFail({ ...auto, position: 'corner', cornerSide, P: 25000 }));
  }
  it('ชิดขอบซ้าย/ขวาได้ขนาดเท่ากัน, ล่าง/บน สลับ B กับ L', () => {
    const left = autoDims({ ...auto, position: 'edge', edgeSide: 'left' });
    const right = autoDims({ ...auto, position: 'edge', edgeSide: 'right' });
    const bottom = autoDims({ ...auto, position: 'edge', edgeSide: 'bottom' });
    expect(right).toEqual(left);
    expect(bottom).toEqual({ B: left.L, L: left.B, t: left.t });
  });
  it('โมเมนต์กลับเครื่องหมายได้ขนาดเท่าเดิม', () => {
    expect(autoDims({ ...auto, My: 3000 })).toEqual(autoDims({ ...auto, My: -3000 }));
  });
});

describe('ระยะฝังเหล็ก', () => {
  it('ยื่นยาว → เหล็กตรง, ยื่นสั้น → งอขอ', () => {
    const long = analyzeFooting(base, footingDims(base), layout16);
    expect(long.x.anchorage!.hook).toBe(false);
    const shortInput = { ...base, B: 130, L: 130, t: 40, P: 60000 };
    const layout25: FootingLayout = { x: { size: 'DB25', count: 3 }, y: { size: 'DB25', count: 3 }, bottom: 'x' };
    const short = analyzeFooting(shortInput, footingDims(shortInput), layout25);
    const { ld, ldh, available, hook, ok } = short.x.anchorage!;
    expect(available).toBeCloseTo(50 - 7.5, 8);
    const excess = short.x.AsFlex / short.x.AsProv;
    const sq = Math.sqrt(240);
    expect(ld).toBeCloseTo(Math.max(Math.max((0.06 * REBARS.DB25.area * 4000) / sq, 0.0057 * 2.5 * 4000) * excess, 30), 8);
    expect(ldh).toBeCloseTo(Math.max(((318 * 2.5) / sq) * (4000 / 4200) * excess, 8 * 2.5, 15), 8);
    expect(hook).toBe(true);
    expect(ok).toBe(available >= ldh);
  });
  it('ส่วนยื่นไม่เกิน d ไม่ต้องตรวจระยะฝัง', () => {
    const stub = { ...base, B: 110, L: 110 };
    expect(analyzeFooting(stub, footingDims(stub), layout16).x.anchorage).toBeNull();
  });
});

describe('ตรวจข้อมูลนำเข้า', () => {
  it('เสาอยู่นอกฐาน (กำหนดเอง)', () => {
    expect(validateFootingInput({ ...base, position: 'offset', ex: 90 })).toContain('เสาอยู่นอกฐานราก — ขยาย B, L หรือลดระยะเยื้องศูนย์');
  });
  it('qa ต่ำกว่าน้ำหนักฐาน', () => {
    expect(validateFootingInput({ ...base, qa: 2 }).length).toBe(1);
  });
  it('น้ำหนักฐานรากเท่ากับที่ใช้คำนวณ', () => {
    expect(footingLoads(base, { B: 200, L: 200, t: 50 }).W).toBeCloseTo(12000, 8);
  });
});
