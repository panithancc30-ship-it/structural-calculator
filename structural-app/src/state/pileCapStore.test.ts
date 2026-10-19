import { describe, expect, it } from 'vitest';
import { autoPileCapLayout, pileCapDesign } from '@/engine/concrete/pilecap/designPileCap';
import { DEFAULT_PILECAP, parsePileCapProject, toPileCapProjectFile } from './pileCapStore';

describe('ไฟล์โครงการฐานรากเสาเข็ม', () => {
  const d = pileCapDesign(DEFAULT_PILECAP);
  const layout = autoPileCapLayout(DEFAULT_PILECAP, d.arrangement, d.t);

  it('บันทึกแล้วเปิดได้ค่าเดิม รวมระยะเยื้องเข็ม', () => {
    const offsets = DEFAULT_PILECAP.offsets.map((o, i) => (i === 1 ? { dx: 12, dy: -5 } : o));
    const input = { ...DEFAULT_PILECAP, ex: 10, offsets };
    const parsed = parsePileCapProject(JSON.parse(JSON.stringify(toPileCapProjectFile({ input, layout, edited: true }))));
    expect(typeof parsed).not.toBe('string');
    if (typeof parsed === 'string') return;
    expect(parsed.input).toEqual(input);
    expect(parsed.layout).toEqual(layout);
    expect(parsed.edited).toBe(true);
  });

  it('จำนวนเหล็กยืนเข็มต้นเดียวบันทึกและเปิดได้, ไฟล์เก่าไม่มีจำนวนก็เปิดได้, จำนวนผิดปฏิเสธ', () => {
    const cage = { size: 'DB16' as const, count: 12, tie: 'RB9' as const, tieSpacing: 10 };
    const file = toPileCapProjectFile({ input: DEFAULT_PILECAP, layout: { ...layout, cage }, edited: true });
    const parsed = parsePileCapProject(JSON.parse(JSON.stringify(file)));
    expect(typeof parsed !== 'string' && parsed.layout.cage).toEqual(cage);
    const { count: _omit, ...old } = cage;
    expect(typeof parsePileCapProject({ ...file, layout: { ...layout, cage: old } })).not.toBe('string');
    expect(typeof parsePileCapProject({ ...file, layout: { ...layout, cage: { ...cage, count: 10 } } })).toBe('string');
  });

  it('ปฏิเสธไฟล์ผิดรูปแบบ', () => {
    expect(typeof parsePileCapProject({ app: 'rc-footing-wsd' })).toBe('string');
    const file = toPileCapProjectFile({ input: DEFAULT_PILECAP, layout, edited: false });
    expect(typeof parsePileCapProject({ ...file, input: { ...DEFAULT_PILECAP, pileShape: 'hex' } })).toBe('string');
    expect(typeof parsePileCapProject({ ...file, input: { ...DEFAULT_PILECAP, offsets: [{ dx: 'a', dy: 0 }] } })).toBe('string');
  });
});
