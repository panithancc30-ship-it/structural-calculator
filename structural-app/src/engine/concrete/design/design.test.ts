import { describe, expect, it } from 'vitest';
import type { BeamInput } from '../types';
import { REBARS } from '../rebar';
import { faceArea, makeLayer, removeBar, setBarSize } from '../layoutOps';
import { computeGeometry } from './barLayout';
import { analyzeBeam, autoLayoutDetailed, designBeam } from './designBeam';
import { designFlexure, wsdParams } from './flexure';
import { analyzeStresses } from './sectionCheck';
import { shearTorsionDemand } from './shearTorsion';
import { stirrupSpacing } from './stirrupConfig';

const base: BeamInput = {
  b: 25, h: 50, L: 5, cover: 3,
  fc: 240, fy: 4000, fyv: 2400,
  M: 8000, V: 6000, T: 500,
  mainBar: 'DB16', stirrupBar: 'RB9', stirrupMode: 'auto', sMin: 10, support: 'bothEnds',
};

describe('หน่วยแรงยอมให้ (คำนวณมือ)', () => {
  const p = wsdParams(240, 4000, 2400);
  it('n, fc, fs, k, j, R', () => {
    expect(p.n).toBe(9);
    expect(p.fcAllow).toBeCloseTo(108, 6);
    expect(p.fsAllow).toBe(1700);
    expect(p.fvAllow).toBe(1200);
    expect(p.k).toBeCloseTo(0.36377, 4);
    expect(p.j).toBeCloseTo(0.87874, 4);
    expect(p.R).toBeCloseTo(17.262, 2);
  });
});

describe('ดัด', () => {
  const p = wsdParams(240, 4000, 2400);
  it('หน้าตัดเสริมเหล็กรับดึงอย่างเดียว d = 45.3', () => {
    const f = designFlexure(p, 25, 45.3, 5.1, 800000);
    expect(f.Mc).toBeCloseTo(885573, -2);
    expect(f.doubly).toBe(false);
    expect(f.AsFlex).toBeCloseTo(11.822, 2);
    expect(f.AsPrimeReq).toBe(0);
  });
  it('M > Mc → เสริมเหล็กรับอัด', () => {
    const f = designFlexure(p, 25, 45.3, 5.1, 1500000);
    expect(f.doubly).toBe(true);
    const M2 = 1500000 - f.Mc;
    expect(f.As2).toBeCloseTo(M2 / (1700 * (45.3 - 5.1)), 6);
    expect(f.fsPrime).toBeGreaterThan(0);
    expect(f.fsPrime).toBeLessThanOrEqual(1700);
    expect(f.AsPrimeReq).toBeCloseTo(M2 / (f.fsPrime * (45.3 - 5.1)), 6);
  });
});

describe('เฉือน + บิด (คำนวณมือ d = 43.543)', () => {
  const p = wsdParams(240, 4000, 2400);
  const dm = shearTorsionDemand(base, p, 43.543, 0.9);
  it('หน่วยแรง', () => {
    expect(dm.v).toBeCloseTo(5.512, 2);
    expect(dm.vt).toBeCloseTo(4.8, 6);
    expect(dm.torsionNeglected).toBe(false);
    expect(dm.vc).toBeCloseTo(3.636, 2);
    expect(dm.vtc).toBeCloseTo(3.185, 2);
    expect(dm.alphaT).toBeCloseTo(1.4458, 3);
  });
  it('เหล็กปลอก + Al', () => {
    expect(dm.avs).toBeCloseTo(0.03908, 3);
    expect(dm.ats).toBeCloseTo(0.012433, 4);
    expect(dm.sMax).toBeCloseTo(15.3, 6);
    const cap = stirrupSpacing(dm, 'RB9', 1);
    expect(cap.sStrength).toBeCloseTo(19.89, 1);
    expect(cap.spacing).toBe(15);
    expect(dm.AlMin).toBeCloseTo(2.754, 1);
    expect(dm.Al).toBeCloseTo(dm.AlMin, 6);
  });
  it('แรงบิดน้อย → ละเลยได้', () => {
    const d2 = shearTorsionDemand({ ...base, T: 100 }, p, 43.5, 0.9);
    expect(d2.torsionNeglected).toBe(true);
    expect(d2.ats).toBe(0);
    expect(d2.Al).toBe(0);
    expect(d2.vc).toBeCloseTo(0.29 * Math.sqrt(240), 6);
  });
});

describe('เฉือนสูงสุด วสท.', () => {
  it('v ≤ 1.32√f′c — เกินต้องขยายหน้าตัด', () => {
    const p = wsdParams(240, 4000, 2400);
    const vMax = 1.32 * Math.sqrt(240);
    const ok = shearTorsionDemand({ ...base, T: 0, V: 0.99 * vMax * 25 * 43.5 }, p, 43.5, 0.9);
    expect(ok.vMax).toBeCloseTo(vMax, 8);
    expect(ok.shearSectionOk).toBe(true);
    const over = shearTorsionDemand({ ...base, T: 0, V: 1.01 * vMax * 25 * 43.5 }, p, 43.5, 0.9);
    expect(over.shearSectionOk).toBe(false);
  });
});

