import { describe, expect, it } from 'vitest';
import { analyzeSlab } from '@/engine/concrete/slab/analyzeSlab';
import { autoSlabLayout, slabDims } from '@/engine/concrete/slab/designSlab';
import type { SlabInput } from '@/engine/concrete/slab/types';
import { SLAB_GROUND_BOX } from '@/features/concrete/reportScale';
import { DEFAULT_SLAB } from '@/state/slabStore';
import { buildGroundDetail, GROOVE_NOTE, meshText, NO_EMBED_NOTE, pickGroundScale, SAND_NOTE } from './groundSlabDrawingModel';

const gs: SlabInput = {
  ...DEFAULT_SLAB, slabName: 'GS', slabType: 'onGround', cover: 7.5, tempBar: 'RB6', fy: 2400, finishDL: 100, LL: 200,
};
const dims = slabDims(gs);
const layout = autoSlabLayout(gs, dims);
const a = analyzeSlab(gs, dims, layout);

/** ค่า x ทั้งหมดในเส้นทาง SVG (คำสั่ง M, H, L, A) — ใช้หาขอบเขตเหล็ก */
const pathXs = (d: string) => {
  const xs: number[] = [];
  for (const m of d.matchAll(/([MLHA])([^MLHVA]+)/g)) {
    const nums = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'H') xs.push(nums[0]);
    else if (m[1] === 'A') xs.push(nums[5]);
    else xs.push(nums[0]);
  }
  return xs;
};

describe('แบบขยายพื้น GS', () => {
  it('ป้ายตะแกรงเขียนแบบเดียวกับแบบมาตรฐาน', () => {
    expect(meshText(layout)).toBe('RB 6 @ 0.25m.#');
  });

  it('ด้านสั้นภายนอก: บอกความหนาพื้นและขอบหนา 0.10 + 0.10, เหล็กงอลงในขอบ', () => {
    const m = buildGroundDetail(gs, a, layout, 'outer', 20);
    expect(m.dim.labels.map((l) => l.text)).toEqual(['0.10', '0.10']);
    expect(m.callouts.map((c) => c.text.text)).toEqual(['RB 6 @ 0.25m.#', SAND_NOTE]);
    expect(m.beams).toEqual([]);
    // ขาเหล็กลงไปต่ำกว่าท้องพื้น (อยู่ในขอบหนา)
    const ys = [...m.bar!.path.matchAll(/V([-\d.]+)/g)].map((x) => Number(x[1]));
    expect(Math.max(...ys)).toBeGreaterThan(m.t);
    expect(m.title.title.text).toBe('แบบขยายพื้น GS');
    expect(m.title.suffix.text).toBe('(ด้านสั้นภายนอก)');
  });

  it('ด้านสั้นภายใน: ร่องยาแนวสองข้าง และเหล็กหยุดในพื้น ไม่ฝังเข้าคาน', () => {
    const m = buildGroundDetail(gs, a, layout, 'inner', 20);
    expect(m.dim.labels.map((l) => l.text)).toEqual(['0.10']);
    expect(m.callouts.map((c) => c.text.text)).toEqual([GROOVE_NOTE, `RB 6 @ 0.25m.# ${NO_EMBED_NOTE}`, SAND_NOTE]);
    expect(m.grooves).toHaveLength(2);
    const faces = m.beams.map((b) => (b.x < 0 ? b.x + b.w : b.x));
    const xs = pathXs(m.bar!.path);
    expect(Math.min(...xs)).toBeGreaterThan(faces[0]);
    expect(Math.max(...xs)).toBeLessThan(faces[1]);
    expect(m.title.suffix.text).toBe('(ด้านสั้นภายใน)');
  });

  it('จุดเหล็กทิศตั้งฉากเรียงตามระยะตะแกรง', () => {
    const m = buildGroundDetail(gs, a, layout, 'inner', 20);
    const gaps = m.dots.slice(1).map((d, i) => d.x - m.dots[i].x);
    expect(gaps.length).toBeGreaterThan(2);
    for (const g of gaps) expect(g).toBeCloseTo(25, 8);
  });

  it('รูปเล่มใช้มาตราส่วน 1:20 ตามแบบ', () => {
    expect(pickGroundScale(gs, a, layout, SLAB_GROUND_BOX)).toBe(20);
    expect(buildGroundDetail(gs, a, layout, 'inner', 20).title.scaleValue.text).toBe('1:20');
  });
});
