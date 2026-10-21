import { describe, expect, it } from 'vitest';
import { autoSlabLayout, slabDims } from '@/engine/concrete/slab/designSlab';
import { DEFAULT_SLAB, parseSlabProject, toSlabProjectFile, useSlabStore } from './slabStore';

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
    const file = JSON.parse(JSON.stringify(toSlabProjectFile({ input: DEFAULT_SLAB, layout: sparse, edited: true })));
    const parsed = parseSlabProject(file);
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.layout.top.x).toBeNull();
  });

  it('ไฟล์เก่าที่ไม่มี qa เปิดได้ (ใช้ค่าเริ่มต้น)', () => {
    const { qa: _qa, ...old } = DEFAULT_SLAB;
    const parsed = parseSlabProject({ app: 'rc-slab-wsd', version: 1, input: old, layout, edited: false });
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input.qa).toBe(DEFAULT_SLAB.qa);
  });

  it('ไฟล์ที่ไม่ได้แก้เหล็กเอง ออกแบบใหม่ด้วยวิธีปัจจุบัน (แบบขยายพื้น S1)', () => {
    // ผลออกแบบรุ่นก่อน: เหล็กบนเต็มชุดแยกจากเหล็กล่าง
    const old = {
      bottom: { x: { size: 'DB12', spacing: 20 }, y: { size: 'DB12', spacing: 25 } },
      top: { x: { size: 'DB12', spacing: 15 }, y: { size: 'DB12', spacing: 20 } },
      outerLayer: { bottom: 'x', top: 'x' },
    };
    const parsed = parseSlabProject({ app: 'rc-slab-wsd', version: 1, input: DEFAULT_SLAB, layout: old, edited: false });
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.layout).toEqual(layout);
    const kept = parseSlabProject({ app: 'rc-slab-wsd', version: 1, input: DEFAULT_SLAB, layout: old, edited: true });
    if (typeof kept === 'string') return;
    expect(kept.layout).toEqual(old);
  });

  it('เปลี่ยนชนิดพื้น → ออกแบบเหล็กใหม่ แม้เคยแก้เหล็กเอง', () => {
    const store = useSlabStore;
    store.getState().resetProject();
    store.getState().editLayout((l) => ({ ...l, top: { ...l.top, y: { size: 'DB16', spacing: 10 } } }));
    store.getState().setInput({ LL: 250 });
    expect(store.getState().edited).toBe(true);
    store.getState().setInput({ slabType: 'oneWay' });
    expect(store.getState().edited).toBe(false);
    expect(store.getState().layout.top.y).toBeNull();
    store.getState().resetProject();
  });

  it('ไฟล์เก่าที่ไม่มีระดับพื้นเปิดได้ (พื้นทั่วไป)', () => {
    const { level: _level, ...old } = DEFAULT_SLAB;
    const parsed = parseSlabProject({ app: 'rc-slab-wsd', version: 1, input: old, layout, edited: false });
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input.level).toBe('general');
  });

  it('ค่าเริ่มต้นตามแบบขยายพื้น S1: Covering 3.0 cm. เหล็กกลม RB9 / RB6 SR24', () => {
    expect(DEFAULT_SLAB).toMatchObject({ cover: 3, bar: 'RB9', tempBar: 'RB6', fy: 2400, level: 'general' });
  });

  it('ปฏิเสธไฟล์ผิดรูปแบบ', () => {
    expect(typeof parseSlabProject({ ...toSlabProjectFile({ input: DEFAULT_SLAB, layout, edited: false }), input: { ...DEFAULT_SLAB, level: 'sunken' } })).toBe('string');
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
