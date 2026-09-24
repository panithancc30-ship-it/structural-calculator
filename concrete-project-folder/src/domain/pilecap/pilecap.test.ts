import { describe, expect, it } from 'vitest';
import { analyzePileCap, pileCapLoads } from './analyzePileCap';
import { autoPileCapLayout, pileCapDesign } from './designPileCap';
import { pileLayout, pileReactions } from './piles';
import type { PileCapInput } from './types';
import { validatePileCapInput } from './validate';

const zeros = Array.from({ length: 9 }, () => ({ dx: 0, dy: 0 }));

const base: PileCapInput = {
  projectName: 't', capName: 'F1', designer: '',
  cx: 30, cy: 30, ex: 0, ey: 0,
  pileShape: 'square', pileSize: 30, pileCapacity: 30, pileTension: 0,
  countMode: 'manual', pileCount: 4, rotate: false, spacing: 90, edge: 30, offsets: zeros,
  thicknessMode: 'manual', t: 60, cover: 7.5, embed: 5,
  Df: 0.6, gammaSoil: 1.8,
  fc: 240, fy: 4000,
  P: 80000, Mx: 0, My: 0,
  bar: 'DB16',
};
const four = { count: 4, rotate: false };

describe('ตำแหน่งเสาเข็ม', () => {
  it('4 ต้น s = 90, ขอบ 30 → ฐาน 1.50 × 1.50', () => {
    const l = pileLayout(base, four);
    expect(l.dims).toEqual({ B: 150, L: 150 });
    expect(l.nominal.map((p) => [p.x, p.y])).toEqual([[-45, -45], [45, -45], [-45, 45], [45, 45]]);
  });
  it('ทุกรูปแบบ ระยะห่างเข็มไม่น้อยกว่า s และกรอบเข็มอยู่กลางฐาน', () => {
    for (let count = 2; count <= 9; count++) {
      const l = pileLayout(base, { count, rotate: false });
      expect(l.nominal.length).toBe(count);
      let min = Infinity;
      for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
        min = Math.min(min, Math.hypot(l.nominal[i].x - l.nominal[j].x, l.nominal[i].y - l.nominal[j].y));
      }
      expect(min).toBeGreaterThanOrEqual(90 - 1e-9);
      const xs = l.nominal.map((p) => p.x);
      expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0, 9);
    }
  });
  it('หมุน 90° สลับด้าน Bx, By', () => {
    const a = pileLayout(base, { count: 6, rotate: false }).dims;
    const b = pileLayout(base, { count: 6, rotate: true }).dims;
    expect(b).toEqual({ B: a.L, L: a.B });
  });
  it('เสาเยื้องมากจนเลยกรอบเข็ม → ขยายฐานให้คลุมเสา', () => {
    const l = pileLayout({ ...base, ex: 80 }, four);
    expect(l.dims.B).toBe(190);
  });
});

describe('แรงในเสาเข็ม (คำนวณมือ)', () => {
  it('ศูนย์กลาง: R = (P + W)/n', () => {
    const loads = pileCapLoads(base, four, 60);
    const W = 150 * 150 * 60 * 0.0024;
    expect(loads.W).toBeCloseTo(W, 6);
    for (const R of loads.service.R) expect(R).toBeCloseTo((80000 + W) / 4, 6);
    for (const R of loads.structural.R) expect(R).toBeCloseTo(20000, 6);
  });
  it('เสาเยื้อง ex = 10: R = P/n ± P·ex·x/Σx²', () => {
    const loads = pileCapLoads({ ...base, ex: 10 }, four, 60);
    const dR = (80000 * 10 * 45) / (4 * 45 * 45);
    expect(loads.structural.R[1]).toBeCloseTo(20000 + dR, 6);
    expect(loads.structural.R[0]).toBeCloseTo(20000 - dR, 6);
  });
  it('เสาเยื้อง + My รวมกัน', () => {
    const loads = pileCapLoads({ ...base, ex: -10, My: 2000 }, four, 60);
    const MyG = 2000 * 100 - 80000 * 10;
    expect(loads.structural.MyG).toBeCloseTo(MyG, 6);
    expect(loads.structural.R[1]).toBeCloseTo(20000 + (MyG * 45) / (4 * 45 * 45), 6);
  });
  it('เข็มเยื้องหลังตอก: สมดุลแรงและโมเมนต์รอบศูนย์ถ่วงกลุ่มเข็มจริง (มี Σxy)', () => {
    const offsets = zeros.map((o, i) => (i === 3 ? { dx: 15, dy: -10 } : i === 0 ? { dx: 5, dy: 8 } : o));
    const input = { ...base, offsets, Mx: 1500, My: -800 };
    const loads = pileCapLoads(input, four, 60);
    const { R, xg, yg } = loads.structural;
    const piles = loads.piles.actual;
    expect(Math.abs(loads.structural.Ixy)).toBeGreaterThan(1);
    const col = loads.piles.column;
    expect(R.reduce((s, r) => s + r, 0)).toBeCloseTo(80000, 6);
    expect(R.reduce((s, r, i) => s + r * (piles[i].x - xg), 0)).toBeCloseTo(-80000 + 80000 * (col.x - xg), 4);
    expect(R.reduce((s, r, i) => s + r * (piles[i].y - yg), 0)).toBeCloseTo(150000 + 80000 * (col.y - yg), 4);
  });
  it('เข็มต้นเดียว / แถวเดียว: โมเมนต์ตั้งฉากรับไม่ได้', () => {
    const one = pileReactions([{ x: 0, y: 0 }], [{ F: 1000, x: 5, y: 0 }], 0, 0);
    expect(one.R[0]).toBe(1000);
    expect(one.unresisted).toBeCloseTo(5000, 9);
    const two = pileReactions([{ x: -45, y: 0 }, { x: 45, y: 0 }], [{ F: 1000, x: 0, y: 0 }], 3000, 9000);
    expect(two.unresisted).toBeCloseTo(3000, 6);
    expect(two.R[1] - two.R[0]).toBeCloseTo((2 * 9000 * 45) / (2 * 45 * 45), 6);
  });
  it('แถวเดียวแนวทแยง (เยื้อง) รับโมเมนต์ตามแนวแถว', () => {
    const r = pileReactions([{ x: -30, y: -40 }, { x: 30, y: 40 }], [{ F: 1000, x: 3, y: 4 }], 0, 0);
    expect(r.unresisted).toBeCloseTo(0, 6);
    expect(r.R[1]).toBeCloseTo(500 + (1000 * 5 * 50) / (2 * 50 * 50), 6);
  });
});

