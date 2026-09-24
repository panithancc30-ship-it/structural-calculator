import { create } from 'zustand';
import { autoLayout } from '@/engine/concrete/design/designBeam';
import { faceArea } from '@/engine/concrete/layoutOps';
import { isBarName } from '@/engine/concrete/rebar';
import type { BeamInput, SectionKey, SectionLayout } from '@/engine/concrete/types';
import { validateInput } from '@/engine/concrete/validate';

export type Layouts = Record<SectionKey, SectionLayout>;
export type Edited = Record<SectionKey, boolean>;

export const DEFAULT_INPUT: BeamInput = {
  projectName: 'โครงการทดสอบ',
  beamName: 'B1',
  designer: '',
  b: 25,
  h: 50,
  L: 5,
  cover: 3,
  fc: 240,
  fy: 4000,
  fyv: 2400,
  M: 8000,
  V: 6000,
  T: 500,
  mainBar: 'DB16',
  stirrupBar: 'RB9',
  stirrupMode: 'auto',
  sMin: 10,
  support: 'bothEnds',
};

const NOT_EDITED: Edited = { A: false, B: false };

/** ออกแบบใหม่เฉพาะหน้าตัดที่ไม่ได้แก้ไขเอง (B ขึ้นกับเหล็กล่างของ A) */
function design(input: BeamInput, prev: Layouts | null, edited: Edited): Layouts {
  if (validateInput(input).length > 0) return prev ?? design(DEFAULT_INPUT, null, NOT_EDITED);
  const A = edited.A && prev ? prev.A : autoLayout(input, 'A');
  const B = edited.B && prev ? prev.B : autoLayout(input, 'B', { bottomAsAtA: faceArea(A, 'bottom') });
  return { A, B };
}

export interface ProjectFile {
  app: 'rc-beam-wsd';
  version: 1;
  input: BeamInput;
  layouts: Layouts;
  edited: Edited;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);

function isLayout(value: unknown): value is SectionLayout {
  const v = asObj(value);
  if (!v) return false;
  const layers = (x: unknown) =>
    Array.isArray(x) &&
    x.every((l) => {
      const layer = asObj(l);
      return (
        typeof layer?.id === 'string' &&
        Array.isArray(layer.bars) &&
        layer.bars.every((b) => typeof asObj(b)?.id === 'string' && isBarName(asObj(b)?.size))
      );
    });
  const side = Array.isArray(v.side) && v.side.every((r) => typeof asObj(r)?.id === 'string' && isBarName(asObj(r)?.size));
  const st = asObj(v.stirrup);
  return (
    layers(v.top) &&
    layers(v.bottom) &&
    side &&
    !!st &&
    isBarName(st.size) &&
    (st.count === 1 || st.count === 2) &&
    typeof st.spacing === 'number' &&
    st.spacing > 0
  );
}

export function parseProject(data: unknown): ProjectFile | string {
  const root = asObj(data);
  if (!root || root.app !== 'rc-beam-wsd') return 'ไม่ใช่ไฟล์โครงการของโปรแกรมนี้';
  const rawInput = asObj(root.input);
  if (!rawInput) return 'ไฟล์ไม่มีข้อมูลนำเข้า';
  const input = { ...DEFAULT_INPUT } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_INPUT) as (keyof BeamInput)[]) {
    if (key in rawInput) {
      if (typeof rawInput[key] !== typeof DEFAULT_INPUT[key]) return `ข้อมูล ${key} ไม่ถูกต้อง`;
      input[key] = rawInput[key];
    }
  }
  if (!isBarName(input.mainBar) || !isBarName(input.stirrupBar)) return 'ขนาดเหล็กในไฟล์ไม่ถูกต้อง';
  const layouts = asObj(root.layouts);
  if (!layouts || !isLayout(layouts.A) || !isLayout(layouts.B)) return 'รูปแบบเหล็กเสริมในไฟล์ไม่ถูกต้อง';
  const edited = asObj(root.edited);
  return {
    app: 'rc-beam-wsd',
    version: 1,
    input: input as unknown as BeamInput,
    layouts: { A: layouts.A, B: layouts.B },
    edited: { A: edited?.A === true, B: edited?.B === true },
  };
}

interface AppState {
  input: BeamInput;
  layouts: Layouts;
  edited: Edited;
  setInput: (patch: Partial<BeamInput>) => void;
  editLayout: (key: SectionKey, fn: (layout: SectionLayout) => SectionLayout) => void;
  redesign: (key?: SectionKey) => void;
  resetProject: () => void;
  loadProject: (data: unknown) => string | null;
}

export const useStore = create<AppState>()(
  (set, get) => ({
    input: DEFAULT_INPUT,
    layouts: design(DEFAULT_INPUT, null, NOT_EDITED),
    edited: NOT_EDITED,

    setInput: (patch) => {
      const { input, layouts, edited } = get();
      const next = { ...input, ...patch };
      set({ input: next, layouts: design(next, layouts, edited) });
    },

    editLayout: (key, fn) => {
      const { input, layouts, edited } = get();
      const nextEdited = { ...edited, [key]: true };
      const nextLayouts = { ...layouts, [key]: fn(layouts[key]) };
      // B-B ยังออกแบบอัตโนมัติ → อัปเดตตามเหล็กล่างของ A-A ที่แก้
      set({
        edited: nextEdited,
        layouts: key === 'A' && !edited.B ? design(input, nextLayouts, nextEdited) : nextLayouts,
      });
    },

    redesign: (key) => {
      const { input, layouts, edited } = get();
      const nextEdited = key ? { ...edited, [key]: false } : NOT_EDITED;
      set({ edited: nextEdited, layouts: design(input, layouts, nextEdited) });
    },

    resetProject: () =>
      set({ input: DEFAULT_INPUT, edited: NOT_EDITED, layouts: design(DEFAULT_INPUT, null, NOT_EDITED) }),

    loadProject: (data) => {
      const result = parseProject(data);
      if (typeof result === 'string') return result;
      set({ input: result.input, layouts: result.layouts, edited: result.edited });
      return null;
    },
}));

export function toProjectFile(s: Pick<AppState, 'input' | 'layouts' | 'edited'>): ProjectFile {
  return { app: 'rc-beam-wsd', version: 1, input: s.input, layouts: s.layouts, edited: s.edited };
}
