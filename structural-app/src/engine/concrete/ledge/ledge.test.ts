import { describe, expect, it } from 'vitest';
import { designFlexure, wsdParams } from '../design/flexure';
import { distributeAl, shearTorsionDemand } from '../design/shearTorsion';
import { stirrupSpacing } from '../design/stirrupConfig';
import type { BeamInput } from '../types';
import { analyzeLedgeBeam, designLedge } from './analyzeLedge';
import { ledgeLoads } from './loads';
import type { LedgeBeamInput } from './types';
import { validateLedgeInput } from './validate';

/**
 * ตัวอย่างที่ 4 ในเอกสาร RC-WSD บทที่ 4: คานรับพื้นยื่น 0.15 × 0.35 ม. ช่วง 4.00 ม.
 * พื้นยื่น 1.00 ม. หนา 10 ซม. น้ำหนักจร 100 กก./ตร.ม. ผนังบนคานสูง 0.50 ม. f′c 160 fy 3,000
 * ระยะหุ้ม 5.5 ซม. ทำให้ d = 35 − 5.5 − 0.9 − 0.6 = 28 ซม. ตรงกับตัวอย่าง
 */
const example4: LedgeBeamInput = {
  slabLength: 1,
  slabT: 10,
  finishDL: 0,
  LL: 100,
  tipWallH: 0,
  tipWallW: 180,
  beamWallH: 0.5,
  beamWallW: 180,
  otherLoad: 0,
  b: 15,
  h: 35,
  L: 4,
  support: 'simple',
  cover: 5.5,
  fc: 160,
  fy: 3000,
  fyv: 3000,
  mainBar: 'DB12',
  stirrupBar: 'RB9',
  stirrupMode: 'auto',
  sMin: 10,
};

describe('น้ำหนักลงคานและแรงภายใน — ตัวอย่างที่ 4', () => {
  const l = ledgeLoads(example4);
  it('น้ำหนักลงคาน 556 กก./ม. และแรงบิด 170 kg·m/m', () => {
    expect(l.slabTotal).toBeCloseTo(340, 6);
    expect(l.fromSlab).toBeCloseTo(340, 6);
    expect(l.beamWall).toBeCloseTo(90, 6);
    expect(l.beamSelf).toBeCloseTo(126, 6);
    expect(l.w).toBeCloseTo(556, 6);
    expect(l.torque).toBeCloseTo(170, 6);
  });
  it('M = wL²/8 = 1,112 kg·m ช่วงเดียวไม่มีโมเมนต์ลบ', () => {
    expect(l.Mpos).toBeCloseTo(1112, 6);
    expect(l.Mneg).toBe(0);
  });
  it('ที่หน้าตัดวิกฤต d = 28 ซม.: Vd = 956.32 kg, Td = 292.4 kg·m', () => {
    expect(l.dCrit).toBeCloseTo(28, 6);
    expect(l.Vd).toBeCloseTo(956.32, 2);
    expect(l.Td).toBeCloseTo(292.4, 6);
  });
});

