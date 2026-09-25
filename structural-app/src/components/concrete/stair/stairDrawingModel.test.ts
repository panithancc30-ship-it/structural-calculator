import { describe, expect, it } from 'vitest';
import { analyzeStair } from '@/engine/concrete/stair/analyzeStair';
import { autoStairLayout, stairDims } from '@/engine/concrete/stair/designStair';
import type { StairInput } from '@/engine/concrete/stair/types';
import { DEFAULT_STAIR } from '@/state/stairStore';
import { buildStairModel, pickStairScale } from './stairDrawingModel';

const build = (input: StairInput, denom = 30) => {
  const dims = stairDims(input);
  const layout = autoStairLayout(input, dims);
  const a = analyzeStair(input, dims, layout);
  return { model: buildStairModel(input, a, layout, denom), a, layout };
};

const finite = (text: string) => !/NaN|Infinity/.test(text);

describe('รูปตัดบันได', () => {
  const variants: Array<[string, StairInput]> = [
    ['แบบตัวอย่าง', DEFAULT_STAIR],
    ['ขึ้นทางซ้าย', { ...DEFAULT_STAIR, ascend: 'left' }],
    ['ต่อเนื่องสองปลาย', { ...DEFAULT_STAIR, endLow: 'continuous', endHigh: 'continuous' }],
    ['ส่วนราบสั้นทั้งสองปลาย', { ...DEFAULT_STAIR, risers: 10, landingLow: 10, landingHigh: 25 }],
    ['บันไดสั้นสามขั้น', { ...DEFAULT_STAIR, risers: 3, landingLow: 60, landingHigh: 60 }],
  ];

  it.each(variants)('%s — พิกัดทุกจุดเป็นตัวเลขจริง', (_, input) => {
    const { model } = build(input);
    expect(finite(model.outline)).toBe(true);
    expect(model.bars.every((b) => finite(b.path))).toBe(true);
    expect(model.dots.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y))).toBe(true);
    expect(Object.values(model.view).every(Number.isFinite)).toBe(true);
  });

  it('มีเหล็กมุมทุกจุดหัก — มุมขั้น N มุม (รวมขอบส่วนราบบน) และมุมที่ท้องบันได N มุม', () => {
    const { model } = build(DEFAULT_STAIR);
    expect(model.dots.filter((d) => d.key === 'step')).toHaveLength(2 * DEFAULT_STAIR.risers);
  });

  it('เหล็กขั้นบันไดเป็นซิกแซกระหว่างมุมขั้นกับท้องบันได ไม่มีช่วงวิ่งใต้ลูกนอน', () => {
    const { model } = build(DEFAULT_STAIR);
    const step = model.bars.find((b) => b.key === 'step')!;
    const pts = step.path
      .split(/[ML]/)
      .filter(Boolean)
      .map((p) => p.split(',').map(Number));
    // จุดเริ่ม + (จุดท้อง, มุมขั้น) ต่อหนึ่งขั้น + ปลายทาบบนส่วนราบบน
    expect(pts).toHaveLength(2 + 2 * DEFAULT_STAIR.risers);
    // ระหว่างจุดเริ่มกับปลายทาบ ทุกช่วงสลับขึ้นลง — ไม่มีช่วงราบ
    for (let i = 1; i < pts.length - 1; i++) {
      expect(Math.abs(pts[i][1] - pts[i - 1][1])).toBeGreaterThan(1);
    }
  });

  it('ขึ้นทางซ้ายเป็นภาพสะท้อน — ขนาดรูปเท่าเดิม', () => {
    const right = build(DEFAULT_STAIR).model;
    const left = build({ ...DEFAULT_STAIR, ascend: 'left' }).model;
    expect(left.view.w).toBeCloseTo(right.view.w, 6);
    expect(left.view.h).toBeCloseTo(right.view.h, 6);
  });

  it('เลือกมาตราส่วนที่พอดีกรอบ', () => {
    const { a, layout } = build(DEFAULT_STAIR);
    const denom = pickStairScale(DEFAULT_STAIR, a, layout, { w: 168, h: 78 });
    const model = buildStairModel(DEFAULT_STAIR, a, layout, denom);
    expect(model.sizeMm.w).toBeLessThanOrEqual(168);
    expect(model.sizeMm.h).toBeLessThanOrEqual(78);
  });
});
