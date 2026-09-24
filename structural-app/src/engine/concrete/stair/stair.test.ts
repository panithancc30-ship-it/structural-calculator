import { describe, expect, it } from 'vitest';
import { wsdParams } from '../design/flexure';
import { asMinRatio } from '../footing/analyzeFooting';
import { REBARS } from '../rebar';
import { analyzeStair, minThickness } from './analyzeStair';
import { autoStairLayout, stairDims } from './designStair';
import { stairProfile, stairSupport } from './geometry';
import { simpleSpan, stairLoads, stairMoments } from './loads';
import type { StairInput } from './types';
import { validateStairInput } from './validate';

/** ตรงกับแบบตัวอย่าง ST (ชานพัก – ชั้น 2): 8 ลูกตั้ง @0.175, 7 ลูกนอน @0.25, ราบล่าง 1.15 ราบบน 0.60 */
const base: StairInput = {
  projectName: 'ทดสอบ',
  stairName: 'ST1',
  levels: 'ชานพัก – ชั้น 2',
  designer: '',
  usage: 'residential',
  riser: 17.5,
  tread: 25,
  risers: 8,
  landingLow: 115,
  landingHigh: 60,
  width: 120,
  endLow: 'simple',
  endHigh: 'simple',
  ascend: 'right',
  thicknessMode: 'auto',
  t: 15,
  cover: 2,
  fc: 240,
  fy: 4000,
  finishDL: 150,
  LL: 300,
  bar: 'DB12',
  tempBar: 'RB9',
};

describe('รูปทรงบันได', () => {
  it('ช่วงราบ = ราบล่าง + (N−1)·T + ราบบน และสูง N·R (ตรงกับแบบ 3.50 ม., 8@0.175 = 1.40 ม.)', () => {
    const p = stairProfile(base);
    expect(p.run).toBeCloseTo(175, 10);
    expect(p.L).toBeCloseTo(350, 10);
    expect(p.rise).toBeCloseTo(140, 10);
  });

  it('มุมลาด tan θ = R/T', () => {
    const p = stairProfile(base);
    expect(Math.tan(p.theta)).toBeCloseTo(17.5 / 25, 10);
    expect(p.slopeLength).toBeCloseTo(Math.hypot(175, 7 * 17.5), 8);
  });

  it('สภาพรองรับจากปลายสองด้าน', () => {
    expect(stairSupport('simple', 'simple')).toBe('simple');
    expect(stairSupport('continuous', 'simple')).toBe('oneEnd');
    expect(stairSupport('continuous', 'continuous')).toBe('bothEnds');
  });
});

describe('น้ำหนักบรรทุกบนพื้นที่ฉายราบ (คำนวณมือ)', () => {
  const loads = stairLoads(base, 15);
  const cos = 25 / Math.hypot(17.5, 25);

  it('ท้องบันได γ·t/cosθ และขั้นบันได γ·R/2', () => {
    expect(loads.wWaist).toBeCloseTo((2400 * 0.15) / cos, 8);
    // 2,400 × 0.175/2 = 210 กก./ตร.ม.
    expect(loads.wSteps).toBeCloseTo(210, 8);
  });

  it('ส่วนราบ = γ·t + ปูผิว + จร', () => {
    // 2,400 × 0.15 + 150 + 300 = 810
    expect(loads.wLanding).toBeCloseTo(810, 8);
  });

  it('ช่วงลาดหนักกว่าส่วนราบ', () => {
    expect(loads.wFlight).toBeGreaterThan(loads.wLanding);
  });
});

