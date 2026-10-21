import { describe, expect, it } from 'vitest';
import { designBeam } from '@/engine/concrete/design/designBeam';
import { DEFAULT_INPUT, parseProject } from './store';

describe('ไฟล์โครงการคาน คสล. — แบบ 2 ปลอก', () => {
  const layouts = designBeam(DEFAULT_INPUT);
  const file = { app: 'rc-beam-wsd', version: 1, input: DEFAULT_INPUT, layouts, edited: { A: false, B: false } };

  it('ไฟล์เก่าที่ไม่มีแบบ 2 ปลอก เปิดได้ (ใช้ปลอกในแคบ)', () => {
    const { doubleStirrup: _d, ...old } = DEFAULT_INPUT;
    const parsed = parseProject({ ...file, input: old });
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input.doubleStirrup).toBe('narrow');
  });

  it('เก็บแบบปลอกในของรูปแบบเหล็กไว้ได้', () => {
    const A = { ...layouts.A, stirrup: { ...layouts.A.stirrup, count: 2 as const, inner: 'layer2' as const } };
    const parsed = parseProject(JSON.parse(JSON.stringify({ ...file, layouts: { A, B: layouts.B } })));
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.layouts.A.stirrup.inner).toBe('layer2');
  });

  it('ปฏิเสธแบบ 2 ปลอกที่ไม่รู้จัก', () => {
    expect(typeof parseProject({ ...file, input: { ...DEFAULT_INPUT, doubleStirrup: 'zigzag' } })).toBe('string');
    const A = { ...layouts.A, stirrup: { ...layouts.A.stirrup, inner: 'zigzag' } };
    expect(typeof parseProject({ ...file, layouts: { A, B: layouts.B } })).toBe('string');
  });
});
