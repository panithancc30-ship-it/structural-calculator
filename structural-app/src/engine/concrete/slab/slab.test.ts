import { describe, expect, it } from 'vitest';
import { wsdParams } from '../design/flexure';
import { asMinRatio } from '../footing/analyzeFooting';
import { REBARS } from '../rebar';
import { analyzeSlab, minThickness } from './analyzeSlab';
import { autoSlabLayout, slabDims } from './designSlab';
import { supportConditionOf } from './geometry';
import { crankDirs, detailDir, slabDetail, topAtSupport, topSpacingAtSupport } from './detail';
import { groundSlab, subgradeDragAs } from './ground';
import { clampSpacing, setExtra, setMesh, setRun, stepSpacing } from './layoutOps';
import { beamReaction, method2Interp, selfWeight, slabLoads, stripMoments, twoWayCase, twoWayMoments } from './loads';
import type { SlabInput } from './types';
import { validateSlabInput } from './validate';

const base: SlabInput = {
  slabName: 'S1',
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
  level: 'general',
  usage: 'light',
  qa: 2,
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

describe('พื้นสองทาง วิธีที่ 2 (คำนวณมือ)', () => {
  // lx 4 ม., ly 5 ม. → m = 0.8, ต่อเนื่องสี่ด้าน = กรณี 1, t 12 ซม. → w = 288 + 150 + 300 = 738 กก./ตร.ม.
  const w = 738;

  it('กรณีตามจำนวนขอบไม่ต่อเนื่อง', () => {
    expect(twoWayCase(base)).toBe(1);
    expect(twoWayCase({ ...base, edgeY1: 'simple' })).toBe(2);
    expect(twoWayCase({ ...base, edgeX1: 'simple', edgeX2: 'simple', edgeY1: 'simple', edgeY2: 'simple' })).toBe(5);
  });

  it('ช่วงสั้น m = 0.8 กรณี 1: M+ = 0.036·w·S², M− = 0.048·w·S²', () => {
    const m = twoWayMoments(base, w, 'x');
    expect(m.pos).toBeCloseTo(0.036 * (w / 100) * 400 * 400, 6);
    expect(m.negInt).toBeCloseTo(0.048 * (w / 100) * 400 * 400, 6);
    expect(m.negEnd).toBe(0);
  });

  it('ช่วงยาวใช้ S² เช่นกัน: M+ = 0.025·w·S², M− = 0.033·w·S²', () => {
    const m = twoWayMoments(base, w, 'y');
    expect(m.pos).toBeCloseTo(0.025 * (w / 100) * 400 * 400, 6);
    expect(m.negInt).toBeCloseTo(0.033 * (w / 100) * 400 * 400, 6);
  });

  it('ขอบไม่ต่อเนื่องหนึ่งด้าน (กรณี 2): ทิศนั้นมี M− ที่ขอบไม่ต่อเนื่องด้วย', () => {
    const m = twoWayMoments({ ...base, edgeX1: 'simple' }, w, 'x');
    expect(m.pos).toBeCloseTo(0.041 * (w / 100) * 400 * 400, 6);
    expect(m.negEnd).toBeCloseTo(0.027 * (w / 100) * 400 * 400, 6);
    expect(m.negInt).toBeCloseTo(0.055 * (w / 100) * 400 * 400, 6);
  });

  it('เทียบค่าระหว่าง m เชิงเส้น และ m < 0.5 ใช้ค่าที่ 0.5', () => {
    const pos1 = [0.025, 0.030, 0.036, 0.041, 0.047, 0.062];
    expect(method2Interp(pos1, 0.85)).toBeCloseTo(0.033, 10);
    expect(method2Interp(pos1, 1)).toBe(0.025);
    expect(method2Interp(pos1, 0.4)).toBeCloseTo(0.062, 10);
  });

  it('น้ำหนักลงคาน: คานด้านสั้น w·S/3, คานด้านยาว w·S/3·(3 − m²)/2', () => {
    const loads = slabLoads(base, 12);
    const dims = { lx: 400, ly: 500, t: 12 };
    expect(beamReaction(loads, dims, 'y')).toBeCloseTo((w * 4) / 3, 6);
    expect(beamReaction(loads, dims, 'x')).toBeCloseTo(((w * 4) / 3) * (3 - 0.64) / 2, 6);
  });

  it('พื้นทางเดียวไม่ใช้ตาราง — แถบทิศ x รับทั้งหมด', () => {
    const loads = slabLoads(oneWay, 12);
    expect(loads.twoWay).toBeNull();
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
  it('เหล็กกลม fy = 2,400 → ρ = 0.0025 (วสท.)', () => expect(asMinRatio(2400)).toBeCloseTo(0.0025, 10));
  it('เหล็กข้ออ้อย fy = 3,000 → ρ = 0.0020', () => expect(asMinRatio(3000)).toBeCloseTo(0.002, 10));
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
    expect(a.loads.twoWay).toEqual({ m: 0.8, caseNo: 1 });
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

  it('พื้นทางเดียว น้ำหนักจรเกิน 3 เท่าของน้ำหนักคงที่ → เตือนว่าสัมประสิทธิ์ใช้ไม่ได้', () => {
    const heavy = { ...oneWay, LL: 4000, thicknessMode: 'manual' as const, t: 20 };
    const a = analyzeSlab(heavy, slabDims(heavy), autoSlabLayout(heavy, slabDims(heavy)));
    const check = a.checks.find((c) => c.label.includes('เงื่อนไขใช้สัมประสิทธิ์'));
    expect(check?.status).toBe('warn');
  });

  it('พื้นสองทางใช้ตารางวิธีที่ 2 — ไม่มีเงื่อนไข LL ≤ 3DL', () => {
    const heavy = { ...base, LL: 4000, thicknessMode: 'manual' as const, t: 20 };
    const a = analyzeSlab(heavy, slabDims(heavy), autoSlabLayout(heavy, slabDims(heavy)));
    expect(a.checks.find((c) => c.label.includes('เงื่อนไขใช้สัมประสิทธิ์'))).toBeUndefined();
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

describe('พื้นวางบนดิน — แบบขยายพื้น GS', () => {
  // ที่พักอาศัยตามแบบ: หนา 0.10 ตะแกรง RB6 (SR24) แผ่นระหว่างคาน 4 × 5 ม.
  const gs: SlabInput = {
    ...base, slabName: 'GS', slabType: 'onGround', cover: 7.5, usage: 'light', tempBar: 'RB6', fy: 2400,
    finishDL: 100, LL: 200, qa: 2,
  };
  const run = (input: SlabInput) => {
    const dims = slabDims(input);
    const layout = autoSlabLayout(input, dims);
    return { dims, layout, a: analyzeSlab(input, dims, layout) };
  };

  it('As = F·L·W/(2fs) (คำนวณมือ)', () => {
    // F 1.5, L 5 ม., W = 240 + 100 = 340 กก./ตร.ม., fs = 0.5 × 2,400 = 1,200 ksc → 1.5×5×340/2,400 = 1.0625 ซม.²/ม.
    expect(subgradeDragAs(1.5, 500, 340, 1200)).toBeCloseTo(1.0625, 10);
    const g = groundSlab(gs, slabLoads(gs, 10), 1200);
    expect(g.W).toBeCloseTo(340, 10);
    expect(g.AsReq.x).toBeCloseTo((1.5 * 4 * 340) / 2400, 10);
    expect(g.AsReq.y).toBeCloseTo((1.5 * 5 * 340) / 2400, 10);
  });

  it('แรงดันใต้พื้นและน้ำหนักจรที่รับได้ (คำนวณมือ)', () => {
    // q = (240 + 100 + 200)/1,000 = 0.54 t/m², รับจรได้ = 2,000 − 340 = 1,660 กก./ตร.ม.
    const g = groundSlab(gs, slabLoads(gs, 10), 1200);
    expect(g.q).toBeCloseTo(0.54, 10);
    expect(g.liveCapacity).toBeCloseTo(1660, 10);
  });

  it('ค่าตามแบบได้ หนา 0.10 ตะแกรง RB6 @ 0.25 # และผ่านทุกข้อ', () => {
    const { dims, layout, a } = run(gs);
    expect(dims.t).toBe(10);
    expect(layout.bottom.x).toEqual({ size: 'RB6', spacing: 25 });
    expect(layout.bottom.y).toEqual(layout.bottom.x);
    expect(layout.top).toEqual({ x: null, y: null });
    expect(a.status).toBe('ok');
    expect(a.ground).not.toBeNull();
  });

  it('รายการตรวจสอบมีสามเรื่อง: ความหนา เหล็กเสริม การรับน้ำหนัก — ไม่มีดัดและเฉือน', () => {
    const groups = new Set(run(gs).a.checks.map((c) => c.group));
    expect([...groups]).toEqual(['thickness', 'reinforcement', 'capacity']);
  });

  it('แผ่นยาวขึ้น → ตะแกรงถี่ขึ้น ทั้งสองทิศเท่ากัน', () => {
    const { layout, a } = run({ ...gs, lx: 800, ly: 900 });
    expect(layout.bottom.x!.spacing).toBeLessThan(25);
    expect(layout.bottom.y).toEqual(layout.bottom.x);
    expect(a.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });

  it('ตะแกรงไม่ห่างกว่า 0.25 ม. ตามแบบ แม้ As ที่ต้องการน้อย', () => {
    const { layout } = run({ ...gs, lx: 200, ly: 200 });
    expect(layout.bottom.x!.spacing).toBe(25);
  });

  it('แรงดันใต้พื้นเกิน qa → ไม่ผ่าน', () => {
    const { a } = run({ ...gs, LL: 3000, qa: 2 });
    const bearing = a.checks.find((c) => c.group === 'capacity' && c.label.includes('แรงดันใต้พื้น'));
    expect(bearing?.status).toBe('fail');
    expect(a.status).toBe('fail');
  });

  it('ตะแกรงห่างเกินไปที่แก้เอง → As ไม่พอ', () => {
    const dims = slabDims(gs);
    const layout = setMesh(autoSlabLayout(gs, dims), { spacing: 45 });
    const a = analyzeSlab(gs, dims, layout);
    expect(a.checks.filter((c) => c.status === 'fail').length).toBeGreaterThan(0);
  });

  it('ที่พักอาศัยไม่มีคำเตือนล้อรถ ส่วนที่จอดรถมี', () => {
    expect(run(gs).a.checks.some((c) => c.label.includes('ล้อรถ'))).toBe(false);
    expect(run({ ...gs, usage: 'medium' }).a.checks.some((c) => c.label.includes('ล้อรถ') && c.status === 'warn')).toBe(true);
  });

  it('แก้ตะแกรงทีเดียวได้ทั้งสองทิศ', () => {
    const layout = setMesh(autoSlabLayout(gs, slabDims(gs)), { size: 'RB9', spacing: 20 });
    expect(layout.bottom.x).toEqual({ size: 'RB9', spacing: 20 });
    expect(layout.bottom.y).toEqual({ size: 'RB9', spacing: 20 });
  });
});

describe('แบบขยายพื้น S1 — คอม้าเว้นเส้น + เสริมพิเศษ', () => {
  // แบบตามรูป: พื้นสองทาง 3 × 3 ม. หนา 0.10 เหล็กกลม SR24 Covering 3.0 cm.
  const s1: SlabInput = {
    ...base, lx: 300, ly: 300, cover: 3, fy: 2400, bar: 'RB9', tempBar: 'RB6', finishDL: 100, LL: 200,
  };
  const oneWayS1: SlabInput = { ...s1, slabType: 'oneWay', lx: 300, ly: 600, edgeX1: 'simple', edgeX2: 'continuous' };
  const run = (input: SlabInput) => {
    const dims = slabDims(input);
    const layout = autoSlabLayout(input, dims);
    return { dims, layout, a: analyzeSlab(input, dims, layout) };
  };
  const rb9 = REBARS.RB9.area;

  it('เหล็กบนที่ขอบ = คอม้าครึ่งชุด + เสริมพิเศษ (คำนวณมือ)', () => {
    // RB9 @0.25 งอขึ้นเว้นเส้น → @0.50 = 2 × 0.636 = 1.272, เสริมพิเศษ RB9 @0.50 = 1.272 → รวม 2.545 ซม.²/ม.
    const layout = {
      bottom: { x: { size: 'RB9' as const, spacing: 25 }, y: null },
      top: { x: { size: 'RB9' as const, spacing: 50 }, y: null },
      outerLayer: { bottom: 'x' as const, top: 'x' as const },
    };
    expect(topAtSupport(layout, 'x')).toBeCloseTo(4 * rb9, 10);
    // คอม้า @0.50 สลับเสริมพิเศษ @0.50 → เหล็กบนเฉลี่ยห่าง 0.25
    expect(topSpacingAtSupport(layout, 'x')).toBeCloseTo(25, 10);
    expect(topSpacingAtSupport({ ...layout, bottom: { x: null, y: null }, top: { x: null, y: null } }, 'x')).toBeNull();
  });

  it('ค่าตามแบบ: หนา 0.10 คอม้า RB9 @0.25 เสริมพิเศษ RB9 @0.50 และผ่านทุกข้อ', () => {
    const { dims, layout, a } = run(s1);
    expect(dims.t).toBe(10);
    expect(layout.bottom.x).toEqual({ size: 'RB9', spacing: 25 });
    expect(layout.top.x).toEqual({ size: 'RB9', spacing: 50 });
    expect(a.status).toBe('ok');
    expect(a.detail).toMatchObject({ dir: 'x', cross: 'y', L: 300, cutoff: 75, bend: 60 });
  });

  it('เสริมพิเศษขนาดเดียวกับคอม้า ระยะเรียง 2 เท่า — เหล็กบนที่ขอบเท่าเหล็กล่าง', () => {
    for (const input of [s1, base, oneWayS1]) {
      const { layout } = run(input);
      const dir = detailDir(input);
      expect(layout.top[dir]!.size).toBe(layout.bottom[dir]!.size);
      expect(layout.top[dir]!.spacing).toBeCloseTo(2 * layout.bottom[dir]!.spacing, 10);
      expect(topAtSupport(layout, dir)).toBeCloseTo((100 / layout.bottom[dir]!.spacing) * REBARS[layout.bottom[dir]!.size].area, 8);
    }
  });

  it('พื้นสองทาง: คอม้าทั้งสองทิศ ใช้เสริมพิเศษชุดเดียวกัน ทิศช่วงสั้นอยู่ชั้นนอก', () => {
    const tall = { ...s1, lx: 400, ly: 300 };
    const { layout, a } = run(tall);
    expect(crankDirs(tall)).toEqual(['x', 'y']);
    expect(a.detail!.dir).toBe('y');
    expect(layout.outerLayer).toEqual({ bottom: 'y', top: 'y' });
    expect(layout.top.x).toEqual(layout.top.y);
    expect(a.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });

  it('พื้นทางเดียว: ทิศ Y เป็นเหล็กกันร้าว ρ·b·t ไม่มีเหล็กบน', () => {
    const { dims, layout, a } = run(oneWayS1);
    expect(crankDirs(oneWayS1)).toEqual(['x']);
    expect(layout.top.y).toBeNull();
    expect(layout.bottom.y!.size).toBe('RB6');
    expect(a.y.bottom.AsReq).toBeCloseTo(asMinRatio(2400) * 100 * dims.t, 8);
    expect(a.checks.some((c) => c.label.startsWith('As ทิศ Y — เหล็กกันร้าว'))).toBe(true);
  });

  it('รายการตรวจบอกชุดเหล็กตามแบบ และตรวจระยะเรียงเฉลี่ยของเหล็กบน', () => {
    const labels = run(s1).a.checks.map((c) => c.label);
    expect(labels).toContain('As+ ทิศ X กลางช่วง — คอม้าเว้นเส้น (ซม.²/ม.)');
    expect(labels).toContain('As− ทิศ X ที่ขอบ = คอม้า/2 + เสริมพิเศษ (ซม.²/ม.)');
    expect(labels).toContain('ระยะเรียงเหล็กทิศ X ผิวบนที่ขอบ (เฉลี่ย) (ซม.)');
  });

  it('ขอบยึดหมุนทั้งสองด้าน ไม่มีโมเมนต์ลบ → ไม่ตรวจ As− (เสริมตามแบบ)', () => {
    const { a } = run({ ...oneWayS1, edgeX2: 'simple' });
    expect(a.checks.some((c) => c.label.startsWith('As− '))).toBe(false);
  });

  it('เสริมพิเศษห่างเกินไปที่แก้เอง → As− ที่ขอบไม่พอ', () => {
    const { dims, layout } = run(s1);
    const sparse = setExtra(layout, crankDirs(s1), { spacing: 90 });
    const a = analyzeSlab(s1, dims, sparse);
    const check = a.checks.find((c) => c.label.startsWith('As− ทิศ X'));
    expect(check?.status).toBe('fail');
  });

  it('ขั้นตอนคำนวณบอกระยะ L/4 และ L/5 จากช่วงสั้น', () => {
    const step = run(s1).a.steps.find((x) => x.label.startsWith('ระยะตัดเหล็ก'));
    expect(step?.value).toBe('L/4 = 0.75, L/5 = 0.60 ม.');
  });

  it('ความลึกเหล็กบนใช้เส้นที่ใหญ่กว่าของคอม้ากับเสริมพิเศษ', () => {
    const { dims, layout } = run(s1);
    const bigger = setExtra(layout, crankDirs(s1), { size: 'DB12' });
    const a = analyzeSlab(s1, dims, bigger);
    expect(a.x.top.d).toBeCloseTo(dims.t - s1.cover - REBARS.DB12.dia / 2, 8);
    expect(a.x.bottom.d).toBeCloseTo(dims.t - s1.cover - REBARS.RB9.dia / 2, 8);
  });

  it('slabDetail ใช้ช่วงสั้นเป็น L', () => {
    expect(slabDetail({ ...s1, lx: 500, ly: 400 }, { lx: 500, ly: 400 }).L).toBe(400);
    expect(slabDetail(oneWayS1, oneWayS1).L).toBe(300);
  });
});

describe('แก้ระยะเรียงจากรูป', () => {
  const layout = autoSlabLayout(base, slabDims(base));

  it('กรอกระยะนอกโมดูล 2.5 ซม. ได้ (0.165 ตามแบบ) ปัดทีละ 0.5 ซม.', () => {
    expect(clampSpacing(16.5)).toBe(16.5);
    expect(clampSpacing(16.4)).toBe(16.5);
    expect(clampSpacing(60)).toBe(45);
    expect(setRun(layout, 'bottom', 'y', { spacing: 16.5 }).bottom.y!.spacing).toBe(16.5);
  });

  it('ปุ่ม −/+ เลื่อนไปค่าถัดไปบนโมดูล 2.5 ซม.', () => {
    expect(stepSpacing(16.5, true)).toBe(17.5);
    expect(stepSpacing(16.5, false)).toBe(15);
    expect(stepSpacing(20, true)).toBe(22.5);
    expect(stepSpacing(20, false)).toBe(17.5);
  });

  it('เสริมพิเศษห่างได้ถึง 0.90 ม. และแก้พร้อมกันทุกทิศที่มีคอม้า', () => {
    const next = setExtra(layout, ['x', 'y'], { size: 'DB10', spacing: 50 });
    expect(next.top.x).toEqual({ size: 'DB10', spacing: 50 });
    expect(next.top.y).toEqual({ size: 'DB10', spacing: 50 });
    expect(setExtra(layout, ['x', 'y'], { spacing: 120 }).top.x!.spacing).toBe(90);
  });

  it('เพิ่มเสริมพิเศษกลับเข้ามาจากค่าที่คำนวณได้', () => {
    const empty = { ...layout, top: { x: null, y: null } };
    expect(setExtra(empty, ['x'], {})).toBe(empty);
    expect(setExtra(empty, ['x'], {}, { size: 'RB9', spacing: 40 }).top).toEqual({ x: { size: 'RB9', spacing: 40 }, y: null });
  });
});