describe('หน่วยแรงและเหล็กเสริม ว.ส.ท. — ตัวอย่างที่ 4', () => {
  const p = wsdParams(160, 3000, 3000);
  // ตัวอย่างใช้ x1 = 10, y1 = 30 ซม. (ศูนย์กลางปลอกห่างผิว 2.5 ซม.) → ระยะหุ้มถึงผิวปลอก 2.05 ซม.
  const sec: BeamInput = {
    b: 15, h: 35, L: 4, cover: 2.05, fc: 160, fy: 3000, fyv: 3000,
    M: 1112, V: 956.32, T: 292.4,
    mainBar: 'DB12', stirrupBar: 'RB9', stirrupMode: 'auto', sMin: 10, support: 'simple',
    torsionMethod: 'eit',
  };
  const dm = shearTorsionDemand(sec, p, 28, 0.9);

  it('vt = 3.5T/Σx²y = 12.99, v + vt = 15.26 ≤ 1.65√f′c = 20.87, vc = 3.66', () => {
    expect(dm.vt).toBeCloseTo(12.99, 1);
    expect(dm.v + dm.vt).toBeCloseTo(15.26, 1);
    expect(dm.vCombinedMax).toBeCloseTo(20.87, 2);
    expect(dm.combinedOk).toBe(true);
    expect(dm.vc).toBeCloseTo(3.66, 1);
    expect(dm.torsionNeglected).toBe(false);
    expect(dm.vExcess).toBe(0);
  });

  it('As ดัด 2.99 ซม.² + แรงบิด 1.31 ซม.² ต่อผิว → ล่าง 4.30, บน 1.31', () => {
    const flex = designFlexure(p, 15, 28, 5, 111200);
    expect(flex.AsFlex).toBeCloseTo(2.99, 2);
    const al = distributeAl(dm.Al, 35);
    expect(dm.Ac).toBeCloseTo(300, 6);
    expect(al.top).toBeCloseTo(1.31, 1);
    expect(flex.AsFlex + al.bottom).toBeCloseTo(4.3, 1);
  });

  it('ปลอก 9 มม. @ 0.125 ม. — ระยะตามกำลัง 19.6 ซม. แต่ไม่เกิน d/2', () => {
    const cap = stirrupSpacing(dm, 'RB9', 1);
    expect(cap.sStrength).toBeCloseTo(19.58, 1);
    expect(cap.sMax).toBe(14);
    expect(cap.spacing).toBe(12.5);
  });
});

describe('เฉือนอย่างเดียว ว.ส.ท. — ตัวอย่างที่ 1 และ 2', () => {
  const p = wsdParams(160, 2400, 2400);
  const shear = (V: number, d: number) =>
    shearTorsionDemand(
      {
        b: 20, h: d + 5, L: 5, cover: 3, fc: 160, fy: 2400, fyv: 2400, M: 0, V, T: 0,
        mainBar: 'DB12', stirrupBar: 'RB6', stirrupMode: 'auto', sMin: 10, support: 'simple',
        torsionMethod: 'eit',
      },
      p, d, 0.6,
    );

  it('ตัวอย่างที่ 1: Vc = 2,934.59, RB6 @ 0.15, RB9 @ 0.20 (คุมด้วย d/2)', () => {
    const dm = shear(4700, 40);
    expect(dm.vc * 20 * 40).toBeCloseTo(2934.59, 1);
    const rb6 = stirrupSpacing(dm, 'RB6', 1);
    expect(rb6.sStrength).toBeCloseTo(15.36, 0);
    expect(rb6.spacing).toBe(15);
    const rb9 = stirrupSpacing(dm, 'RB9', 1);
    expect(rb9.sStrength).toBeCloseTo(34.58, 0);
    expect(rb9.spacing).toBe(20);
  });

  it('ตัวอย่างที่ 2: V ที่ระยะ d = 7,866, Vc = 3,154.68 → RB9 @ 0.125', () => {
    const dm = shear(7866, 43);
    expect(dm.vc * 20 * 43).toBeCloseTo(3154.68, 1);
    expect(dm.sMax).toBeCloseTo(21.5, 6);
    expect(stirrupSpacing(dm, 'RB9', 1).spacing).toBe(12.5);
  });

  it('เหล็กปลอกขั้นต่ำ Av = 0.0015·b·s และ s ≤ d/4 เมื่อ v − vc > 0.795√f′c', () => {
    const light = shear(1000, 40);
    expect(light.avs).toBe(0);
    expect(stirrupSpacing(light, 'RB6', 1).sAreaMin).toBeCloseTo((2 * 0.2827) / (0.0015 * 20), 2);
    const heavy = shear(20 * 40 * (0.29 + 0.8) * Math.sqrt(160), 40);
    expect(heavy.sMax).toBe(10);
  });
});

