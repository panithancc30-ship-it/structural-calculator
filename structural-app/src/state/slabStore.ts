import { create } from 'zustand';
import type { BarDir } from '@/engine/concrete/footing/types';
import { isBarName } from '@/engine/concrete/rebar';
import { autoSlabLayout, slabDims } from '@/engine/concrete/slab/designSlab';
import type { BarRun, SlabInput, SlabLayout } from '@/engine/concrete/slab/types';
import { EDGE_SUPPORTS, GROUND_USAGES, SIZE_MODES, SLAB_TYPES, validateSlabInput } from '@/engine/concrete/slab/validate';
import type { Face } from '@/engine/concrete/types';

export const DEFAULT_SLAB: SlabInput = {
  projectName: 'โครงการทดสอบ',
  slabName: 'S1',
  designer: '',
  slabType: 'twoWay',
  lx: 400,
  ly: 500,
  edgeX1: 'continuous',
  edgeX2: 'continuous',
  edgeY1: 'continuous',
  edgeY2: 'continuous',
  thicknessMode: 'auto',
  t: 12,
  cover: 2,
  fc: 240,
  fy: 4000,
  finishDL: 150,
  LL: 300,
  usage: 'light',
  bar: 'DB12',
  tempBar: 'RB9',
};

function design(input: SlabInput, prev: SlabLayout | null, edited: boolean): SlabLayout {
  if (validateSlabInput(input).length > 0) return prev ?? autoSlabLayout(DEFAULT_SLAB, slabDims(DEFAULT_SLAB));
  if (edited && prev) return prev;
  return autoSlabLayout(input, slabDims(input));
}

export interface SlabProjectFile {
  app: 'rc-slab-wsd';
  version: 1;
  input: SlabInput;
  layout: SlabLayout;
  edited: boolean;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);

const isRun = (v: unknown): v is BarRun => {
  const o = asObj(v);
  return !!o && isBarName(o.size) && typeof o.spacing === 'number' && o.spacing > 0;
};
const isRunOrNull = (v: unknown) => v === null || isRun(v);
const isFaceRuns = (v: unknown) => {
  const o = asObj(v);
  return !!o && isRunOrNull(o.x) && isRunOrNull(o.y);
};
const isDir = (v: unknown) => v === 'x' || v === 'y';

function isSlabLayout(value: unknown): value is SlabLayout {
  const v = asObj(value);
  if (!v || !isFaceRuns(v.bottom) || !isFaceRuns(v.top)) return false;
  const outer = asObj(v.outerLayer);
  return !!outer && isDir(outer.bottom) && isDir(outer.top);
}

export function parseSlabProject(data: unknown): SlabProjectFile | string {
  const root = asObj(data);
  if (!root || root.app !== 'rc-slab-wsd') return 'ไม่ใช่ไฟล์โครงการพื้นของโปรแกรมนี้';
  const raw = asObj(root.input);
  if (!raw) return 'ไฟล์ไม่มีข้อมูลนำเข้า';

  const input = { ...DEFAULT_SLAB } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SLAB) as (keyof SlabInput)[]) {
    if (key in raw) {
      if (typeof raw[key] !== typeof DEFAULT_SLAB[key]) return `ข้อมูล ${key} ไม่ถูกต้อง`;
      input[key] = raw[key];
    }
  }
  if (!isBarName(input.bar) || !isBarName(input.tempBar)) return 'ขนาดเหล็กในไฟล์ไม่ถูกต้อง';

  const enumOk = (list: readonly string[], v: unknown) => list.includes(v as string);
  if (
    !enumOk(SLAB_TYPES, input.slabType) ||
    !enumOk(SIZE_MODES, input.thicknessMode) ||
    !enumOk(GROUND_USAGES, input.usage) ||
    !([input.edgeX1, input.edgeX2, input.edgeY1, input.edgeY2] as unknown[]).every((e) => enumOk(EDGE_SUPPORTS, e))
  ) {
    return 'ชนิดพื้นหรือสภาพขอบในไฟล์ไม่ถูกต้อง';
  }
  if (!isSlabLayout(root.layout)) return 'รูปแบบเหล็กเสริมในไฟล์ไม่ถูกต้อง';

  return {
    app: 'rc-slab-wsd',
    version: 1,
    input: input as unknown as SlabInput,
    layout: root.layout,
    edited: root.edited === true,
  };
}

interface SlabState {
  input: SlabInput;
  layout: SlabLayout;
  edited: boolean;
  setInput: (patch: Partial<SlabInput>) => void;
  editLayout: (fn: (layout: SlabLayout) => SlabLayout) => void;
  redesign: () => void;
  resetProject: () => void;
  loadProject: (data: unknown) => string | null;
}

export const useSlabStore = create<SlabState>()((set, get) => ({
  input: DEFAULT_SLAB,
  layout: design(DEFAULT_SLAB, null, false),
  edited: false,
  setInput: (patch) => {
    const { input, layout, edited } = get();
    const next = { ...input, ...patch };
    set({ input: next, layout: design(next, layout, edited) });
  },
  editLayout: (fn) => set({ layout: fn(get().layout), edited: true }),
  redesign: () => set({ edited: false, layout: design(get().input, null, false) }),
  resetProject: () => set({ input: DEFAULT_SLAB, edited: false, layout: design(DEFAULT_SLAB, null, false) }),
  loadProject: (data) => {
    const result = parseSlabProject(data);
    if (typeof result === 'string') return result;
    set({ input: result.input, layout: result.layout, edited: result.edited });
    return null;
  },
}));

export function toSlabProjectFile(s: Pick<SlabState, 'input' | 'layout' | 'edited'>): SlabProjectFile {
  return { app: 'rc-slab-wsd', version: 1, input: s.input, layout: s.layout, edited: s.edited };
}

/** ผิว/ทิศที่กำลังเลือกอยู่ในรูป — ใช้ร่วมกันระหว่างรูปวาดกับ popover */
export interface SlabPickTarget {
  face: Face;
  dir: BarDir;
}
