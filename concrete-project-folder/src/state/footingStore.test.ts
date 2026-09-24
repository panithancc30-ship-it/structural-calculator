import { describe, expect, it } from 'vitest';
import { autoFootingLayout, footingDims } from '../domain/footing/designFooting';
import { DEFAULT_FOOTING, parseFootingProject, toFootingProjectFile } from './footingStore';

describe('ไฟล์โครงการฐานราก', () => {
  const layout = autoFootingLayout(DEFAULT_FOOTING, footingDims(DEFAULT_FOOTING));

  it('บันทึกแล้วเปิดได้ค่าเดิม', () => {
    const file = JSON.parse(JSON.stringify(toFootingProjectFile({ input: { ...DEFAULT_FOOTING, position: 'corner' }, layout, edited: true })));
    const parsed = parseFootingProject(file);
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input.position).toBe('corner');
    expect(parsed.layout).toEqual(layout);
    expect(parsed.edited).toBe(true);
  });

  it('ปฏิเสธไฟล์ผิดรูปแบบ', () => {
    expect(parseFootingProject({ app: 'rc-column-wsd' })).toBe('ไม่ใช่ไฟล์โครงการฐานรากของโปรแกรมนี้');
    const file = toFootingProjectFile({ input: DEFAULT_FOOTING, layout, edited: false });
    expect(typeof parseFootingProject({ ...file, input: { ...DEFAULT_FOOTING, position: 'strap' } })).toBe('string');
    expect(typeof parseFootingProject({ ...file, layout: { ...layout, x: { size: 'DB16', count: 1 } } })).toBe('string');
  });
});
