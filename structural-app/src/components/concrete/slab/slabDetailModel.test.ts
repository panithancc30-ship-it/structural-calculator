import { describe, expect, it } from 'vitest';
import { analyzeSlab } from '@/engine/concrete/slab/analyzeSlab';
import { autoSlabLayout, slabDims } from '@/engine/concrete/slab/designSlab';
import { setRun } from '@/engine/concrete/slab/layoutOps';
import type { SlabInput, SlabLayout } from '@/engine/concrete/slab/types';
import { SLAB_DETAIL_BOX } from '@/features/concrete/reportScale';
import { DEFAULT_SLAB } from '@/state/slabStore';
import { buildSlabDetail, DETAIL_ROLES, detailSummary, pickDetailScale, roleOf, rolePick, roleText } from './slabDetailModel';

// แบบตามรูป: พื้นสองทาง 3 × 3 ม. หนา 0.10 คอม้า RB9 @0.25 เสริมพิเศษ RB9 @0.50
const s1: SlabInput = { ...DEFAULT_SLAB, lx: 300, ly: 300, finishDL: 100, LL: 200 };
const oneWay: SlabInput = { ...s1, slabType: 'oneWay', lx: 300, ly: 600, edgeX1: 'simple', edgeX2: 'continuous' };

const setup = (input: SlabInput, edit: (l: SlabLayout) => SlabLayout = (l) => l) => {
  const dims = slabDims(input);
  const layout = edit(autoSlabLayout(input, dims));
  return { layout, a: analyzeSlab(input, dims, layout) };
};

/** ค่า x ทั้งหมดในเส้นทาง SVG (คำสั่ง M, L, H, A) */
const pathXs = (d: string) => {
  const xs: number[] = [];
  for (const m of d.matchAll(/([MLHAV])([^MLHVA]+)/g)) {
    const nums = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'A') xs.push(nums[5]);
    else if (m[1] !== 'V') xs.push(nums[0]);
  }
  return xs;
};

describe('แบบขยายพื้น S1', () => {
  it('ป้ายเหล็กเขียนแบบเดียวกับแบบมาตรฐาน', () => {
    const { layout, a } = setup(s1);
    expect(roleText('extra', s1, layout, a)).toBe('เหล็ก RB 9 มม. @ 0.50 ม. (เสริมพิเศษ)');
    expect(roleText('crank', s1, layout, a)).toBe('เหล็ก RB 9 มม. @ 0.25 ม. (คอม้าเว้นเส้น)');
    expect(roleText('cross', s1, layout, a)).toBe('เหล็ก RB 9 มม. @ 0.20 ม. (ด้านยาว คอม้าเว้นเส้น)');
  });

  it('พื้นทางเดียว: ทิศตั้งฉากเป็นเหล็กกันร้าว — แก้เป็น 0.165 ได้ตามแบบ', () => {
    const { layout, a } = setup(oneWay, (l) => setRun(l, 'bottom', 'y', { size: 'RB6', spacing: 16.5 }));
    expect(roleText('cross', oneWay, layout, a)).toBe('เหล็ก RB 6 มม. @ 0.165 ม.');
  });

  it('กรณีพื้นทั่วไป: ป้ายสามบรรทัด + Covering, บอกระยะ L/4 L/5 ทั้งสองข้างคานภายใน', () => {
    const { layout, a } = setup(s1);
    const m = buildSlabDetail(s1, a, layout, 20);
    expect(m.callouts.map((c) => c.role)).toEqual(['extra', 'crank', 'cross', 'cover']);
    expect(m.callouts[3].text.text).toBe('Covering=3.0cm.');
    const labels = m.dims.labels.map((l) => l.text);
    expect(labels.filter((t) => t === 'L/4')).toHaveLength(3);
    expect(labels.filter((t) => t === 'L/5')).toHaveLength(3);
    expect(labels).toContain('Short Span');
    expect(labels).toContain('0.10');
    expect(m.context).toEqual([]);
    expect(m.title.title.text).toBe('แบบขยายพื้น S1');
    expect(m.title.suffix.text).toBe('(กรณีพื้นทั่วไป)');
  });

  it('กรณีพื้นลดระดับ: เหล็กพื้นนี้งอลงฝังในคานขวา ไม่ต่อไปพื้นข้างเคียง', () => {
    const input = { ...s1, level: 'dropped' as const };
    const { layout, a } = setup(input);
    const m = buildSlabDetail(input, a, layout, 20);
    expect(m.title.suffix.text).toBe('(กรณีพื้นลดระดับ)');
    expect(m.callouts.map((c) => c.role)).toEqual(['extra', 'crank', 'cross']);
    const labels = m.dims.labels.map((l) => l.text);
    expect(labels.filter((t) => t === 'L/4')).toHaveLength(2);
    expect(labels.filter((t) => t === '0.10')).toHaveLength(2);
    // ช่วงที่วาด 160 ซม. คานกว้าง 15 → ผิวนอกคานขวาอยู่ที่ 167.5
    for (const bar of m.bars) expect(Math.max(...pathXs(bar.path))).toBeLessThan(167.5);
    expect(m.context).toHaveLength(3);
  });

  it('จุดเหล็กทิศตั้งฉากเรียงตามระยะเรียง', () => {
    const { layout, a } = setup(oneWay);
    const m = buildSlabDetail(oneWay, a, layout, 20);
    const y = Math.max(...m.dots.map((d) => d.y));
    const bottom = m.dots.filter((d) => d.y === y).map((d) => d.x);
    const gaps = bottom.slice(1).map((x, i) => x - bottom[i]);
    expect(gaps.length).toBeGreaterThan(5);
    for (const g of gaps) expect(g).toBeCloseTo(layout.bottom.y!.spacing, 8);
  });

  it('เหล็กแต่ละชุดแตะได้ — ผิว/ทิศของแต่ละชุดย้อนกลับเป็นชุดเดิม', () => {
    const { a } = setup({ ...s1, lx: 400, ly: 300 });
    for (const role of DETAIL_ROLES) {
      const pick = rolePick(role, a);
      expect(roleOf(pick.face, pick.dir, a)).toBe(role);
    }
    expect(rolePick('crank', a)).toEqual({ kind: 'bars', face: 'bottom', dir: 'y' });
  });

  it('สรุปเหล็กสามชุด', () => {
    const { layout, a } = setup(s1);
    expect(detailSummary(s1, layout, a).map((x) => `${x.label} ${x.text}`)).toEqual([
      'คอม้าด้านสั้น (X) RB9 @0.25',
      'เสริมพิเศษ RB9 @0.50',
      'คอม้าด้านยาว (Y) RB9 @0.20',
    ]);
  });

  it('รูปเล่มใช้มาตราส่วน 1:20 ตามแบบ', () => {
    for (const input of [s1, oneWay, { ...s1, level: 'dropped' as const }, DEFAULT_SLAB]) {
      const { layout, a } = setup(input);
      expect(pickDetailScale(input, a, layout, SLAB_DETAIL_BOX)).toBe(20);
    }
  });
});
