import { describe, expect, it } from 'vitest';
import { REBARS } from '../rebar';
import { analyzeColumn } from './analyzeColumn';
import { autoColumnLayout, buildRectLayout } from './designColumn';
import { columnGeometry, supportedInterior } from './geometry';
import { interactionCurve, nominalPoint, rayUtilization } from './interaction';
import { removeColumnBar, addColumnBar } from './layoutOps';
import { axisSlenderness } from './slenderness';
import { spiralRequirement } from './transverse';
import type { ColumnInput } from './types';

const base: ColumnInput = {
  projectName: 't', columnName: 'C1', designer: '',
  shape: 'rect', b: 30, h: 30, D: 40, cover: 3,
  Lu: 3,
  fc: 240, fy: 4000, fyv: 2400,
  P: 20000, Mx: 1000, My: 0,
  mainBar: 'DB16', tieBar: 'RB9',
};

describe('interaction diagram (คำนวณมือ)', () => {
  const As = 2 * REBARS.DB20.area;
  const bars = [
    { y: 19, area: As },
    { y: -19, area: As },
  ];
  const shape = { kind: 'rect' as const, width: 30, depth: 50 };

  it('จุด balanced c = 26.61 ซม.', () => {
    const p = nominalPoint(shape, bars, 240, 4000, 26.609);
    expect(p.Pn).toBeCloseTo(137140, -2);
    expect(p.Mn).toBeCloseTo(2825800, -4);
  });

  it('c → ∞ ได้ Po', () => {
    const Po = 0.85 * 240 * (1500 - 2 * As) + 4000 * 2 * As;
    expect(nominalPoint(shape, bars, 240, 4000, 5000).Pn).toBeCloseTo(Po, -2);
  });

  it('แรงอัดล้วนเท่ากับ 0.4·φ·0.8Po → อัตราส่วนใช้งาน 1', () => {
    const curve = interactionCurve(shape, bars, 240, 4000, false);
    const Po = 0.85 * 240 * (1500 - 2 * As) + 4000 * 2 * As;
    expect(curve.Pmax).toBeCloseTo(0.4 * 0.7 * 0.8 * Po, 3);
    expect(rayUtilization(curve, 0, curve.Pmax)).toBeCloseTo(1, 6);
    expect(rayUtilization(curve, 0, curve.Pmax / 2)).toBeCloseTo(0.5, 6);
  });
});

describe('ความชะลูด (คำนวณมือ)', () => {
  it('30×30, Lu 3 ม., ค้ำยัน, M1/M2 = 1 → เสายาว δ = 1.198', () => {
    const s = axisSlenderness(base, 'x', 30 ** 4 / 12, 30, 0.7);
    expect(s.ratio).toBeCloseTo(33.33, 1);
    expect(s.limit).toBe(22);
    expect(s.slender).toBe(true);
    expect(s.Pc).toBeCloseTo(432896, -2);
    expect(s.delta).toBeCloseTo(1.1976, 3);
    expect(s.Mdesign).toBeCloseTo(1.1976 * 100000, -2);
  });
  it('Lu สั้น → ไม่ขยายโมเมนต์', () => {
    const s = axisSlenderness({ ...base, Lu: 1.5 }, 'x', 30 ** 4 / 12, 30, 0.7);
    expect(s.slender).toBe(false);
    expect(s.Mdesign).toBe(100000);
  });
});

describe('เหล็กปลอก', () => {
  it('ปลอกเกลียว D40: ρs,min = 0.01728, pitch 4.0 ซม.', () => {
    const r = spiralRequirement({ ...base, shape: 'circle', D: 40 }, 'RB9');
    expect(r.rhoMin).toBeCloseTo(0.017284, 5);
    expect(r.pitchMaxStrength).toBeCloseTo(4.33, 2);
    expect(r.spacing).toBe(4);
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

  it('เสาสี่เหลี่ยม แรงสองแกน (Bresler หรือ contour)', () => {
    const { a } = noFail({ ...base, b: 40, h: 40, P: 60000, Mx: 3000, My: 2000 });
    expect(['bresler', 'contour']).toContain(a.method);
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
