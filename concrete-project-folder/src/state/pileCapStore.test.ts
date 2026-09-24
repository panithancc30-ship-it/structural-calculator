import { describe, expect, it } from 'vitest';
import { autoPileCapLayout, pileCapDesign } from '../domain/pilecap/designPileCap';
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

  it('ปฏิเสธไฟล์ผิดรูปแบบ', () => {
    expect(typeof parsePileCapProject({ app: 'rc-footing-wsd' })).toBe('string');
    const file = toPileCapProjectFile({ input: DEFAULT_PILECAP, layout, edited: false });
    expect(typeof parsePileCapProject({ ...file, input: { ...DEFAULT_PILECAP, pileShape: 'hex' } })).toBe('string');
    expect(typeof parsePileCapProject({ ...file, input: { ...DEFAULT_PILECAP, offsets: [{ dx: 'a', dy: 0 }] } })).toBe('string');
  });
});