describe('สถิตศาสตร์ช่วงยึดหมุน', () => {
  it('น้ำหนักสม่ำเสมอ → R = wL/2, M = wL²/8 ที่กลางช่วง', () => {
    // w = 1,000 กก./ตร.ม. บนแถบ 1 ม., L = 4 ม. → R = 2,000 kg, M = 2,000 kg·m = 200,000 kg·cm
    const s = simpleSpan([{ x1: 0, x2: 150, w: 1000 }, { x1: 150, x2: 400, w: 1000 }], 400);
    expect(s.Rlow).toBeCloseTo(2000, 8);
    expect(s.Rhigh).toBeCloseTo(2000, 8);
    expect(s.xMax).toBeCloseTo(200, 8);
    expect(s.Mmax).toBeCloseTo(200000, 6);
  });

  it('น้ำหนักเป็นช่วง — ตรงกับคำนวณมือ', () => {
    // [0,1] ม. 1,000 · [1,3] ม. 2,000 กก./ม.; L = 3 ม.
    // W1 = 1,000 ที่ 0.5, W2 = 4,000 ที่ 2 → Rlow = (1,000×2.5 + 4,000×1)/3 = 2,166.67
    // V = 0 ที่ x = 1 + (2,166.67 − 1,000)/2,000 = 1.5833 ม.
    // M = 2,166.67×1.5833 − 1,000×1.0833 − 2,000×0.5833²/2 = 3,430.56 − 1,083.33 − 340.28 = 2,006.94 kg·m
    const s = simpleSpan([{ x1: 0, x2: 100, w: 1000 }, { x1: 100, x2: 300, w: 2000 }], 300);
    expect(s.Rlow).toBeCloseTo(6500 / 3, 6);
    expect(s.Rhigh).toBeCloseTo(5000 - 6500 / 3, 6);
    expect(s.xMax).toBeCloseTo(158.333333, 4);
    expect(s.Mmax / 100).toBeCloseTo(2006.944, 2);
  });

  it('w เทียบเท่า 8M/L² ให้โมเมนต์ช่วงยึดหมุนเท่าเดิม', () => {
    const loads = stairLoads(base, 15);
    const m = stairMoments(loads.wEq, 350, 'simple', 'simple');
    expect(m.pos).toBeCloseTo(loads.statics.Mmax, 6);
    expect(loads.wEq).toBeGreaterThan(loads.wLanding);
    expect(loads.wEq).toBeLessThan(loads.wFlight);
  });
});

describe('โมเมนต์ออกแบบ', () => {
  const w = 1000;
  const L = 350;
  const base2 = (w / 100) * L * L;

  it('ยึดหมุนสองปลาย: M+ = wL²/8 และเหล็กบนกันร้าวที่ปลาย wL²/24', () => {
    const m = stairMoments(w, L, 'simple', 'simple');
    expect(m.pos).toBeCloseTo(base2 / 8, 6);
    expect(m.negLow).toBeCloseTo(base2 / 24, 6);
    expect(m.negHigh).toBeCloseTo(base2 / 24, 6);
  });

  it('ต่อเนื่องปลายเดียว: M+ = wL²/14, ปลายต่อเนื่อง wL²/10, ปลายหล่อติดคาน wL²/24', () => {
    const m = stairMoments(w, L, 'continuous', 'simple');
    expect(m.pos).toBeCloseTo(base2 / 14, 6);
    expect(m.negLow).toBeCloseTo(base2 / 10, 6);
    expect(m.negHigh).toBeCloseTo(base2 / 24, 6);
  });

  it('ต่อเนื่องสองปลาย: M+ = wL²/16, M− = wL²/11', () => {
    const m = stairMoments(w, L, 'continuous', 'continuous');
    expect(m.pos).toBeCloseTo(base2 / 16, 6);
    expect(m.negLow).toBeCloseTo(base2 / 11, 6);
  });
});

describe('ความหนาขั้นต่ำ', () => {
  it('ยึดหมุน L/20 × (0.4 + fy/7,000) ด้วยช่วงราบ (คำนวณมือ)', () => {
    expect(minThickness(base).required).toBeCloseTo((350 / 20) * (0.4 + 4000 / 7000), 8);
  });

  it('ต่อเนื่องสองปลายใช้ L/28', () => {
    const input = { ...base, endLow: 'continuous' as const, endHigh: 'continuous' as const };
    expect(minThickness(input).required).toBeCloseTo((350 / 28) * (0.4 + 4000 / 7000), 8);
  });
});

