import { describe, expect, it } from 'vitest';
import { DEFAULT_COLUMN, parseColumnProject, toColumnProjectFile, useColumnStore } from '@/state/columnStore';
import { DEFAULT_FOOTING, parseFootingProject, toFootingProjectFile, useFootingStore } from '@/state/footingStore';
import { DEFAULT_LEDGE } from '@/state/ledgeStore';
import { DEFAULT_PILECAP } from '@/state/pileCapStore';
import { DEFAULT_SLAB } from '@/state/slabStore';
import { DEFAULT_INPUT, parseProject, toProjectFile, useStore } from '@/state/store';
import { aciAxisSlenderness, aciInteractionCurve } from '../column/aciColumn';
import { analyzeColumn } from '../column/analyzeColumn';
import { autoColumnLayout, buildRectLayout } from '../column/designColumn';
import type { ColumnInput } from '../column/types';
import { wsdParams } from '../design/flexure';
import { shearTorsionDemand } from '../design/shearTorsion';
import { analyzeFooting, asMinRatio, developmentLengths } from '../footing/analyzeFooting';
import type { FootingDims, FootingInput, FootingLayout } from '../footing/types';
import { ledgeLoads } from '../ledge/loads';
import { ledgeSectionInputs } from '../ledge/analyzeLedge';
import { analyzePileCap } from '../pilecap/analyzePileCap';
import { autoPileCapLayout, pileCapDesign } from '../pilecap/designPileCap';
import { REBARS } from '../rebar';
import { analyzeSlab } from '../slab/analyzeSlab';
import { autoSlabLayout, slabDims } from '../slab/designSlab';
import { beamReaction, rankineGrashof, slabLoads } from '../slab/loads';
import type { BeamInput } from '../types';
import { codeLabel, codeOf, punchingVc } from './designCode';

describe('ตัวเลือกมาตรฐาน', () => {
  it('ไม่ระบุ = วสท. และค่าเริ่มต้นของทุกโมดูลเป็น วสท.', () => {
    expect(codeOf({})).toBe('eit');
    for (const d of [DEFAULT_INPUT, DEFAULT_COLUMN, DEFAULT_FOOTING, DEFAULT_LEDGE, DEFAULT_PILECAP, DEFAULT_SLAB]) {
      expect(d.code).toBe('eit');
    }
  });

  it('ชื่อมาตรฐานในหัวรายการคำนวณ', () => {
    expect(codeLabel('eit', 'ฐานรากแผ่')).toBe('มาตรฐาน วสท. ฐานรากแผ่');
    expect(codeLabel('aci', 'ฐานรากแผ่')).toBe('ACI 318 Alternate Design Method — ฐานรากแผ่');
    expect(codeLabel('eit')).toBe('มาตรฐาน วสท.');
  });

  it('ไฟล์เก่าที่ไม่มี code อ่านได้เป็น วสท., ค่าที่ไม่รู้จักไม่รับ', () => {
    const beam = toProjectFile(useStore.getInitialState());
    const { code: _drop, ...oldInput } = beam.input;
    const parsed = parseProject({ ...beam, input: oldInput });
    expect(typeof parsed !== 'string' && parsed.input.code).toBe('eit');
    expect(typeof parseProject({ ...beam, input: { ...beam.input, code: 'aci' } })).not.toBe('string');
    expect(typeof parseProject({ ...beam, input: { ...beam.input, code: 'bs8110' } })).toBe('string');

    const col = toColumnProjectFile(useColumnStore.getInitialState());
    expect(typeof parseColumnProject({ ...col, input: { ...col.input, code: 'x' } })).toBe('string');
    const ftg = toFootingProjectFile(useFootingStore.getInitialState());
    const aci = parseFootingProject({ ...ftg, input: { ...ftg.input, code: 'aci' } });
    expect(typeof aci !== 'string' && aci.input.code).toBe('aci');
  });
});

describe('คาน: ขนาดหน้าตัดรับแรงเฉือน', () => {
  const base: BeamInput = {
    b: 25, h: 50, L: 5, cover: 3, fc: 240, fy: 4000, fyv: 2400,
    M: 8000, V: 6000, T: 0,
    mainBar: 'DB16', stirrupBar: 'RB9', stirrupMode: 'auto', sMin: 10, support: 'bothEnds',
  };
  const p = wsdParams(240, 4000, 2400);
  const sq = Math.sqrt(240);
  // v = 1.40√f′c: เกิน วสท. (1.32√f′c) แต่ v − vc = 1.11√f′c ≤ 1.16√f′c ตาม ACI
  const V = 1.4 * sq * 25 * 43.5;

  it('วสท. v ≤ 1.32√f′c ไม่ผ่าน, ACI v − vc ≤ 1.16√f′c ผ่าน', () => {
    expect(shearTorsionDemand({ ...base, V }, p, 43.5, 0.9).shearSectionOk).toBe(false);
    const aci = shearTorsionDemand({ ...base, V, code: 'aci' }, p, 43.5, 0.9);
    expect(aci.code).toBe('aci');
    expect(aci.vExcessMax).toBeCloseTo(1.16 * sq, 8);
    expect(aci.shearSectionOk).toBe(true);
    expect(shearTorsionDemand({ ...base, V: 1.5 * sq * 25 * 43.5, code: 'aci' }, p, 43.5, 0.9).shearSectionOk).toBe(false);
  });
});

