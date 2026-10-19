import { describe, expect, it } from 'vitest';
import { analyzePileCap } from '@/engine/concrete/pilecap/analyzePileCap';
import { autoPileCapLayout, pileCapDesign } from '@/engine/concrete/pilecap/designPileCap';
import { canRotate, PILE_COUNTS } from '@/engine/concrete/pilecap/piles';
import type { PileCapInput } from '@/engine/concrete/pilecap/types';
import { validatePileCapInput } from '@/engine/concrete/pilecap/validate';
import { DEFAULT_PILECAP } from '@/state/pileCapStore';
import { buildPlanModel, buildSectionModel, pickDrawingScale, pileCallout, type DimPick } from './pileCapDrawingModel';
import { dimEditPatch } from './pileCapEdits';

const analyze = (input: PileCapInput) => {
  const d = pileCapDesign(input);
  return analyzePileCap(input, d.arrangement, d.t, autoPileCapLayout(input, d.arrangement, d.t));
};

// แบบ F1: เข็ม □-22 รับ 20 ตัน 1 ต้น ฐาน 0.60 × 0.60 × 0.80
const single: PileCapInput = {
  ...DEFAULT_PILECAP, cx: 20, cy: 20, pileSize: 22, pileCapacity: 20, P: 15000,
  countMode: 'manual', pileCount: 1, thicknessMode: 'manual', t: 80,
};

const picksOf = (m: { dimPicks: (DimPick | null)[][] }) => m.dimPicks.flat().filter((p): p is DimPick => p !== null);

describe('รูปตัดและแปลนตามแบบมาตรฐาน', () => {
  it('เข็มต้นเดียว: เหล็กยืนรูปตัว U ปลอกประ ป้ายเหล็กและเสาเข็มตามแบบ', () => {
    const a = analyze(single);
    const s = buildSectionModel(single, a, 25);
    expect(s.cagePath).not.toBeNull();
    expect(s.alongPath).toBeNull();
    expect(s.ties.length).toBe(a.cage!.tieZ.length);
    const texts = s.callouts.flatMap((c) => c.lines.map((l) => l.text));
    expect(texts).toEqual(expect.arrayContaining(['ตอม่อ ดูขยายเสา', '2ป RB9 @0.10', '8-DB16', 'คอนกรีต 1:3:5', 'ทรายราดน้ำอัดแน่น']));
    expect(texts).toEqual(expect.arrayContaining(pileCallout(single, 1)));
    expect(pileCallout(single, 1)[1]).toBe('(เข็ม □-22 รับ นน.ปลอดภัย 20 ตัน/ต้น)');
    expect(s.pileTop).toBe(-30);
    expect(s.levelLabel?.text).toBe('ระดับที่กำหนด');
  });

  it('เข็มต้นเดียว: ระยะ t, หัวเข็มฝัง, คอนกรีตหยาบ, ทราย, ขอบถึงศูนย์ และความกว้าง แตะแก้ได้', () => {
    const a = analyze(single);
    const s = buildSectionModel(single, a, 25);
    // ชั้นบางเขียนตัวเลขแนวนอน (ตามแบบ) เมื่อสูงพอ — ที่ 1:25 ชั้น 5 ซม. พอ
    expect(s.layerLabels.map((l) => l.text)).toEqual(['0.05', '0.05']);
    const keys = [...picksOf(s), ...s.layerLabels.map((l) => l.pick)].map((p) => `${p.key}:${p.value}`);
    expect(keys).toEqual(expect.arrayContaining(['t:80', 'embed:30', 'lean:5', 'sand:5', 'edgeX:30', 'B:60']));
    const plan = buildPlanModel(single, a, 25);
    // ระยะทั้งสองแกน: ล่าง (x) และซ้าย (y) — ขอบถึงศูนย์เข็ม
    expect(picksOf(plan).map((p) => `${p.key}:${p.value}`)).toEqual(['edgeX:30', 'edgeX:30', 'edgeY:30', 'edgeY:30']);
    expect(plan.bars).toHaveLength(8);
    expect(plan.diamond).not.toBeNull();
    expect(plan.title.text).toBe('F1');
    expect(plan.title.scaleText).toBe('มาตราส่วน 1:25');
  });

  it('เพิ่มเหล็กยืนเป็น 12 เส้น: แปลนมี 12 จุด ป้ายรูปตัด "12-DB16" — 4 เส้นไม่มีปลอกข้าวหลามตัด', () => {
    const d = pileCapDesign(single);
    const base = autoPileCapLayout(single, d.arrangement, d.t);
    const a12 = analyzePileCap(single, d.arrangement, d.t, { ...base, cage: { ...base.cage!, count: 12 } });
    expect(buildPlanModel(single, a12, 25).bars).toHaveLength(12);
    expect(buildSectionModel(single, a12, 25).callouts.flatMap((c) => c.lines.map((l) => l.text))).toContain('12-DB16');
    const a4 = analyzePileCap(single, d.arrangement, d.t, { ...base, cage: { ...base.cage!, count: 4 } });
    const p4 = buildPlanModel(single, a4, 25);
    expect(p4.bars).toHaveLength(4);
    expect(p4.diamond).toBeNull();
    expect(buildSectionModel(single, a4, 25).callouts.flatMap((c) => c.lines.map((l) => l.text))).toContain('1ป RB9 @0.10');
  });

  it('ป้ายชี้ด้านขวาไม่ทับกัน', () => {
    for (const input of [single, DEFAULT_PILECAP]) {
      const a = analyze(input);
      for (const denom of [20, 50, 100]) {
        const ys = buildSectionModel(input, a, denom).callouts.flatMap((c) => c.lines.map((l) => l.y));
        const sorted = [...ys].sort((p, q) => p - q);
        for (let i = 1; i < sorted.length; i++) expect(sorted[i] - sorted[i - 1]).toBeGreaterThan(1.2 * 2.3 * (denom / 10) - 1e-6);
      }
    }
  });

  it('ชั้นบางเกินที่มาตราส่วนเล็ก → เขียนความหนาในป้ายชี้ และแตะป้ายแก้ได้', () => {
    const s = buildSectionModel(single, analyze(single), 60);
    expect(s.layerLabels).toEqual([]);
    const lean = s.callouts.find((c) => c.key === 'lean')!;
    expect(lean.lines[0].text).toBe('คอนกรีต 1:3:5 หนา 0.05');
    expect(lean.pick).toEqual({ kind: 'dim', key: 'lean', value: 5 });
  });

  it('ทุกจำนวนเข็ม ทั้งเข็มสี่เหลี่ยมและกลม เสาเยื้อง: สร้างรูปได้ ตัวเลขผูกกับระยะครบ', () => {
    for (const count of PILE_COUNTS) {
      for (const rotate of canRotate(count) ? [false, true] : [false]) {
        for (const pileShape of ['square', 'circle'] as const) {
          const input: PileCapInput = { ...DEFAULT_PILECAP, countMode: 'manual', pileCount: count, rotate, pileShape, ex: 10, ey: -5 };
          const a = analyze(input);
          const denom = pickDrawingScale(input, a);
          const s = buildSectionModel(input, a, denom);
          const p = buildPlanModel(input, a, denom);
          for (const m of [s, p]) {
            expect(Number.isFinite(m.view.w) && Number.isFinite(m.view.h)).toBe(true);
            m.dims.forEach((d, i) => expect(m.dimPicks[i]).toHaveLength(d.texts.length));
          }
          expect(picksOf(s).some((k) => k.key === 'B')).toBe(true);
          expect(picksOf(p).some((k) => k.key === 'L' || k.key === 'edgeY')).toBe(true);
          expect(picksOf(p).some((k) => k.key === 'B' || k.key === 'edgeX')).toBe(true);
        }
      }
    }
  });
});

