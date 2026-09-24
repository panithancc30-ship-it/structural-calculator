import { describe, expect, it } from 'vitest';
import { wsdParams } from '../design/flexure';
import { asMinRatio } from '../footing/analyzeFooting';
import { REBARS } from '../rebar';
import { analyzeSlab, minThickness } from './analyzeSlab';
import { autoSlabLayout, slabDims } from './designSlab';
import { supportConditionOf } from './geometry';
import { rankineGrashof, selfWeight, slabLoads, stripMoments } from './loads';
import type { SlabInput } from './types';
import { validateSlabInput } from './validate';

const base: SlabInput = {
  projectName: 'ทดสอบ',
  slabName: 'S1',
  designer: '',
  slabType: 'twoWay',
  lx: 400,
  ly: 500,
  edgeX1: 'continuous',
  edgeX2: 'continuous',
  edgeY1: 'continuous',
  edgeY2: 'continuous',
  thicknessMode: 'auto',
  t: 12,
  cover: 2,
  fc: 240,
  fy: 4000,
  finishDL: 150,
  LL: 300,
  usage: 'light',
  bar: 'DB12',
  tempBar: 'RB9',
};

const oneWay: SlabInput = { ...base, slabType: 'oneWay', lx: 300, ly: 700, edgeX1: 'simple', edgeX2: 'simple' };
const cantilever: SlabInput = { ...base, slabType: 'cantilever', lx: 150, ly: 400, edgeX1: 'continuous', edgeX2: 'free' };
const onGround: SlabInput = { ...base, slabType: 'onGround', cover: 7.5, usage: 'medium' };

describe('น้ำหนักบรรทุก', () => {
  it('น้ำหนักตัวพื้น = t × 2,400 กก./ลบ.ม. (คำนวณมือ)', () => {
    // 12 ซม. = 0.12 ม. × 2,400 = 288 กก./ตร.ม.
    expect(selfWeight(12)).toBeCloseTo(288, 10);
  });

  it('w = น้ำหนักคงที่ + จร โดยไม่คูณตัวประกอบ (วิธีหน่วยแรงใช้งาน)', () => {
    const loads = slabLoads(base, 12);
    expect(loads.wDead).toBeCloseTo(288 + 150, 10);
    expect(loads.w).toBeCloseTo(288 + 150 + 300, 10);
  });
});

describe('การแบ่งน้ำหนักพื้นสองทาง (Rankine–Grashof)', () => {
  it('wx = w·ly⁴/(lx⁴+ly⁴) และ wx + wy = w (คำนวณมือ)', () => {
    // lx = 4, ly = 5 → 5⁴/(4⁴+5⁴) = 625/881
    const ratio = rankineGrashof(400, 500);
    expect(ratio).toBeCloseTo(625 / 881, 10);
    const loads = slabLoads(base, 12);
    expect(loads.share.x + loads.share.y).toBeCloseTo(loads.w, 8);
  });

  it('พื้นจัตุรัส → แถบสองทิศรับเท่ากัน', () => {
    expect(rankineGrashof(400, 400)).toBeCloseTo(0.5, 10);
  });

  it('แถบด้านสั้นรับน้ำหนักมากกว่าแถบด้านยาว', () => {
    const loads = slabLoads(base, 12);
    expect(loads.share.x).toBeGreaterThan(loads.share.y);
  });

  it('พื้นทางเดียวไม่แบ่งน้ำหนัก — แถบทิศ x รับทั้งหมด', () => {
    const loads = slabLoads(oneWay, 12);
    expect(loads.share.x).toBeCloseTo(loads.w, 10);
    expect(loads.share.y).toBe(0);
  });
});

