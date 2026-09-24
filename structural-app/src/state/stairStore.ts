import { create } from 'zustand';
import { isBarName } from '@/engine/concrete/rebar';
import type { BarRun } from '@/engine/concrete/slab/types';
import { autoStairLayout, stairDims } from '@/engine/concrete/stair/designStair';
import { STAIR_BAR_KEYS, type StairInput, type StairLayout } from '@/engine/concrete/stair/types';
import {
  SIZE_MODES,
  STAIR_ASCENDS,
  STAIR_ENDS,
  STAIR_USAGES,
  validateStairInput,
} from '@/engine/concrete/stair/validate';

/** ค่าเริ่มต้นตรงกับแบบตัวอย่างบันไดช่วงชานพัก – ชั้น 2 (8 ลูกตั้ง @0.175, ช่วงราบ 3.50 ม.) */
export const DEFAULT_STAIR: StairInput = {
  projectName: 'โครงการทดสอบ',
  stairName: 'ST1',
  levels: 'ชานพัก – ชั้น 2',
  designer: '',
  usage: 'residential',
  riser: 17.5,
  tread: 25,
  risers: 8,
  landingLow: 115,
  landingHigh: 60,
  width: 120,
  endLow: 'simple',
  endHigh: 'simple',
  ascend: 'right',
  thicknessMode: 'auto',
  t: 15,
  cover: 2,
  fc: 240,
  fy: 4000,
  finishDL: 150,
  LL: 300,
  bar: 'DB12',
  tempBar: 'RB9',
};

function design(input: StairInput, prev: StairLayout | null, edited: boolean): StairLayout {
  if (validateStairInput(input).length > 0) return prev ?? autoStairLayout(DEFAULT_STAIR, stairDims(DEFAULT_STAIR));
  if (edited && prev) return prev;
  return autoStairLayout(input, stairDims(input));
}

export interface StairProjectFile {
  app: 'rc-stair-wsd';
  version: 1;
  input: StairInput;
  layout: StairLayout;
  edited: boolean;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);

const isRun = (v: unknown): v is BarRun => {
  const o = asObj(v);
  return !!o && isBarName(o.size) && typeof o.spacing === 'number' && o.spacing > 0;
};

function isStairLayout(value: unknown): value is StairLayout {
  const v = asObj(value);
  return !!v && STAIR_BAR_KEYS.every((key) => v[key] === null || isRun(v[key]));
}

export function parseStairProject(data: unknown): StairProjectFile | string {
  const root = asObj(data);
  if (!root || root.app !== 'rc-stair-wsd') return 'ไม่ใช่ไฟล์โครงการบันไดของโปรแกรมนี้';
  const raw = asObj(root.input);
  if (!raw) return 'ไฟล์ไม่มีข้อมูลนำเข้า';

  const input = { ...DEFAULT_STAIR } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_STAIR) as (keyof StairInput)[]) {
    if (key in raw) {
      if (typeof raw[key] !== typeof DEFAULT_STAIR[key]) return `ข้อมูล ${key} ไม่ถูกต้อง`;
      input[key] = raw[key];
    }
  }
  if (!isBarName(input.bar) || !isBarName(input.tempBar)) return 'ขนาดเหล็กในไฟล์ไม่ถูกต้อง';

  const enumOk = (list: readonly string[], v: unknown) => list.includes(v as string);
  if (
    !enumOk(STAIR_ENDS, input.endLow) ||
    !enumOk(STAIR_ENDS, input.endHigh) ||
    !enumOk(STAIR_ASCENDS, input.ascend) ||
    !enumOk(STAIR_USAGES, input.usage) ||
    !enumOk(SIZE_MODES, input.thicknessMode)
  ) {
    return 'สภาพปลายหรือตัวเลือกในไฟล์ไม่ถูกต้อง';
  }
  if (!isStairLayout(root.layout)) return 'รูปแบบเหล็กเสริมในไฟล์ไม่ถูกต้อง';

  return {
    app: 'rc-stair-wsd',
    version: 1,
    input: input as unknown as StairInput,
    layout: root.layout,
    edited: root.edited === true,
  };
}

interface StairState {
  input: StairInput;
  layout: StairLayout;
  edited: boolean;
  setInput: (patch: Partial<StairInput>) => void;
  editLayout: (fn: (layout: StairLayout) => StairLayout) => void;
  redesign: () => void;
  resetProject: () => void;
  loadProject: (data: unknown) => string | null;
}

export const useStairStore = create<StairState>()((set, get) => ({
  input: DEFAULT_STAIR,
  layout: design(DEFAULT_STAIR, null, false),
  edited: false,
  setInput: (patch) => {
    const { input, layout, edited } = get();
    const next = { ...input, ...patch };
    set({ input: next, layout: design(next, layout, edited) });
  },
  editLayout: (fn) => set({ layout: fn(get().layout), edited: true }),
  redesign: () => set({ edited: false, layout: design(get().input, null, false) }),
  resetProject: () => set({ input: DEFAULT_STAIR, edited: false, layout: design(DEFAULT_STAIR, null, false) }),
  loadProject: (data) => {
    const result = parseStairProject(data);
    if (typeof result === 'string') return result;
    set({ input: result.input, layout: result.layout, edited: result.edited });
    return null;
  },
}));

export function toStairProjectFile(s: Pick<StairState, 'input' | 'layout' | 'edited'>): StairProjectFile {
  return { app: 'rc-stair-wsd', version: 1, input: s.input, layout: s.layout, edited: s.edited };
}