describe('คานรับพื้นยื่น: วิธีคำนวณแรงบิดตามมาตรฐาน', () => {
  it('วสท. ใช้วิธี ว.ส.ท., ACI ใช้ ACI 318-83', () => {
    expect(ledgeSectionInputs(DEFAULT_LEDGE, ledgeLoads(DEFAULT_LEDGE)).A.torsionMethod).toBe('eit');
    const aci = { ...DEFAULT_LEDGE, code: 'aci' as const };
    const s = ledgeSectionInputs(aci, ledgeLoads(aci));
    expect(s.A.torsionMethod).toBe('aci');
    expect(s.B.code).toBe('aci');
  });
});

describe('เสา ACI (คำนวณมือ)', () => {
  const base: ColumnInput = {
    columnName: 'C1', code: 'aci',
    shape: 'rect', b: 30, h: 30, D: 40, cover: 3,
    Lu: 3, fc: 240, fy: 4000, fyv: 2400,
    P: 20000, Mx: 1000, My: 0,
    mainBar: 'DB16', tieBar: 'RB9',
  };

  it('แรงอัดล้วน P ยอมให้ = 0.4·φ·0.80Po', () => {
    const As = 2 * REBARS.DB20.area;
    const bars = [{ y: 19, area: As }, { y: -19, area: As }];
    const curve = aciInteractionCurve({ kind: 'rect', width: 30, depth: 50 }, bars, 240, 4000, false);
    const Po = 0.85 * 240 * (1500 - 2 * As) + 4000 * 2 * As;
    expect(curve.Pmax).toBeCloseTo(0.4 * 0.7 * 0.8 * Po, 3);
    expect(curve.P0).toBeCloseTo(0.4 * 0.7 * Po, 3);
  });

  it('30×30, Lu 3 ม. → kLu/r 33.3 > 22 เสายาว δ = 1.198', () => {
    const s = aciAxisSlenderness(base, 'x', 30 ** 4 / 12, 30, 0.7);
    expect(s.ratio).toBeCloseTo(33.33, 1);
    expect(s.limit).toBe(22);
    expect(s.slender).toBe(true);
    expect(s.Pc).toBeCloseTo(432896, -2);
    expect(s.delta).toBeCloseTo(1.1976, 3);
    expect(s.Mdesign).toBeCloseTo(1.1976 * 100000, -2);
  });

  it('analyzeColumn ใช้โมเมนต์ที่ขยายแล้ว ส่วน วสท. ใช้ R ลดกำลัง', () => {
    const layout = buildRectLayout(4, base, { size: 'RB9', spacing: 15 });
    const aci = analyzeColumn(base, layout);
    expect(aci.code).toBe('aci');
    expect(aci.R).toBe(1);
    expect(aci.delta).toBeCloseTo(1.1976, 3);
    expect(aci.Mx).toBeCloseTo(1.1976 * 100000, -2);
    expect(aci.steps.some((s) => s.label === 'δ (x)')).toBe(true);
    const eit = analyzeColumn({ ...base, code: 'eit' }, layout);
    expect(eit.code).toBe('eit');
    expect(eit.delta).toBe(1);
    expect(eit.Mx).toBe(100000);
    expect(eit.steps.some((s) => s.label === 'Pa')).toBe(true);
  });

  it('ดัดสองแกนแรงอัดสูงใช้ Bresler', () => {
    const input = { ...base, b: 40, h: 40, P: 60000, Mx: 3000, My: 2000 };
    const a = analyzeColumn(input, autoColumnLayout(input));
    expect(a.method).toBe('bresler');
    expect(a.utilization).toBeLessThanOrEqual(1);
    expect(a.steps.some((s) => s.label === 'Pi')).toBe(true);
  });

  it('ปลอกเดี่ยว ACI ต้อง Ø ≥ 9 มม.: RB6 ไม่ผ่าน และออกแบบอัตโนมัติเปลี่ยนเป็น RB9', () => {
    const input = { ...base, b: 20, h: 20, cover: 2.5, P: 8000, Mx: 300, mainBar: 'DB12' as const, tieBar: 'RB6' as const };
    const a = analyzeColumn(input, buildRectLayout(4, input, { size: 'RB6', spacing: 15 }));
    expect(a.checks.find((c) => c.label.startsWith('ขนาดเหล็กปลอก'))?.status).toBe('fail');
    expect(autoColumnLayout(input).tie.size).toBe('RB9');
    expect(autoColumnLayout({ ...input, code: 'eit' }).tie.size).toBe('RB6');
  });
});