describe('โมเมนต์ของแถบกว้าง 1 ม. (คำนวณมือ)', () => {
  it('ยึดหมุนสองปลาย M = w·L²/8', () => {
    // w = 1,000 กก./ตร.ม., L = 3 ม. → 1,000 × 3²/8 = 1,125 กก.·ม. = 112,500 kg·cm
    expect(stripMoments(1000, 300, 'simple').pos).toBeCloseTo(112500, 6);
  });

  it('ต่อเนื่องสองปลาย M+ = w·L²/16 และ M− = w·L²/11', () => {
    const m = stripMoments(1000, 300, 'bothEnds');
    expect(m.pos).toBeCloseTo((1000 / 100) * 300 * 300 / 16, 6);
    expect(m.negInt).toBeCloseTo((1000 / 100) * 300 * 300 / 11, 6);
    expect(m.negEnd).toBe(0);
  });

  it('พื้นยื่น M = w·L²/2 ที่ผิวที่รองรับ และไม่มีโมเมนต์บวก', () => {
    const m = stripMoments(1000, 150, 'cantilever');
    expect(m.negEnd).toBeCloseTo((1000 / 100) * 150 * 150 / 2, 6);
    expect(m.pos).toBe(0);
  });
});

describe('สภาพรองรับจากสภาพขอบ', () => {
  it('ขอบต่อเนื่องสองด้าน → bothEnds', () => {
    expect(supportConditionOf(base, 'x')).toBe('bothEnds');
  });

  it('ขอบยึดหมุนสองด้าน → simple', () => {
    expect(supportConditionOf(oneWay, 'x')).toBe('simple');
  });

  it('มีขอบอิสระ → cantilever', () => {
    expect(supportConditionOf(cantilever, 'x')).toBe('cantilever');
  });
});

describe('ความหนาขั้นต่ำ', () => {
  it('พื้นทางเดียวยึดหมุน L/20 × (0.4 + fy/7,000) (คำนวณมือ)', () => {
    // L = 300 ซม., fy = 4,000 → (300/20) × (0.4 + 4000/7000) = 15 × 0.971428…
    const expected = (300 / 20) * (0.4 + 4000 / 7000);
    expect(minThickness(oneWay, oneWay).required).toBeCloseTo(expected, 8);
  });

  it('พื้นสองทางใช้เส้นรอบรูป/180', () => {
    // 2×(400+500)/180 = 10 ซม.
    expect(minThickness(base, base).required).toBeCloseTo(10, 8);
  });

  it('ตัวคูณ fy เป็นชุดเดียวกับความลึกขั้นต่ำของคาน', () => {
    const a = minThickness({ ...oneWay, fy: 2400 }, oneWay).required;
    const b = minThickness({ ...oneWay, fy: 4000 }, oneWay).required;
    expect(a / b).toBeCloseTo((0.4 + 2400 / 7000) / (0.4 + 4000 / 7000), 8);
  });

  it('พื้นวางบนดินใช้ความหนาตามการใช้งาน', () => {
    expect(minThickness(onGround, onGround).required).toBeCloseTo(12.5, 8);
  });
});

describe('เหล็กกันร้าว — ใช้ asMinRatio ร่วมกับฐานราก (ACI 7.12)', () => {
  it('fy = 2,400 → ρ = 0.0020', () => expect(asMinRatio(2400)).toBeCloseTo(0.002, 10));
  it('fy = 4,000 → ρ = 0.0018', () => expect(asMinRatio(4000)).toBeCloseTo(0.0018, 10));
  it('fy = 5,000 → ρ = 0.00144', () => expect(asMinRatio(5000)).toBeCloseTo(0.00144, 10));
});

