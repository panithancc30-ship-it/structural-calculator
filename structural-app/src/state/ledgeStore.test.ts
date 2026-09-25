import { describe, expect, it } from 'vitest';
import { analyzeLedgeBeam, designLedge } from '@/engine/concrete/ledge/analyzeLedge';
import { DEFAULT_LEDGE, parseLedgeProject, toLedgeProjectFile, useLedgeStore } from './ledgeStore';

describe('ไฟล์โครงการคานรับพื้นยื่น', () => {
  const layouts = designLedge(DEFAULT_LEDGE);

  it('ค่าเริ่มต้นออกแบบแล้วไม่มีข้อที่ไม่ผ่าน', () => {
    const r = analyzeLedgeBeam(DEFAULT_LEDGE, layouts);
    expect(r.checks.filter((c) => c.status === 'fail')).toEqual([]);
  });

  it('บันทึกแล้วเปิดได้ค่าเดิม', () => {
    const input = { ...DEFAULT_LEDGE, slabLength: 1.5, LL: 300, support: 'bothEnds' as const };
    const file = JSON.parse(JSON.stringify(toLedgeProjectFile({ input, layouts, edited: { A: true, B: false } })));
    const parsed = parseLedgeProject(file);
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input).toEqual(input);
    expect(parsed.layouts).toEqual(layouts);
    expect(parsed.edited).toEqual({ A: true, B: false });
  });

  it('ปฏิเสธไฟล์ผิดรูปแบบ', () => {
    expect(parseLedgeProject({ app: 'rc-beam-wsd' })).toBe('ไม่ใช่ไฟล์โครงการคานรับพื้นยื่นของโปรแกรมนี้');
    const file = toLedgeProjectFile({ input: DEFAULT_LEDGE, layouts, edited: { A: false, B: false } });
    expect(typeof parseLedgeProject({ ...file, input: { ...DEFAULT_LEDGE, support: 'cantilever' } })).toBe('string');
    expect(typeof parseLedgeProject({ ...file, input: { ...DEFAULT_LEDGE, LL: '150' } })).toBe('string');
    expect(typeof parseLedgeProject({ ...file, layouts: { A: layouts.A } })).toBe('string');
  });

  it('แก้น้ำหนักใช้งานแล้วออกแบบเหล็กใหม่ เว้นหน้าตัดที่แก้เอง', () => {
    const store = useLedgeStore;
    store.getState().resetProject();
    const before = store.getState().layouts;
    store.getState().editLayout('B', (l) => ({ ...l, stirrup: { ...l.stirrup, spacing: 10 } }));
    store.getState().setInput({ LL: 600, slabLength: 1.5 });
    const after = store.getState().layouts;
    expect(after.A).not.toEqual(before.A);
    expect(after.B.stirrup.spacing).toBe(10);
    store.getState().resetProject();
  });
});