describe('ฐานราก ACI', () => {
  const base: FootingInput = {
    footingName: 'F1', code: 'aci',
    cx: 30, cy: 30, position: 'center', ex: 0, ey: 0, edgeSide: 'left', cornerSide: 'bottom-left', edgeGap: 0,
    sizeMode: 'manual', B: 200, L: 200, t: 50, cover: 7.5,
    Df: 1.5, qa: 20, gammaSoil: 1.8,
    fc: 240, fy: 4000,
    P: 40000, Mx: 0, My: 0,
    bar: 'DB16',
  };
  const layout: FootingLayout = { x: { size: 'DB16', count: 12 }, y: { size: 'DB16', count: 12 }, bottom: 'x' };
  const dims: FootingDims = { B: 200, L: 200, t: 50 };

  it('เฉือนทะลุ: เสาจัตุรัสภายใน = 0.53√f′c ทั้งสองมาตรฐาน, เสายาว βc = 3 ลดตาม ACI', () => {
    expect(analyzeFooting(base, dims, layout).punching!.vc).toBeCloseTo(0.53 * Math.sqrt(240), 8);
    expect(punchingVc('aci', 240, 3, 4, 40, 400)).toBeCloseTo(0.265 * (1 + 2 / 3) * Math.sqrt(240), 8);
    expect(punchingVc('eit', 240, 3, 4, 40, 400)).toBeCloseTo(0.53 * Math.sqrt(240), 8);
    const long = { ...base, cx: 20, cy: 60 };
    const aci = analyzeFooting(long, dims, layout).punching!;
    const eit = analyzeFooting({ ...long, code: 'eit' }, dims, layout).punching!;
    expect(aci.vc).toBeLessThan(eit.vc);
    expect(aci.vc).toBeCloseTo(0.265 * (1 + 2 / 3) * Math.sqrt(240), 6);
  });

  it('เหล็กกันร้าวเหล็กกลม: วสท. 0.0025, ACI 0.0020', () => {
    expect(asMinRatio(2400)).toBe(0.0025);
    expect(asMinRatio(2400, 'aci')).toBe(0.002);
    expect(asMinRatio(4000, 'aci')).toBeCloseTo(0.0018, 10);
  });

  it('ระยะฝัง ld: ACI 0.06Ab·fy/√f′c ≥ 0.0057db·fy', () => {
    const { area, dia } = REBARS.DB20;
    const ld = developmentLengths('DB20', 240, 4000, 1, 'aci').ld;
    expect(ld).toBeCloseTo(Math.max((0.06 * area * 4000) / Math.sqrt(240), 0.0057 * dia * 4000), 8);
    expect(developmentLengths('DB20', 240, 4000, 1).ld).not.toBeCloseTo(ld, 1);
  });

  it('ขั้นตอนคำนวณแสดงสูตร ACI', () => {
    const a = analyzeFooting(base, dims, layout);
    expect(a.steps.find((s) => s.label === 'vc ทะลุ')?.formula).toContain('βc');
  });
});

describe('ฐานรากเสาเข็ม ACI', () => {
  it('เฉือนทะลุรอบเสาใช้สูตร ACI', () => {
    const input = { ...DEFAULT_PILECAP, code: 'aci' as const, cx: 20, cy: 60 };
    const d = pileCapDesign(input);
    const a = analyzePileCap(input, d.arrangement, d.t, autoPileCapLayout(input, d.arrangement, d.t));
    expect(a.punching!.vc).toBeCloseTo(0.265 * (1 + 2 / 3) * Math.sqrt(input.fc), 6);
    expect(a.steps.find((s) => s.label === 'vc ทะลุ')?.formula).toContain('αs');
  });
});

describe('พื้นสองทาง ACI — Rankine–Grashof', () => {
  const input = { ...DEFAULT_SLAB, code: 'aci' as const, slabType: 'twoWay' as const, lx: 400, ly: 500 };

  it('wx = w·ly⁴/(lx⁴+ly⁴), ไม่ใช้ตารางวิธีที่ 2', () => {
    const loads = slabLoads(input, 12);
    expect(loads.twoWay).toBeNull();
    expect(loads.splitRatio).toBeCloseTo(625 / 881, 10);
    expect(rankineGrashof(400, 400)).toBeCloseTo(0.5, 10);
    expect(loads.share.x + loads.share.y).toBeCloseTo(loads.w, 8);
    expect(beamReaction(loads, { lx: 400, ly: 500, t: 12 }, 'x')).toBeCloseTo((loads.share.x * 4) / 2, 8);
  });

  it('ออกแบบได้ และขั้นตอนคำนวณแสดงการแบ่งน้ำหนัก', () => {
    const dims = slabDims(input);
    const a = analyzeSlab(input, dims, autoSlabLayout(input, dims));
    expect(a.steps.some((s) => s.label === 'แบ่งน้ำหนักสองทาง')).toBe(true);
    expect(a.checks.filter((c) => c.status === 'fail')).toEqual([]);
    expect(slabLoads({ ...input, code: 'eit' }, 12).twoWay).not.toBeNull();
  });
});
