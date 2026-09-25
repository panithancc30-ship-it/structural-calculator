import { create } from 'zustand';
import { designLedge, type LedgeLayouts } from '@/engine/concrete/ledge/analyzeLedge';
import { LEDGE_SUPPORTS, type LedgeBeamInput } from '@/engine/concrete/ledge/types';
import { validateLedgeInput } from '@/engine/concrete/ledge/validate';
import { isBarName } from '@/engine/concrete/rebar';
import type { SectionKey, SectionLayout } from '@/engine/concrete/types';
import { isLayout } from './store';

type Edited = Record<SectionKey, boolean>;

/**
 * ค่าเริ่มต้น: ระเบียงบ้านพักอาศัย ยื่น 1.00 ม. หนา 10 ซม. ปูกระเบื้อง มีผนังอิฐมอญกันตกสูง 1.00 ม. ที่ปลาย
 * น้ำหนักตามหน้า Design Criteria — ปูผิว 120, ที่พักอาศัย 150 กก./ตร.ม., ผนังอิฐมอญ 180 กก./ตร.ม.
 */
export const DEFAULT_LEDGE: LedgeBeamInput = {
  slabLength: 1,
  slabT: 10,
  finishDL: 120,
  LL: 150,
  tipWallH: 1,
  tipWallW: 180,
  beamWallH: 0,
  beamWallW: 180,
  otherLoad: 0,
  b: 20,
  h: 50,
  L: 4,
  support: 'simple',
  cover: 3,
  fc: 240,
  fy: 4000,
  fyv: 2400,
  mainBar: 'DB12',
  stirrupBar: 'RB9',
  stirrupMode: 'auto',
  sMin: 10,
};

const NOT_EDITED: Edited = { A: false, B: false };
const STIRRUP_MODES = ['auto', 'single', 'double'];

/** ออกแบบใหม่เฉพาะหน้าตัดที่ไม่ได้แก้เอง — ข้อมูลไม่ครบให้คงเหล็กเดิมไว้ */
function design(input: LedgeBeamInput, prev: LedgeLayouts | null, edited: Edited): LedgeLayouts {
  if (validateLedgeInput(input).length > 0) return prev ?? designLedge(DEFAULT_LEDGE);
  return designLedge(input, prev, edited);
}

export interface LedgeProjectFile {
  app: 'rc-ledge-beam-wsd';
  version: 1;
  input: LedgeBeamInput;
  layouts: LedgeLayouts;
  edited: Edited;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);

export function parseLedgeProject(data: unknown): LedgeProjectFile | string {
  const root = asObj(data);
  if (!root || root.app !== 'rc-ledge-beam-wsd') return 'ไม่ใช่ไฟล์โครงการคานรับพื้นยื่นของโปรแกรมนี้';
  const raw = asObj(root.input);
  if (!raw) return 'ไฟล์ไม่มีข้อมูลนำเข้า';

  const input = { ...DEFAULT_LEDGE } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_LEDGE) as (keyof LedgeBeamInput)[]) {
    if (key in raw) {
      if (typeof raw[key] !== typeof DEFAULT_LEDGE[key]) return `ข้อมูล ${key} ไม่ถูกต้อง`;
      input[key] = raw[key];
    }
  }
  if (!isBarName(input.mainBar) || !isBarName(input.stirrupBar)) return 'ขนาดเหล็กในไฟล์ไม่ถูกต้อง';
  if (!LEDGE_SUPPORTS.includes(input.support as LedgeBeamInput['support']) || !STIRRUP_MODES.includes(input.stirrupMode as string)) {
    return 'สภาพรองรับหรือรูปแบบเหล็กปลอกในไฟล์ไม่ถูกต้อง';
  }
  const layouts = asObj(root.layouts);
  if (!layouts || !isLayout(layouts.A) || !isLayout(layouts.B)) return 'รูปแบบเหล็กเสริมในไฟล์ไม่ถูกต้อง';
  const edited = asObj(root.edited);

  return {
    app: 'rc-ledge-beam-wsd',
    version: 1,
    input: input as unknown as LedgeBeamInput,
    layouts: { A: layouts.A, B: layouts.B },
    edited: { A: edited?.A === true, B: edited?.B === true },
  };
}

interface LedgeState {
  input: LedgeBeamInput;
  layouts: LedgeLayouts;
  edited: Edited;
  setInput: (patch: Partial<LedgeBeamInput>) => void;
  editLayout: (key: SectionKey, fn: (layout: SectionLayout) => SectionLayout) => void;
  redesign: (key?: SectionKey) => void;
  resetProject: () => void;
  loadProject: (data: unknown) => string | null;
}

export const useLedgeStore = create<LedgeState>()((set, get) => ({
  input: DEFAULT_LEDGE,
  layouts: design(DEFAULT_LEDGE, null, NOT_EDITED),
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
    set({ input: DEFAULT_LEDGE, edited: NOT_EDITED, layouts: design(DEFAULT_LEDGE, null, NOT_EDITED) }),

  loadProject: (data) => {
    const result = parseLedgeProject(data);
    if (typeof result === 'string') return result;
    set({ input: result.input, layouts: result.layouts, edited: result.edited });
    return null;
  },
}));

export function toLedgeProjectFile(s: Pick<LedgeState, 'input' | 'layouts' | 'edited'>): LedgeProjectFile {
  return { app: 'rc-ledge-beam-wsd', version: 1, input: s.input, layouts: s.layouts, edited: s.edited };
}
