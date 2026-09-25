import { describe, expect, it } from 'vitest';
import { REBARS } from '../rebar';
import { analyzeColumn } from './analyzeColumn';
import { autoColumnLayout, buildRectLayout } from './designColumn';
import { columnGeometry, supportedInterior } from './geometry';
import { interactionCurve, momentCapacityAt, rayUtilization } from './interaction';
import { removeColumnBar, addColumnBar } from './layoutOps';
import { axisSlenderness } from './slenderness';
import { spiralRequirement, tieRequirement } from './transverse';
import type { ColumnInput } from './types';

const base: ColumnInput = {
  columnName: 'C1',
  shape: 'rect', b: 30, h: 30, D: 40, cover: 3,
  Lu: 3,
  fc: 240, fy: 4000, fyv: 2400,
  P: 20000, Mx: 1000, My: 0,
  mainBar: 'DB16', tieBar: 'RB9',
};

describe('เส้นกำลังยอมให้ วสท. (คำนวณมือ)', () => {
  // เสา 20×20, 4-DB12 ที่ ±6.3 ซม. (covering 2.5 + ปลอก RB6 + ครึ่งเหล็ก), f′c 240, fy 4,000
  const A = REBARS.DB12.area;
  const bars = [
    { y: 6.3, area: 2 * A },
    { y: -6.3, area: 2 * A },
  ];
  const shape = { kind: 'rect' as const, width: 20, depth: 20 };
  const curve = interactionCurve(shape, bars, 240, 4000, false);
  const rho = (4 * A) / 400;
  const m = 4000 / (0.85 * 240);

  it('แรงอัดตามแนวแกน Pa = 0.85Ag(0.25f′c + 0.4fy·ρg) = 26.55 ตัน', () => {
    expect(curve.fsa).toBe(1600);
    expect(curve.Pa).toBeCloseTo(0.85 * (0.25 * 240 * 400 + 1600 * 4 * A), 6);
    expect(curve.Pa).toBeCloseTo(26552, -1);
    expect(rayUtilization(curve, 0, curve.Pmax)).toBeCloseTo(1, 6);
  });

  it('fs ในสูตรแรงอัดไม่เกิน 2,100 ksc', () => {
    expect(interactionCurve(shape, bars, 240, 6000, false).fsa).toBe(2100);
  });

  it('Fa, S, eb, Nb, Mo', () => {
    expect(curve.Fa).toBeCloseTo(0.34 * (1 + rho * m) * 240, 6);
    const n = 2.04e6 / (15100 * Math.sqrt(240));
    expect(curve.S).toBeCloseTo((20 ** 4 / 12 + (2 * n - 1) * 4 * A * 6.3 ** 2) / 10, 6);
    expect(curve.eb).toBeCloseTo((0.67 * rho * m + 0.17) * 16.3, 6);
    expect(curve.Nb).toBeCloseTo(1 / (1 / (400 * curve.Fa) + curve.eb / (curve.S * 0.45 * 240)), 6);
    expect(curve.Nb).toBeCloseTo(18315, -1);
    expect(curve.Mo).toBeCloseTo(0.4 * 2 * A * 4000 * 12.6, 6);
  });

  it('เส้นต่อเนื่อง: (0, Mo) → (Nb, Mb) → อัดควบคุม → (Pa, 0)', () => {
    expect(momentCapacityAt(curve, 0)).toBeCloseTo(curve.Mo, 6);
    expect(momentCapacityAt(curve, curve.Nb)).toBeCloseTo(curve.Mb, 6);
    // ช่วงอัดควบคุม fa/Fa + fb/Fb = 1
    const P = (curve.Nb + curve.Pa) / 2;
    const M = momentCapacityAt(curve, P);
    expect(P / (400 * curve.Fa) + M / curve.S / curve.Fb).toBeCloseTo(1, 6);
  });

  it('ที่ Pa เส้นอัดควบคุมให้ e ใกล้ 0.1t — ต่อเนื่องกับสูตรแรงอัดตามแนวแกน', () => {
    const e = momentCapacityAt(curve, curve.Pa) / curve.Pa;
    expect(e).toBeGreaterThan(1.5);
    expect(e).toBeLessThan(2.5);
  });
});

describe('ความชะลูด — ตัวคูณลดกำลังเสายาว R (คำนวณมือ)', () => {
  it('30×30, Lu 3 ม.: Lu/r = 33.3 ≤ 53.3 → เสาสั้น R = 1', () => {
    const s = axisSlenderness(base, 'x', 30);
    expect(s.ratio).toBeCloseTo(33.33, 1);
    expect(s.limit).toBeCloseTo(53.33, 1);
    expect(s.slender).toBe(false);
    expect(s.R).toBe(1);
  });
  it('20×20, Lu 4 ม.: Lu/r = 66.7 → R = 1.32 − 0.4 = 0.92', () => {
    const s = axisSlenderness({ ...base, b: 20, h: 20, Lu: 4 }, 'x', 20);
    expect(s.ratio).toBeCloseTo(66.67, 1);
    expect(s.slender).toBe(true);
    expect(s.R).toBeCloseTo(0.92, 6);
  });
  it('R คูณเส้นกำลังทั้งเส้น → อัตราส่วนใช้งานหารด้วย R', () => {
    const input: ColumnInput = { ...base, b: 20, h: 20, Lu: 4, P: 10000, Mx: 500 };
    const layout = buildRectLayout(4, input, { size: 'RB6', spacing: 15 });
    const long = analyzeColumn(input, layout);
    const short = analyzeColumn({ ...input, Lu: 1 }, layout);
    expect(long.R).toBeCloseTo(0.92, 6);
    expect(long.curveX.Pmax).toBeCloseTo(0.92 * short.curveX.Pmax, 6);
    expect(long.utilization).toBeCloseTo(short.utilization / 0.92, 4);
  });
  it('บ้านพักอาศัย 20×20, 4-DB12, Lu 3 ม., P 20 ตัน ไม่มีโมเมนต์ → ผ่าน', () => {
    const input: ColumnInput = { ...base, b: 20, h: 20, cover: 2.5, Lu: 3, P: 20000, Mx: 0, My: 0, mainBar: 'DB12' };
    const a = analyzeColumn(input, buildRectLayout(4, input, { size: 'RB6', spacing: 15 }));
    expect(a.R).toBe(1);
    expect(a.method).toBe('axial');
    expect(a.utilization).toBeCloseTo(20000 / a.curveX.Pmax, 6);
    expect(a.checks.filter((c) => c.status !== 'ok')).toEqual([]);
  });
});

