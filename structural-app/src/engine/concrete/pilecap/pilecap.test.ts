import { describe, expect, it } from 'vitest';
import { analyzePileCap, basketRecommended, pileCapLoads } from './analyzePileCap';
import { cageBarCount, cageTieText } from './cage';
import { autoPileCapLayout, pileCapDesign } from './designPileCap';
import { pileLayout, pileReactions } from './piles';
import type { PileCapInput } from './types';
import { validatePileCapInput } from './validate';
import { REBARS } from '../rebar';

const zeros = Array.from({ length: 9 }, () => ({ dx: 0, dy: 0 }));

const base: PileCapInput = {
  capName: 'F1',
  cx: 30, cy: 30, ex: 0, ey: 0,
  pileShape: 'square', pileSize: 30, pileCapacity: 30, pileTension: 0,
  countMode: 'manual', pileCount: 4, rotate: false, spacing: 90, edge: 30, offsets: zeros,
  sizeMode: 'auto', B: 150, L: 150,
  thicknessMode: 'manual', t: 60, cover: 7.5, embed: 5, embedSingle: 30, lean: 5, sand: 5,
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
    noFail({ ...auto, countMode: 'manual', pileCount: 6, P: 150000, offsets: zeros.map((o, i) => (i === 2 ? { dx: 12, dy: 10 } : o)) }));
  it('เข็มเยื้องจนผิวเข็มเลยขอบฐานราก → ไม่ผ่าน', () => {
    const input = { ...base, offsets: zeros.map((o, i) => (i === 1 ? { dx: 20, dy: 0 } : o)) };
    const a = analyzePileCap(input, four, 60, autoPileCapLayout(input, four, 60));
    expect(a.checks.find((c) => c.label.startsWith('ระยะผิวเข็มถึงขอบ'))!.status).toBe('fail');
  });
  it('มีโมเมนต์ → ไม่เลือกเข็มต้นเดียว', () => {
    expect(noFail({ ...auto, P: 20000, My: 500 }).arrangement.count).toBeGreaterThan(1);
  });
  it('เข็มกลม', () => noFail({ ...auto, pileShape: 'circle', pileSize: 40, spacing: 120, edge: 40, pileCapacity: 50, P: 200000 }));
});