describe('เลือกระยะเรียงอัตโนมัติ', () => {
  const eachRun = (input: SlabInput) => {
    const dims = slabDims(input);
    const layout = autoSlabLayout(input, dims);
    const runs = [...Object.values(layout.bottom), ...Object.values(layout.top)].filter((r) => r !== null);
    return { dims, layout, runs };
  };

  it('ระยะเรียงเป็นพหุคูณของ 2.5 ซม. และไม่ถี่กว่า 7.5 ซม.', () => {
    for (const input of [base, oneWay, cantilever, onGround]) {
      for (const run of eachRun(input).runs) {
        expect(run!.spacing % 2.5).toBeCloseTo(0, 10);
        expect(run!.spacing).toBeGreaterThanOrEqual(7.5);
      }
    }
  });

  it('As ที่ใส่ ≥ As ที่ต้องการ ทุกชุด', () => {
    const { dims, layout } = eachRun(base);
    const a = analyzeSlab(base, dims, layout);
    for (const dir of [a.x, a.y]) {
      for (const face of ['bottom', 'top'] as const) {
        if (!layout[face][dir.dir]) continue;
        expect(dir[face].AsProv).toBeGreaterThanOrEqual(dir[face].AsReq * (1 - 1e-6));
      }
    }
  });

  it('ระยะเรียงไม่เกิน min(3h, 45) สำหรับเหล็กหลัก', () => {
    const { dims, layout } = eachRun(base);
    const a = analyzeSlab(base, dims, layout);
    for (const dir of [a.x, a.y]) {
      if (dir.bottom.spacing === null) continue;
      expect(dir.bottom.spacing).toBeLessThanOrEqual(Math.min(3 * dims.t, 45) + 1e-9);
    }
  });

  it('As ต่ำสุดของพื้นคิดจากความหนาเต็ม ไม่ใช่ 14bd/fy ของคาน', () => {
    const { dims, layout } = eachRun(base);
    const a = analyzeSlab(base, dims, layout);
    expect(a.x.bottom.AsMin).toBeCloseTo(asMinRatio(base.fy) * 100 * dims.t, 8);
  });
});

describe('ออกแบบอัตโนมัติ', () => {
  const noFail = (input: SlabInput) => {
    const dims = slabDims(input);
    const layout = autoSlabLayout(input, dims);
    const a = analyzeSlab(input, dims, layout);
    const fails = a.checks.filter((c) => c.status === 'fail').map((c) => `${c.label}: ${c.provided} (${c.required})`);
    expect(fails).toEqual([]);
    expect(dims.t % 2.5).toBeCloseTo(0, 10);
    return { dims, a };
  };

  it('พื้นสองทางต่อเนื่องสี่ด้าน', () => {
    const { a } = noFail(base);
    expect(a.loads.splitRatio).not.toBeNull();
  });

  it('พื้นทางเดียวยึดหมุน', () => noFail(oneWay));
  it('พื้นทางเดียวต่อเนื่องสองปลาย', () =>
    noFail({ ...oneWay, edgeX1: 'continuous', edgeX2: 'continuous' }));
  it('พื้นยื่น — เหล็กหลักอยู่ผิวบน', () => {
    const dims = slabDims(cantilever);
    const layout = autoSlabLayout(cantilever, dims);
    noFail(cantilever);
    expect(layout.top.x).not.toBeNull();
  });
  it('พื้นวางบนดิน — มีเหล็กกันร้าวสองทิศ', () => {
    const dims = slabDims(onGround);
    const layout = autoSlabLayout(onGround, dims);
    noFail(onGround);
    expect(layout.bottom.x).not.toBeNull();
    expect(layout.bottom.y).not.toBeNull();
  });

  it('ช่วงยาวขึ้น → พื้นหนาขึ้น', () => {
    const short = slabDims({ ...oneWay, lx: 250 }).t;
    const long = slabDims({ ...oneWay, lx: 450 }).t;
    expect(long).toBeGreaterThan(short);
  });

  it('น้ำหนักตัวพื้นถูกคิดใหม่ทุกครั้งที่ลองความหนา', () => {
    const dims = slabDims(oneWay);
    const a = analyzeSlab(oneWay, dims, autoSlabLayout(oneWay, dims));
    expect(a.loads.wSelf).toBeCloseTo(selfWeight(dims.t), 8);
  });
});

