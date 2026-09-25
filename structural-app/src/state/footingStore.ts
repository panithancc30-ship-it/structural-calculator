import { create } from 'zustand';
import { autoFootingLayout, footingDims } from '@/engine/concrete/footing/designFooting';
import type { FootingInput, FootingLayout } from '@/engine/concrete/footing/types';
import { CORNER_SIDES, EDGE_SIDES, POSITIONS, SIZE_MODES, validateFootingInput } from '@/engine/concrete/footing/validate';
import { isBarName } from '@/engine/concrete/rebar';

export const DEFAULT_FOOTING: FootingInput = {
  footingName: 'F1',
  cx: 30,
  cy: 30,
  position: 'center',
  ex: 0,
  ey: 0,
  edgeSide: 'left',
  cornerSide: 'bottom-left',
  edgeGap: 0,
  sizeMode: 'auto',
  B: 150,
  L: 150,
  t: 40,
  cover: 7.5,
  Df: 1.5,
  qa: 15,
  gammaSoil: 1.8,
  fc: 240,
  fy: 4000,
  P: 40000,
  Mx: 0,
  My: 0,
  bar: 'DB16',
};

function design(input: FootingInput, prev: FootingLayout | null, edited: boolean): FootingLayout {
  if (validateFootingInput(input).length > 0) return prev ?? autoFootingLayout(DEFAULT_FOOTING, footingDims(DEFAULT_FOOTING));
  if (edited && prev) return prev;
  return autoFootingLayout(input, footingDims(input));
}

export interface FootingProjectFile {
  app: 'rc-footing-wsd';
  version: 1;
  input: FootingInput;
  layout: FootingLayout;
  edited: boolean;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);
const isBarSet = (v: unknown) => {
  const o = asObj(v);
  return !!o && isBarName(o.size) && Number.isInteger(o.count) && (o.count as number) >= 2;
};

function isFootingLayout(value: unknown): value is FootingLayout {
  const v = asObj(value);
  return !!v && isBarSet(v.x) && isBarSet(v.y) && (v.bottom === 'x' || v.bottom === 'y');
}

export function parseFootingProject(data: unknown): FootingProjectFile | string {
  const root = asObj(data);
  if (!root || root.app !== 'rc-footing-wsd') return 'ไม่ใช่ไฟล์โครงการฐานรากของโปรแกรมนี้';
  const raw = asObj(root.input);
  if (!raw) return 'ไฟล์ไม่มีข้อมูลนำเข้า';
  const input = { ...DEFAULT_FOOTING } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_FOOTING) as (keyof FootingInput)[]) {
    if (key in raw) {
      if (typeof raw[key] !== typeof DEFAULT_FOOTING[key]) return `ข้อมูล ${key} ไม่ถูกต้อง`;
      input[key] = raw[key];
    }
  }
  if (!isBarName(input.bar)) return 'ขนาดเหล็กในไฟล์ไม่ถูกต้อง';
  const enumOk = (list: readonly string[], v: unknown) => list.includes(v as string);
  if (
    !enumOk(POSITIONS, input.position) || !enumOk(EDGE_SIDES, input.edgeSide) ||
    !enumOk(CORNER_SIDES, input.cornerSide) || !enumOk(SIZE_MODES, input.sizeMode)
  ) {
    return 'ตำแหน่งเสาหรือรูปแบบขนาดฐานรากในไฟล์ไม่ถูกต้อง';
  }
  if (!isFootingLayout(root.layout)) return 'รูปแบบเหล็กเสริมในไฟล์ไม่ถูกต้อง';
  return { app: 'rc-footing-wsd', version: 1, input: input as unknown as FootingInput, layout: root.layout, edited: root.edited === true };
}

interface FootingState {
  input: FootingInput;
  layout: FootingLayout;
  edited: boolean;
  setInput: (patch: Partial<FootingInput>) => void;
  editLayout: (fn: (layout: FootingLayout) => FootingLayout) => void;
  redesign: () => void;
  resetProject: () => void;
  loadProject: (data: unknown) => string | null;
}

export const useFootingStore = create<FootingState>()(
  (set, get) => ({
    input: DEFAULT_FOOTING,
    layout: design(DEFAULT_FOOTING, null, false),
    edited: false,
    setInput: (patch) => {
      const { input, layout, edited } = get();
      const next = { ...input, ...patch };
      set({ input: next, layout: design(next, layout, edited) });
    },
    editLayout: (fn) => set({ layout: fn(get().layout), edited: true }),
    redesign: () => set({ edited: false, layout: design(get().input, null, false) }),
    resetProject: () => set({ input: DEFAULT_FOOTING, edited: false, layout: design(DEFAULT_FOOTING, null, false) }),
    loadProject: (data) => {
      const result = parseFootingProject(data);
      if (typeof result === 'string') return result;
      set({ input: result.input, layout: result.layout, edited: result.edited });
      return null;
    },
}));

export function toFootingProjectFile(s: Pick<FootingState, 'input' | 'layout' | 'edited'>): FootingProjectFile {
  return { app: 'rc-footing-wsd', version: 1, input: s.input, layout: s.layout, edited: s.edited };
}