describe('เข็มต้นเดียว: เหล็กยืน + ปลอก ตามแบบมาตรฐาน', () => {
  // แบบ F1: ฐาน 0.60 × 0.60 × 0.80, เข็ม □-22 รับ 20 ตัน ฝังในฐาน 0.30, เหล็กยืน 8-DB16, ปลอก 2ป RB9 @0.10
  const single: PileCapInput = { ...base, pileCount: 1, pileSize: 22, pileCapacity: 20, P: 15000, t: 80, cx: 20, cy: 20 };
  const one = { count: 1, rotate: false };
  const layout = autoPileCapLayout(single, one, 80);
  const a = analyzePileCap(single, one, 80, layout);

  it('ฐาน 0.60 × 0.60 ใช้ 8-DB16 + 2ป RB9 @0.10 และผ่านทุกข้อ', () => {
    expect(a.dims).toMatchObject({ B: 60, L: 60 });
    expect(layout.cage).toEqual({ size: 'DB16', count: 8, tie: 'RB9', tieSpacing: 10 });
    expect(layout.basket).toBe(false);
    expect(a.cage).not.toBeNull();
    expect(a.checks.filter((c) => c.status !== 'ok')).toEqual([]);
    expect(a.checks.some((c) => c.label.includes('ตะกร้อ'))).toBe(false);
  });

  it('เหล็กยืน As ≥ ρ·Bx·By และปลอก (2 + 2cos45°) ขาต่อชั้น ≥ ρ·b·t (RB ใช้ ρ ของ SR24)', () => {
    const c = a.cage!;
    expect(c.AsV).toBeCloseTo(8 * REBARS.DB16.area, 8);
    expect(c.AsVReq).toBeCloseTo(0.0018 * 60 * 60, 8);
    expect(c.AsTieReq).toBeCloseTo(0.0025 * 60 * 80, 8);
    expect(c.AsTie).toBeCloseTo(c.tieZ.length * (2 + Math.SQRT2) * REBARS.RB9.area, 8);
    expect(c.tieZ.length).toBe(7);
    expect(c.tieSMax).toBeCloseTo(16 * 1.6, 8);
    expect(c.bars).toHaveLength(8);
  });

  it('ความลึกเหนือหัวเข็มน้อยกว่า 30 ซม. → ไม่ผ่าน', () => {
    const thin = analyzePileCap(single, one, 55, autoPileCapLayout(single, one, 55));
    expect(thin.checks.find((c) => c.label.startsWith('ความลึกเหนือหัวเข็ม'))!.status).toBe('fail');
  });

  it('ความหนาอัตโนมัติ = ระยะฝังหัวเข็ม + 30 ซม.', () => {
    const d = pileCapDesign({ ...single, countMode: 'auto', thicknessMode: 'auto' });
    expect(d.arrangement.count).toBe(1);
    expect(d.t).toBe(60);
  });

  it('เพิ่มเหล็กยืนเป็น 12 เส้น: ด้านละ 4 เส้น เรียงเท่ากัน As เพิ่มตาม', () => {
    const c = analyzePileCap(single, one, 80, { ...layout, cage: { ...layout.cage!, count: 12 } }).cage!;
    expect(c.count).toBe(12);
    expect(c.perSide).toBe(4);
    expect(c.bars).toHaveLength(12);
    expect(new Set(c.bars.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)).size).toBe(12);
    expect(c.AsV).toBeCloseTo(12 * REBARS.DB16.area, 8);
    const ax = 30 - c.inset;
    expect(c.pitch).toBeCloseTo((2 * ax) / 3, 8);
    expect(c.ties).toBe(2);
    expect(cageTieText(c)).toBe('2ป RB9 @0.10');
  });

  it('เหล็กยืน 4 เส้น (มุมอย่างเดียว) ใช้ปลอกรอบนอกชุดเดียว — ขาปลอก 2 ขาต่อทิศ', () => {
    const c = analyzePileCap(single, one, 80, { ...layout, cage: { ...layout.cage!, count: 4 } }).cage!;
    expect(c.bars).toHaveLength(4);
    expect(c.ties).toBe(1);
    expect(cageTieText(c)).toBe('1ป RB9 @0.10');
    expect(c.AsTie).toBeCloseTo(c.tieZ.length * 2 * REBARS.RB9.area, 8);
  });

  it('จำนวนเหล็กยืนปัดเป็นทวีคูณของ 4 ในช่วง 4–40', () => {
    expect(cageBarCount({})).toBe(8);
    expect(cageBarCount({ count: 13 })).toBe(12);
    expect(cageBarCount({ count: 0 })).toBe(4);
    expect(cageBarCount({ count: 100 })).toBe(40);
  });

  it('ฐานเข็มต้นเดียวขนาดใหญ่: โปรแกรมเพิ่มจำนวนเหล็กยืนจนระยะเรียงไม่เกิน min(3t, 45)', () => {
    const big: PileCapInput = { ...single, pileSize: 60, pileCapacity: 150, P: 100000, sizeMode: 'manual', B: 160, L: 160 };
    const l = autoPileCapLayout(big, one, 80);
    expect(l.cage!.count).toBeGreaterThan(8);
    const c = analyzePileCap(big, one, 80, l).cage!;
    expect(c.pitch).toBeLessThanOrEqual(c.sMax);
  });

  it('ไฟล์เก่าที่ไม่มี cage ใช้เหล็กยืนที่ออกแบบอัตโนมัติ', () => {
    const old = analyzePileCap(single, one, 80, { x: layout.x, y: layout.y, bottom: 'x', basket: true });
    expect(old.cage).toMatchObject({ size: 'DB16', tie: 'RB9', tieSpacing: 10 });
    expect(old.basket).toBe(false);
  });
});