describe('แตะตัวเลขบอกระยะแล้วแก้', () => {
  const a = analyze(DEFAULT_PILECAP);
  const dims = a.dims;

  it('ความกว้าง/ความยาว → กำหนดขนาดเอง คงอีกด้านไว้', () => {
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'B', value: dims.B }, 200, false)).toEqual({ sizeMode: 'manual', B: 200, L: dims.L });
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'L', value: dims.L }, 180, false)).toEqual({ sizeMode: 'manual', B: dims.B, L: 180 });
  });

  it('ระยะขอบ → ขยายฐานเท่ากันสองข้าง', () => {
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'edgeX', value: 30 }, 40, false)).toEqual({ sizeMode: 'manual', B: dims.B + 20, L: dims.L });
  });

  it('ช่วงระหว่างเข็ม → ระยะห่างเข็มตามสัดส่วนของช่วง', () => {
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'spacingX', value: 37.5, ratio: 0.5 }, 45, false)).toEqual({ spacing: 90 });
  });

  it('ความหนา / หัวเข็มฝัง / ชั้นรองพื้น / เยื้องศูนย์ (คงทิศ)', () => {
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 't', value: 60 }, 75, false)).toEqual({ thicknessMode: 'manual', t: 75 });
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'embed', value: 30 }, 35, true)).toEqual({ embedSingle: 35 });
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'embed', value: 5 }, 7, false)).toEqual({ embed: 7 });
    expect(dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'lean', value: 5 }, 10, false)).toEqual({ lean: 10 });
    expect(dimEditPatch({ ...DEFAULT_PILECAP, ex: -10 }, dims, { kind: 'dim', key: 'ex', value: 10 }, 15, false)).toEqual({ ex: -15 });
  });

  it('ค่าที่ได้ผ่านการตรวจข้อมูลนำเข้า', () => {
    const patch = dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'B', value: dims.B }, 160, false);
    expect(validatePileCapInput({ ...DEFAULT_PILECAP, ...patch })).toEqual([]);
    const bad = dimEditPatch(DEFAULT_PILECAP, dims, { kind: 'dim', key: 'B', value: dims.B }, 10, false);
    expect(validatePileCapInput({ ...DEFAULT_PILECAP, ...bad }).length).toBeGreaterThan(0);
  });
});
