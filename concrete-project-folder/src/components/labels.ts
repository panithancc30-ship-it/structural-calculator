import type { SectionKey, SupportCondition } from '../domain/types';

export const SUPPORT_TH: Record<SupportCondition, string> = {
  simple: 'ช่วงเดียว (ยึดหมุน)',
  oneEnd: 'ต่อเนื่องปลายเดียว',
  bothEnds: 'ต่อเนื่องสองปลาย',
  cantilever: 'คานยื่น',
};

export const SECTION_TITLES: Record<SectionKey, { title: string; subtitle: string; moment: string }> = {
  A: { title: 'SECTION A-A', subtitle: 'กลางคาน', moment: 'M+' },
  B: { title: 'SECTION B-B', subtitle: 'ใกล้เสา', moment: 'M−' },
};
