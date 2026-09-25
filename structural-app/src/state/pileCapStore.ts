import { create } from 'zustand';
import { ACI318_WSD_PILECAP as K } from '@/engine/concrete/codes/aci318Wsd';
import type { FootingLayout } from '@/engine/concrete/footing/types';
import { autoPileCapLayout, pileCapDesign } from '@/engine/concrete/pilecap/designPileCap';
import type { PileCapInput, PileOffset } from '@/engine/concrete/pilecap/types';
import { AUTO_MODES, PILE_SHAPES, validatePileCapInput } from '@/engine/concrete/pilecap/validate';
import { isBarName } from '@/engine/concrete/rebar';

export const noOffsets = (): PileOffset[] => Array.from({ length: K.maxPiles }, () => ({ dx: 0, dy: 0 }));

export const DEFAULT_PILECAP: PileCapInput = {
  capName: 'F1',
  cx: 30,
  cy: 30,
  ex: 0,
  ey: 0,
  pileShape: 'square',
  pileSize: 25,
  pileCapacity: 25,
  pileTension: 0,
  countMode: 'auto',
  pileCount: 4,
  rotate: false,
  spacing: 75,
  edge: 30,
  offsets: noOffsets(),
  thicknessMode: 'auto',
  t: 60,
  cover: 7.5,
  embed: 5,
  Df: 1.5,
  gammaSoil: 1.8,
  fc: 240,
  fy: 4000,
  P: 60000,
  Mx: 0,
  My: 0,
  bar: 'DB16',
};

function design(input: PileCapInput, prev: FootingLayout | null, edited: boolean): FootingLayout {
  const valid = validatePileCapInput(input).length === 0 ? input : null;
  if (!valid) {
    if (prev) return prev;
    const d = pileCapDesign(DEFAULT_PILECAP);
    return autoPileCapLayout(DEFAULT_PILECAP, d.arrangement, d.t);
  }
  if (edited && prev) return prev;
  const d = pileCapDesign(valid);
  return autoPileCapLayout(valid, d.arrangement, d.t);
}

export interface PileCapProjectFile {
  app: 'rc-pilecap-wsd';
  version: 1;
  input: PileCapInput;
  layout: FootingLayout;
  edited: boolean;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);
const isBarSet = (v: unknown) => {
  const o = asObj(v);
  return !!o && isBarName(o.size) && Number.isInteger(o.count) && (o.count as number) >= 2;
};
const isLayout = (value: unknown): value is FootingLayout => {
  const v = asObj(value);
  return (
    !!v && isBarSet(v.x) && isBarSet(v.y) && (v.bottom === 'x' || v.bottom === 'y') &&
    (v.basket === undefined || typeof v.basket === 'boolean')
  );
};

export function parsePileCapProject(data: unknown): PileCapProjectFile | string {
  const root = asObj(data);
  if (!root || root.app !== 'rc-pilecap-wsd') return 'ไม่ใช่ไฟล์โครงการฐานรากเสาเข็มของโปรแกรมนี้';
  const raw = asObj(root.input);
  if (!raw) return 'ไฟล์ไม่มีข้อมูลนำเข้า';
  const input = { ...DEFAULT_PILECAP, offsets: noOffsets() } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PILECAP) as (keyof PileCapInput)[]) {
    if (!(key in raw) || key === 'offsets') continue;
    if (typeof raw[key] !== typeof DEFAULT_PILECAP[key]) return `ข้อมูล ${key} ไม่ถูกต้อง`;
    input[key] = raw[key];
  }
  if (Array.isArray(raw.offsets)) {
    const offsets = noOffsets();
    for (let i = 0; i < Math.min(K.maxPiles, raw.offsets.length); i++) {
      const o = asObj(raw.offsets[i]);
      if (!o || typeof o.dx !== 'number' || typeof o.dy !== 'number') return 'ข้อมูลระยะเยื้องเสาเข็มไม่ถูกต้อง';
      offsets[i] = { dx: o.dx, dy: o.dy };
    }
    input.offsets = offsets;
  }
  if (!isBarName(input.bar)) return 'ขนาดเหล็กในไฟล์ไม่ถูกต้อง';
  const enumOk = (list: readonly string[], v: unknown) => list.includes(v as string);
  if (!enumOk(PILE_SHAPES, input.pileShape) || !enumOk(AUTO_MODES, input.countMode) || !enumOk(AUTO_MODES, input.thicknessMode)) {
    return 'รูปแบบเสาเข็มหรือการออกแบบในไฟล์ไม่ถูกต้อง';
  }
  if (!isLayout(root.layout)) return 'รูปแบบเหล็กเสริมในไฟล์ไม่ถูกต้อง';
  return { app: 'rc-pilecap-wsd', version: 1, input: input as unknown as PileCapInput, layout: root.layout, edited: root.edited === true };
}

interface PileCapState {
  input: PileCapInput;
  layout: FootingLayout;
  edited: boolean;
  setInput: (patch: Partial<PileCapInput>) => void;
  setOffset: (index: number, patch: Partial<PileOffset>) => void;
  editLayout: (fn: (layout: FootingLayout) => FootingLayout) => void;
  redesign: () => void;
  resetProject: () => void;
  loadProject: (data: unknown) => string | null;
}

export const usePileCapStore = create<PileCapState>()(
  (set, get) => ({
    input: DEFAULT_PILECAP,
    layout: design(DEFAULT_PILECAP, null, false),
    edited: false,
    setInput: (patch) => {
      const { input, layout, edited } = get();
      const next = { ...input, ...patch };
      set({ input: next, layout: design(next, layout, edited) });
    },
    setOffset: (index, patch) => {
      const offsets = get().input.offsets.map((o, i) => (i === index ? { ...o, ...patch } : o));
      get().setInput({ offsets });
    },
    editLayout: (fn) => set({ layout: fn(get().layout), edited: true }),
    redesign: () => set({ edited: false, layout: design(get().input, null, false) }),
    resetProject: () => set({ input: DEFAULT_PILECAP, edited: false, layout: design(DEFAULT_PILECAP, null, false) }),
    loadProject: (data) => {
      const result = parsePileCapProject(data);
      if (typeof result === 'string') return result;
      set({ input: result.input, layout: result.layout, edited: result.edited });
      return null;
    },
}));

export function toPileCapProjectFile(s: Pick<PileCapState, 'input' | 'layout' | 'edited'>): PileCapProjectFile {
  return { app: 'rc-pilecap-wsd', version: 1, input: s.input, layout: s.layout, edited: s.edited };
}
