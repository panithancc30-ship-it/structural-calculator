import { describe, expect, it } from 'vitest';
import { autoStairLayout, stairDims } from '@/engine/concrete/stair/designStair';
import { DEFAULT_STAIR, parseStairProject, toStairProjectFile } from './stairStore';

describe('ไฟล์โครงการบันได', () => {
  const layout = autoStairLayout(DEFAULT_STAIR, stairDims(DEFAULT_STAIR));

  it('บันทึกแล้วเปิดได้ค่าเดิม', () => {
    const input = { ...DEFAULT_STAIR, endLow: 'continuous' as const, ascend: 'left' as const, risers: 10 };
    const file = JSON.parse(JSON.stringify(toStairProjectFile({ input, layout, edited: true })));
    const parsed = parseStairProject(file);
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input.endLow).toBe('continuous');
    expect(parsed.input.ascend).toBe('left');
    expect(parsed.input.risers).toBe(10);
    expect(parsed.layout).toEqual(layout);
    expect(parsed.edited).toBe(true);
  });

  it('เก็บเหล็กที่เป็น null ไว้ได้ (เอาเหล็กขั้นบันไดออก)', () => {
    const sparse = { ...layout, step: null };
    const file = JSON.parse(JSON.stringify(toStairProjectFile({ input: DEFAULT_STAIR, layout: sparse, edited: false })));
    const parsed = parseStairProject(file);
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.layout.step).toBeNull();
  });

  it('ปฏิเสธไฟล์ผิดรูปแบบ', () => {
    expect(parseStairProject({ app: 'rc-slab-wsd' })).toBe('ไม่ใช่ไฟล์โครงการบันไดของโปรแกรมนี้');
    const file = toStairProjectFile({ input: DEFAULT_STAIR, layout, edited: false });
    expect(typeof parseStairProject({ ...file, input: { ...DEFAULT_STAIR, endLow: 'fixed' } })).toBe('string');
    expect(typeof parseStairProject({ ...file, input: { ...DEFAULT_STAIR, risers: '8' } })).toBe('string');
    expect(typeof parseStairProject({ ...file, layout: { ...layout, bottom: { size: 'DB12', spacing: 0 } } })).toBe('string');
    expect(typeof parseStairProject({ ...file, layout: { ...layout, dist: undefined } })).toBe('string');
  });
});