describe('ตรวจโครงสร้างฐาน 4 ต้น (คำนวณมือ)', () => {
  const layout = { x: { size: 'DB16' as const, count: 8 }, y: { size: 'DB16' as const, count: 8 }, bottom: 'x' as const };
  const a = analyzePileCap(base, four, 60, layout);
  it('M ผิวเสา = 2R·(s/2 − c/2)', () => {
    expect(a.x.Mdesign).toBeCloseTo(2 * 20000 * (45 - 15), 6);
    expect(a.y.Mdesign).toBeCloseTo(2 * 20000 * (45 - 15), 6);
  });
  it('เฉือนแบบคาน: เข็มอยู่ในระยะ d จากผิวเสา คิดตามสัดส่วน', () => {
    const d = a.x.d;
    const share = Math.min(1, Math.max(0, (45 - (15 + d)) / 30 + 0.5));
    expect(Math.max(a.x.V.neg, a.x.V.pos)).toBeCloseTo(2 * 20000 * share, 6);
  });
  it('เฉือนทะลุรอบเสา vc = 0.53√f′c', () => {
    expect(a.punching!.nSides).toBe(4);
    expect(a.punching!.vc).toBeCloseTo(0.53 * Math.sqrt(240), 8);
  });
  it('แรงเข็มเกินกำลัง → ไม่ผ่าน', () => {
    const over = analyzePileCap({ ...base, P: 140000 }, four, 60, layout);
    expect(over.checks.find((c) => c.label.startsWith('แรงในเสาเข็มสูงสุด'))!.status).toBe('fail');
  });
  it('เข็มสองต้นรับ Mx → ไม่ผ่าน (ต้องมีคานยึด)', () => {
    const two = analyzePileCap({ ...base, pileCount: 2, Mx: 1000 }, { count: 2, rotate: false }, 60, layout);
    expect(two.checks.some((c) => c.required.includes('คานยึด') && c.status === 'fail')).toBe(true);
  });
});

describe('ออกแบบอัตโนมัติ', () => {
  const auto: PileCapInput = { ...base, countMode: 'auto', thicknessMode: 'auto' };
  const noFail = (input: PileCapInput) => {
    const { arrangement, t } = pileCapDesign(input);
    const a = analyzePileCap(input, arrangement, t, autoPileCapLayout(input, arrangement, t));
    const fails = a.checks.filter((c) => c.status === 'fail').map((c) => `${c.label}: ${c.provided} (${c.required})`);
    expect(fails).toEqual([]);
    expect(t % 5).toBe(0);
    return { arrangement, t, a };
  };

  it('P = 80 ตัน, Pa = 30 ตัน → 3 ต้น', () => {
    expect(noFail(auto).arrangement.count).toBe(3);
  });
  it('เสาเยื้องศูนย์ + โมเมนต์สองแกน', () => noFail({ ...auto, P: 150000, ex: 15, ey: -10, Mx: 3000, My: -2000 }));
  it('เข็มเยื้องหลังตอก (กำหนดจำนวนเข็ม)', () =>
    noFail({ ...auto, countMode: 'manual', pileCount: 6, P: 150000, offsets: zeros.map((o, i) => (i === 2 ? { dx: 20, dy: 15 } : o)) }));
  it('มีโมเมนต์ → ไม่เลือกเข็มต้นเดียว', () => {
    expect(noFail({ ...auto, P: 20000, My: 500 }).arrangement.count).toBeGreaterThan(1);
  });
  it('เข็มกลม', () => noFail({ ...auto, pileShape: 'circle', pileSize: 40, spacing: 120, edge: 40, pileCapacity: 50, P: 200000 }));
});

describe('ตรวจข้อมูลนำเข้า', () => {
  it('ระยะหุ้มต้องมากกว่าหัวเข็มฝัง', () => {
    expect(validatePileCapInput({ ...base, embed: 10 }).length).toBe(1);
  });
  it('ข้อมูลปกติไม่มีข้อผิดพลาด', () => {
    expect(validatePileCapInput(base)).toEqual([]);
  });
});