describe('เหล็กเสริมแบบตะกร้อ (เข็มกลุ่ม)', () => {
  it('เกณฑ์: เข็มกลุ่มที่หนาตั้งแต่ 90 ซม.', () => {
    expect(basketRecommended(1, 90)).toBe(false);
    expect(basketRecommended(4, 60)).toBe(false);
    expect(basketRecommended(4, 90)).toBe(true);
  });

  it('ฐาน 4 ต้นหนา 60 ซม. ไม่ใช้ตะกร้อ และไม่มีรายการตรวจตะกร้อ', () => {
    const layout = autoPileCapLayout(base, four, 60);
    expect(layout.basket).toBe(false);
    expect(analyzePileCap(base, four, 60, layout).checks.some((c) => c.label.includes('ตะกร้อ'))).toBe(false);
  });

  it('ระยะเรียงเหล็กตะกร้อไม่เกิน 20 ซม.', () => {
    const a = analyzePileCap(base, four, 90, autoPileCapLayout(base, four, 90));
    expect(a.basket).toBe(true);
    expect(a.x.sMax).toBe(20);
    expect(a.x.pitch).toBeLessThanOrEqual(20);
  });

  it('เข็มรับแรงถอน: ขาบนของตะกร้อใช้เป็นเหล็กบน', () => {
    const uplift: PileCapInput = { ...base, P: 5000, My: 6000, pileTension: 10, t: 90 };
    const layout = autoPileCapLayout(uplift, four, 90);
    expect(layout.basket).toBe(true);
    const a = analyzePileCap(uplift, four, 90, layout);
    const top = a.x.top ?? a.y.top;
    expect(top).not.toBeNull();
    expect(top!.AsProvTop).toBeCloseTo(a.x.top ? a.x.AsProv : a.y.AsProv, 8);
  });
});

describe('ขนาดแปลนกำหนดเอง', () => {
  const manual: PileCapInput = { ...base, sizeMode: 'manual', B: 180, L: 160 };
  it('ใช้ Bx × By ที่กรอก กลุ่มเข็มอยู่กลางฐาน', () => {
    const l = pileLayout(manual, four);
    expect(l.dims).toEqual({ B: 180, L: 160 });
    expect(l.nominal[0]).toEqual({ x: -45, y: -45 });
  });
  it('น้ำหนักฐานรากคิดจากขนาดที่กรอก', () => {
    expect(pileCapLoads(manual, four, 60).W).toBeCloseTo(180 * 160 * 60 * 0.0024, 6);
  });
  it('ฐานเล็กจนเข็มเลยขอบ → ไม่ผ่าน, เสาเลยขอบ → ไม่ผ่าน', () => {
    const small = { ...base, sizeMode: 'manual' as const, B: 100, L: 150 };
    const a = analyzePileCap(small, four, 60, autoPileCapLayout(small, four, 60));
    expect(a.checks.find((c) => c.label.startsWith('ระยะผิวเข็มถึงขอบ'))!.status).toBe('fail');
    const offset = { ...base, sizeMode: 'manual' as const, B: 150, L: 150, ex: 70 };
    const b = analyzePileCap(offset, four, 60, autoPileCapLayout(offset, four, 60));
    expect(b.checks.find((c) => c.label.startsWith('เสาอยู่ในฐานราก'))!.status).toBe('fail');
  });
  it('ตรวจช่วงขนาดเมื่อกำหนดเอง', () => {
    expect(validatePileCapInput({ ...manual, B: 10 }).length).toBe(1);
    expect(validatePileCapInput({ ...base, B: 10 })).toEqual([]);
  });
});

describe('ตรวจข้อมูลนำเข้า', () => {
  it('ระยะหุ้มต้องมากกว่าหัวเข็มฝัง', () => {
    expect(validatePileCapInput({ ...base, embed: 10 }).length).toBe(1);
  });
  it('ข้อมูลปกติไม่มีข้อผิดพลาด', () => {
    expect(validatePileCapInput(base)).toEqual([]);
  });
});