describe('หน่วยแรงและการตรวจสอบ', () => {
  it('n, k, j, R ตรงกับเอนจินกลาง', () => {
    const dims = slabDims(base);
    const a = analyzeSlab(base, dims, autoSlabLayout(base, dims));
    const p = wsdParams(base.fc, base.fy, base.fy);
    expect(a.params.n).toBe(p.n);
    expect(a.params.R).toBeCloseTo(p.R, 10);
  });

  it('รายการตรวจสอบเรียงตามกลุ่ม — ไม่มีกลุ่มซ้ำ', () => {
    const dims = slabDims(base);
    const a = analyzeSlab(base, dims, autoSlabLayout(base, dims));
    const groups = a.checks.map((c) => c.group);
    const firstSeen = groups.filter((g, i) => groups.indexOf(g) === i);
    expect(groups).toEqual([...groups].sort((p, q) => firstSeen.indexOf(p) - firstSeen.indexOf(q)));
  });

  it('น้ำหนักจรเกิน 3 เท่าของน้ำหนักคงที่ → เตือนว่าสัมประสิทธิ์ใช้ไม่ได้', () => {
    const heavy = { ...base, LL: 4000, thicknessMode: 'manual' as const, t: 20 };
    const a = analyzeSlab(heavy, slabDims(heavy), autoSlabLayout(heavy, slabDims(heavy)));
    const check = a.checks.find((c) => c.label.includes('เงื่อนไขใช้สัมประสิทธิ์'));
    expect(check?.status).toBe('warn');
  });

  it('พื้นวางบนดินเตือนเรื่องน้ำหนักกระทำเป็นจุด', () => {
    const dims = slabDims(onGround);
    const a = analyzeSlab(onGround, dims, autoSlabLayout(onGround, dims));
    expect(a.checks.some((c) => c.label.includes('ล้อรถ') && c.status === 'warn')).toBe(true);
  });

  it('ปฏิกิริยาลงคาน = w·L/2 ต่อความยาว 1 ม. (คำนวณมือ)', () => {
    const dims = slabDims(oneWay);
    const a = analyzeSlab(oneWay, dims, autoSlabLayout(oneWay, dims));
    expect(a.x.reaction).toBeCloseTo((a.loads.w * (oneWay.lx / 100)) / 2, 6);
  });

  it('เหล็กสองทิศของผิวเดียวกันซ้อนกัน — ชั้นในได้ d น้อยกว่า', () => {
    const dims = slabDims(base);
    const layout = autoSlabLayout(base, dims);
    const a = analyzeSlab(base, dims, layout);
    const outer = layout.outerLayer.bottom;
    const inner = outer === 'x' ? 'y' : 'x';
    if (layout.bottom[inner]) {
      expect(a[inner].bottom.d).toBeLessThan(a[outer].bottom.d);
      expect(a[inner].bottom.d).toBeCloseTo(
        dims.t - base.cover - REBARS[layout.bottom[outer]!.size].dia - REBARS[layout.bottom[inner]!.size].dia / 2,
        8,
      );
    }
  });
});

describe('ตรวจข้อมูลนำเข้า', () => {
  it('ข้อมูลเริ่มต้นผ่าน', () => {
    for (const input of [base, oneWay, cantilever, onGround]) {
      expect(validateSlabInput(input)).toEqual([]);
    }
  });

  it('พื้นยื่นต้องมีขอบอิสระตรงข้ามขอบยึด', () => {
    expect(validateSlabInput({ ...cantilever, edgeX2: 'simple' }).length).toBeGreaterThan(0);
  });

  it('ขอบอิสระใช้กับพื้นที่ไม่ใช่พื้นยื่นไม่ได้', () => {
    expect(validateSlabInput({ ...base, edgeX1: 'free' }).length).toBeGreaterThan(0);
  });

  it('ช่วงนอกพิสัยถูกปฏิเสธ', () => {
    expect(validateSlabInput({ ...base, lx: 5 }).length).toBeGreaterThan(0);
  });
});