describe('ออกแบบอัตโนมัติ', () => {
  it('ตัวอย่างพื้นฐาน: ผ่านทุกข้อ, เหล็กล่าง 2 ชั้น, ปลอก RB9 @ 0.15', () => {
    const layouts = designBeam(base);
    const r = analyzeBeam(base, layouts);
    expect(layouts.A.bottom.length).toBe(2);
    expect(layouts.A.bottom.reduce((s, l) => s + l.bars.length, 0)).toBe(7);
    expect(layouts.A.stirrup).toEqual({ size: 'RB9', count: 1, spacing: 15 });
    for (const sec of [r.A, r.B]) {
      const failed = sec.checks.filter((c) => c.status === 'fail');
      expect(failed, JSON.stringify(failed)).toEqual([]);
    }
  });

  it('M ใหญ่กว่า Mc → doubly และผ่าน', () => {
    const input = { ...base, b: 30, h: 50, M: 16000, T: 0 };
    const layouts = designBeam(input);
    const r = analyzeBeam(input, layouts);
    expect(r.A.flex.doubly).toBe(true);
    expect(r.A.checks.filter((c) => c.status === 'fail')).toEqual([]);
    expect(r.B.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });

  it('V สูง → 1 ปลอกได้ s < 10 ซม. จึงเลือก 2 ปลอก และเหล็กชั้นแรก ≥ 4 เส้น', () => {
    const input = { ...base, b: 40, h: 60, M: 6000, V: 22000, T: 0 };
    const { layout, stirrup } = autoLayoutDetailed(input, 'A');
    expect(stirrup.spec.count).toBe(2);
    expect(layout.stirrup.spacing).toBeGreaterThanOrEqual(10);
    expect(layout.top[0].bars.length).toBeGreaterThanOrEqual(4);
    expect(layout.bottom[0].bars.length).toBeGreaterThanOrEqual(4);
    const geom = computeGeometry(input, layout);
    expect(geom.inner).not.toBeNull();
    expect(geom.innerAnchorsOk).toBe(true);
    // เหล็กมุมปลอกในต้องอยู่ภายในปลอกใน
    const inner = geom.inner!;
    const top0 = geom.bars.filter((b) => b.face === 'top' && b.layer === 0).map((b) => b.x);
    expect(top0.some((x) => Math.abs(x - (inner.x + inner.r)) < 1e-6)).toBe(true);
    const r = analyzeBeam(input, { A: layout, B: autoLayoutDetailed(input, 'B').layout });
    expect(r.A.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });

  it('โหมดบังคับ 1 ปลอก ใช้ปลอกเดี่ยวเสมอ', () => {
    const input = { ...base, b: 40, h: 60, V: 22000, T: 0, stirrupMode: 'single' as const };
    expect(autoLayoutDetailed(input, 'A').layout.stirrup.count).toBe(1);
  });

  it('B-B เหล็กล่างต่อเนื่อง ≥ ¼ ของเหล็กล่าง A-A', () => {
    const layouts = designBeam({ ...base, T: 0, M: 12000, b: 30, h: 60 });
    expect(faceArea(layouts.B, 'bottom')).toBeGreaterThanOrEqual(0.25 * faceArea(layouts.A, 'bottom'));
  });
});

describe('แก้ไขเหล็กเองแล้วตรวจใหม่', () => {
  it('ลบเหล็กล่างจนไม่พอ → As ไม่ผ่าน', () => {
    const layouts = designBeam(base);
    let A = layouts.A;
    for (const layer of [...A.bottom]) for (const bar of layer.bars.slice(1)) A = removeBar(A, 'bottom', layer.id, bar.id);
    const r = analyzeBeam(base, { ...layouts, A });
    expect(r.A.checks.find((c) => c.label.startsWith('As รับดึง'))?.status).toBe('fail');
  });

  it('เปลี่ยนขนาดเหล็กทีละเส้นได้', () => {
    const A = designBeam(base).A;
    const layer = A.bottom[0];
    const next = setBarSize(A, 'bottom', layer.id, layer.bars[0].id, 'DB20');
    expect(next.bottom[0].bars[0].size).toBe('DB20');
    expect(next.bottom[0].bars[1].size).toBe('DB16');
    expect(faceArea(next, 'bottom') - faceArea(A, 'bottom')).toBeCloseTo(REBARS.DB20.area - REBARS.DB16.area, 6);
  });

  it('ระยะช่องว่างแคบเกิน → ไม่ผ่าน', () => {
    const A = { ...designBeam(base).A, bottom: [makeLayer(6, 'DB20')] };
    const r = analyzeBeam(base, { A, B: designBeam(base).B });
    expect(r.A.checks.some((c) => c.label.startsWith('ช่องว่าง') && c.status === 'fail')).toBe(true);
  });
});

describe('transformed section', () => {
  it('singly: kd ตรงกับสูตรปิด', () => {
    const b = 25, d = 45, As = 10, n = 9, M = 500000;
    const rho = As / (b * d);
    const k = Math.sqrt(2 * rho * n + (rho * n) ** 2) - rho * n;
    const r = analyzeStresses([{ area: As, y: d }], b, 50, n, M, d, null);
    expect(r.kd).toBeCloseTo(k * d, 4);
    const j = 1 - k / 3;
    expect(r.fs).toBeCloseTo(M / (As * j * d), 1);
    expect(r.fc).toBeCloseTo((2 * M) / (k * j * b * d * d), 2);
  });
});