describe('ออกแบบอัตโนมัติ', () => {
  const noFail = (input: StairInput) => {
    const dims = stairDims(input);
    const layout = autoStairLayout(input, dims);
    const a = analyzeStair(input, dims, layout);
    const failed = a.checks.filter((c) => c.status === 'fail');
    expect(failed.map((c) => c.label)).toEqual([]);
    return { dims, layout, a };
  };

  it('แบบตัวอย่าง — ความหนาปัดทีละ 2.5 ซม. และไม่บางกว่า h ขั้นต่ำ', () => {
    const { dims, a } = noFail(base);
    expect(dims.t % 2.5).toBeCloseTo(0, 8);
    expect(dims.t).toBeGreaterThanOrEqual(a.hMin.required);
  });

  it('ต่อเนื่องปลายเดียวและสองปลาย', () => {
    noFail({ ...base, endLow: 'continuous' });
    noFail({ ...base, endLow: 'continuous', endHigh: 'continuous' });
  });

  it('ช่วงยาว น้ำหนักจรสูง', () => {
    noFail({ ...base, risers: 12, landingLow: 150, landingHigh: 150, LL: 500 });
  });

  it('มีเหล็กครบทุกชุด และเหล็กบนทั้งสองปลาย', () => {
    const dims = stairDims(base);
    const layout = autoStairLayout(base, dims);
    expect(layout.bottom).not.toBeNull();
    expect(layout.topLow).not.toBeNull();
    expect(layout.topHigh).not.toBeNull();
    expect(layout.dist).not.toBeNull();
    expect(layout.step).not.toBeNull();
  });

  it('As ที่ใส่ ≥ As ที่ต้องการ และเหล็กล่าง ≥ M/(fs·j·d)', () => {
    const dims = stairDims(base);
    const layout = autoStairLayout(base, dims);
    const a = analyzeStair(base, dims, layout);
    const p = wsdParams(base.fc, base.fy, base.fy);
    const b = a.bars.bottom;
    expect(b.AsProv).toBeGreaterThanOrEqual(b.AsReq - 1e-9);
    expect(b.AsReq).toBeGreaterThanOrEqual(a.moments.pos / (p.fsAllow * p.j * b.d) - 1e-9);
    expect(a.bars.dist.AsReq).toBeCloseTo(asMinRatio(base.fy) * 100 * dims.t, 8);
  });

  it('d ของเหล็กล่าง = t − covering − db/2', () => {
    const dims = stairDims(base);
    const layout = autoStairLayout(base, dims);
    const a = analyzeStair(base, dims, layout);
    expect(a.bars.bottom.d).toBeCloseTo(dims.t - base.cover - REBARS[layout.bottom!.size].dia / 2, 10);
  });

  it('ขั้นบันไดชันขึ้น → น้ำหนักช่วงลาดมากขึ้น', () => {
    const flat = stairLoads({ ...base, riser: 15, tread: 30 }, 15);
    const steep = stairLoads({ ...base, riser: 20, tread: 22 }, 15);
    expect(steep.wFlight).toBeGreaterThan(flat.wFlight);
  });
});

describe('การตรวจสอบ', () => {
  it('เอาเหล็กล่างออก → ไม่ผ่าน', () => {
    const dims = stairDims(base);
    const layout = { ...autoStairLayout(base, dims), bottom: null };
    expect(analyzeStair(base, dims, layout).status).toBe('fail');
  });

  it('ลูกตั้งเกินเกณฑ์อาคารสาธารณะ → เตือน ไม่ใช่ไม่ผ่าน', () => {
    const input = { ...base, usage: 'public' as const, riser: 19, tread: 25 };
    const dims = stairDims(input);
    const a = analyzeStair(input, dims, autoStairLayout(input, dims));
    const riser = a.checks.find((c) => c.label.startsWith('ลูกตั้ง'));
    expect(riser?.status).toBe('warn');
  });

  it('รายการตรวจสอบเรียงตามกลุ่ม — ไม่มีกลุ่มซ้ำ', () => {
    const dims = stairDims(base);
    const a = analyzeStair(base, dims, autoStairLayout(base, dims));
    const groups = a.checks.map((c) => c.group).filter((g, i, arr) => i === 0 || arr[i - 1] !== g);
    expect(new Set(groups).size).toBe(groups.length);
  });

  it('ปฏิกิริยาลงคานรวมเท่ากับน้ำหนักทั้งช่วง (ยึดหมุนสองปลาย)', () => {
    const dims = stairDims(base);
    const a = analyzeStair(base, dims, autoStairLayout(base, dims));
    const total = a.loads.segments.reduce((s, g) => s + (g.w / 100) * (g.x2 - g.x1), 0);
    expect(a.reactions.low + a.reactions.high).toBeCloseTo(total, 6);
  });
});

describe('ตรวจข้อมูลนำเข้า', () => {
  it('ข้อมูลตัวอย่างผ่าน', () => {
    expect(validateStairInput(base)).toEqual([]);
  });

  it('จำนวนลูกตั้งต้องเป็นจำนวนเต็ม', () => {
    expect(validateStairInput({ ...base, risers: 8.5 }).length).toBeGreaterThan(0);
  });

  it('ส่วนราบปลายบนสั้นกว่าลูกนอนไม่ได้', () => {
    expect(validateStairInput({ ...base, landingHigh: 20 }).length).toBeGreaterThan(0);
  });

  it('บันไดชันเกิน 45° ไม่ได้', () => {
    expect(validateStairInput({ ...base, riser: 24, tread: 20 }).length).toBeGreaterThan(0);
  });
});
