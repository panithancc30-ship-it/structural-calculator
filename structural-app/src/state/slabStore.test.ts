import { describe, expect, it } from 'vitest';
import { autoSlabLayout, slabDims } from '@/engine/concrete/slab/designSlab';
import { DEFAULT_SLAB, parseSlabProject, toSlabProjectFile } from './slabStore';

describe('ไฟล์โครงการพื้น', () => {
  const layout = autoSlabLayout(DEFAULT_SLAB, slabDims(DEFAULT_SLAB));

  it('บันทึกแล้วเปิดได้ค่าเดิม', () => {
    const input = { ...DEFAULT_SLAB, slabType: 'cantilever' as const, edgeX1: 'continuous' as const, edgeX2: 'free' as const };
    const file = JSON.parse(JSON.stringify(toSlabProjectFile({ input, layout, edited: true })));
    const parsed = parseSlabProject(file);
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input.slabType).toBe('cantilever');
    expect(parsed.input.edgeX2).toBe('free');
    expect(parsed.layout).toEqual(layout);
    expect(parsed.edited).toBe(true);
  });

  it('เก็บเหล็กที่เป็น null ไว้ได้ (ผิวที่ไม่มีเหล็ก)', () => {
    const sparse = { ...layout, top: { x: null, y: null } };
    const file = JSON.parse(JSON.stringify(toSlabProjectFile({ input: DEFAULT_SLAB, layout: sparse, edited: false })));
    const parsed = parseSlabProject(file);
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.layout.top.x).toBeNull();
  });

  it('ปฏิเสธไฟล์ผิดรูปแบบ', () => {
    expect(parseSlabProject({ app: 'rc-footing-wsd' })).toBe('ไม่ใช่ไฟล์โครงการพื้นของโปรแกรมนี้');
    const file = toSlabProjectFile({ input: DEFAULT_SLAB, layout, edited: false });
    expect(typeof parseSlabProject({ ...file, input: { ...DEFAULT_SLAB, slabType: 'waffle' } })).toBe('string');
    expect(typeof parseSlabProject({ ...file, input: { ...DEFAULT_SLAB, edgeX1: 'pinned' } })).toBe('string');
    expect(
      typeof parseSlabProject({ ...file, layout: { ...layout, bottom: { x: { size: 'DB12', spacing: 0 }, y: null } } }),
    ).toBe('string');
    expect(typeof parseSlabProject({ ...file, layout: { ...layout, outerLayer: { bottom: 'z', top: 'x' } } })).toBe('string');
  });
});