describe('เหล็กปลอก', () => {
  it('ปลอกเกลียว D40: ρs,min = 0.01728, pitch 4.0 ซม.', () => {
    const r = spiralRequirement({ ...base, shape: 'circle', D: 40 }, 'RB9');
    expect(r.rhoMin).toBeCloseTo(0.017284, 5);
    expect(r.pitchMaxStrength).toBeCloseTo(4.33, 2);
    expect(r.spacing).toBe(4);
  });
  it('บ้านพักอาศัย 20×20, 4-DB12: ปลอก RB6@15 ผ่าน และออกแบบอัตโนมัติไม่เปลี่ยนเป็น RB9', () => {
    const input: ColumnInput = { ...base, b: 20, h: 20, cover: 2.5, P: 8000, Mx: 300, mainBar: 'DB12', tieBar: 'RB6' };
    // s max = min(16·1.2, 48·0.6, 20) = 19.2 ซม.
    const layout = buildRectLayout(4, input, { size: 'RB6', spacing: 15 });
    expect(tieRequirement(input, columnGeometry(input, layout), 'RB6').sMax).toBeCloseTo(19.2, 6);
    const a = analyzeColumn(input, layout);
    expect(a.checks.filter((c) => c.group === 'transverse' && c.status !== 'ok')).toEqual([]);
    expect(autoColumnLayout(input).tie).toEqual({ size: 'RB6', spacing: 17.5 });
  });
  it('เสากลมที่เลือก RB6: ออกแบบอัตโนมัติใช้ปลอกเกลียว RB9 (Ø ≥ 9 มม.)', () => {
    const input: ColumnInput = { ...base, shape: 'circle', D: 40, tieBar: 'RB6' };
    const layout = autoColumnLayout(input);
    expect(layout.tie.size).toBe('RB9');
    expect(analyzeColumn(input, layout).checks.filter((c) => c.group === 'transverse' && c.status !== 'ok')).toEqual([]);
  });
  it('เหล็กถ่าง: ช่องว่าง ≤ 15 ซม. ไม่ต้องยึด, > 15 ซม. ต้องยึด', () => {
    expect(supportedInterior([-10, 0, 10], [2, 2, 2])).toEqual([]);
    expect(supportedInterior([-20, 0, 20], [2, 2, 2])).toEqual([1]);
  });
});

describe('ออกแบบอัตโนมัติ', () => {
  const noFail = (input: ColumnInput) => {
    const layout = autoColumnLayout(input);
    const a = analyzeColumn(input, layout);
    expect(a.checks.filter((c) => c.status === 'fail')).toEqual([]);
    return { layout, a };
  };

  it('เสาสี่เหลี่ยม แรงสองแกน (Mx/Mcx + My/Mcy)', () => {
    const { a } = noFail({ ...base, b: 40, h: 40, P: 60000, Mx: 3000, My: 2000 });
    expect(a.method).toBe('contour');
    expect(a.utilization).toBeLessThanOrEqual(1);
    expect(a.rho).toBeGreaterThanOrEqual(0.01);
  });

  it('เสากลมปลอกเกลียว', () => {
    const { layout, a } = noFail({ ...base, shape: 'circle', D: 40, P: 50000, Mx: 2000, My: 1500 });
    expect(layout.kind).toBe('circle');
    expect(a.method).toBe('resultant');
    expect(a.geom.bars.length).toBeGreaterThanOrEqual(6);
  });

  it('แรงเพิ่ม → เหล็กเพิ่ม', () => {
    const small = columnGeometry(base, autoColumnLayout({ ...base, P: 20000 })).Ast;
    const big = columnGeometry(base, autoColumnLayout({ ...base, b: 40, h: 40, P: 90000, Mx: 5000 })).Ast;
    expect(big).toBeGreaterThan(small);
  });

  it('เหล็กถ่างเกิดขึ้นเมื่อด้านยาวมีเหล็กกลางห่าง', () => {
    const input = { ...base, b: 60, h: 60 };
    const g = columnGeometry(input, buildRectLayout(12, input, { size: 'RB9', spacing: 15 }));
    expect(g.crossTies.length).toBeGreaterThan(0);
  });
});

describe('แก้ไขเหล็กเสา', () => {
  it('เพิ่ม/ลบแบบสมมาตร และเหล็กมุมลบไม่ได้', () => {
    const l0 = buildRectLayout(4, base, { size: 'RB9', spacing: 15 });
    if (l0.kind !== 'rect') throw new Error();
    const l1 = addColumnBar(l0, 'top', 'DB20');
    if (l1.kind !== 'rect') throw new Error();
    expect(l1.top.length).toBe(1);
    expect(l1.bottom.length).toBe(1);
    const l2 = removeColumnBar(l1, l1.top[0].id);
    if (l2.kind !== 'rect') throw new Error();
    expect(l2.top.length + l2.bottom.length).toBe(0);
    expect(removeColumnBar(l2, l2.corners[0].id)).toBe(l2);
  });
});