describe('น้ำหนักจากผนังปลายพื้นยื่นและคานต่อเนื่อง', () => {
  it('ผนังที่ปลายเพิ่มแรงบิด P·Lc แต่ผนังบนคานไม่เพิ่ม', () => {
    const l = ledgeLoads({ ...example4, tipWallH: 1, slabLength: 1.5 });
    expect(l.tipWall).toBe(180);
    expect(l.torqueSlab).toBeCloseTo((340 * 1.5 * 1.5) / 2, 6);
    expect(l.torqueWall).toBeCloseTo(180 * 1.5, 6);
    expect(l.w).toBeCloseTo(340 * 1.5 + 180 + 90 + 126, 6);
  });

  it('ต่อเนื่องปลายเดียว M+ = wL²/14, M− = wL²/10, V = 1.15wL/2', () => {
    const l = ledgeLoads({ ...example4, support: 'oneEnd' });
    expect(l.Mpos).toBeCloseTo((556 * 16) / 14, 6);
    expect(l.Mneg).toBeCloseTo((556 * 16) / 10, 6);
    expect(l.Vsupport).toBeCloseTo(1.15 * 556 * 2, 6);
    expect(l.Tsupport).toBeCloseTo(170 * 2, 6);
  });
});

describe('ออกแบบคานรับพื้นยื่นทั้งหน้าตัด', () => {
  const input: LedgeBeamInput = { ...example4, cover: 2.5 };

  it('ตัวอย่างที่ 4 ออกแบบอัตโนมัติแล้วผ่าน — ปลอก RB9 @ 0.125 และเหล็กล่างรวมแรงบิด', () => {
    expect(validateLedgeInput(input)).toEqual([]);
    const layouts = designLedge(input);
    const r = analyzeLedgeBeam(input, layouts);
    const failed = r.checks.filter((c) => c.status === 'fail');
    expect(failed, JSON.stringify(failed)).toEqual([]);
    expect(layouts.A.stirrup).toEqual({ size: 'RB9', count: 1, spacing: 12.5 });
    // ล่างกลางคาน = As ดัด + Al/2, บนที่ปลาย = Al/2 (ช่วงเดียวไม่มีโมเมนต์ลบ จึงไม่ใช้ As,min)
    expect(r.A.req.AsTension).toBeCloseTo(r.A.flex.AsFlex + r.A.shear.Al / 2, 6);
    expect(r.B.flex.AsReq).toBe(0);
    expect(r.B.req.AsTension).toBeCloseTo(r.B.shear.Al / 2, 6);
    expect(r.status).not.toBe('fail');
  });

  it('แรงบิดสูงเกิน → vt ไม่ผ่าน ต้องขยายหน้าตัด', () => {
    const heavy: LedgeBeamInput = { ...input, slabLength: 2.5, tipWallH: 1.2, LL: 300 };
    const r = analyzeLedgeBeam(heavy, designLedge(heavy));
    expect(r.A.checks.find((c) => c.label === 'vt (ksc)')?.status).toBe('fail');
  });

  it('แรงบิดคุมระยะปลอก → โหมดอัตโนมัติคงปลอกเดี่ยว (ปลอกในไม่รับแรงบิด) และแนะนำขนาดใหญ่ขึ้น', () => {
    const torsion: LedgeBeamInput = {
      ...input, b: 20, h: 50, cover: 3, fc: 240, fy: 4000, fyv: 2400,
      slabLength: 1.2, finishDL: 120, LL: 150, tipWallH: 1, beamWallH: 0,
    };
    const layouts = designLedge(torsion);
    const r = analyzeLedgeBeam(torsion, layouts);
    expect(r.A.shear.avs).toBe(0);
    expect(layouts.A.stirrup.count).toBe(1);
    expect(layouts.A.stirrup.spacing).toBeLessThan(torsion.sMin);
    expect(r.stirrupNotes.A).toMatch(/แนะนำใช้ปลอก/);
  });

  it('พื้นยื่นสั้นมาก vt ≤ vc → ไม่ต้องเสริมเหล็กรับแรงบิด', () => {
    const light: LedgeBeamInput = { ...input, slabLength: 0.3, b: 25, h: 50, beamWallH: 0 };
    const r = analyzeLedgeBeam(light, designLedge(light));
    expect(r.A.shear.torsionNeglected).toBe(true);
    expect(r.A.shear.Al).toBe(0);
  });

  it('ตรวจข้อมูลนำเข้า', () => {
    expect(validateLedgeInput({ ...input, slabLength: 0 })).toHaveLength(1);
    expect(validateLedgeInput({ ...input, b: 12 }).length).toBeGreaterThan(0);
  });
});
