import { create } from 'zustand';
import { autoColumnLayout } from '@/engine/concrete/column/designColumn';
import type { ColumnInput, ColumnLayout } from '@/engine/concrete/column/types';
import { validateColumnInput } from '@/engine/concrete/column/validate';
import { isBarName } from '@/engine/concrete/rebar';

export const DEFAULT_COLUMN: ColumnInput = {
  projectName: 'โครงการทดสอบ',
  columnName: 'C1',
  designer: '',
  shape: 'rect',
  b: 30,
  h: 30,
  D: 40,
  cover: 3.5,
  Lu: 3,
  fc: 240,
  fy: 4000,
  fyv: 2400,
  P: 40000,
  Mx: 2000,
  My: 1000,
  mainBar: 'DB16',
  tieBar: 'RB9',
};

function design(input: ColumnInput, prev: ColumnLayout | null, edited: boolean): ColumnLayout {
  if (validateColumnInput(input).length > 0) return prev ?? autoColumnLayout(DEFAULT_COLUMN);
  const kind = input.shape === 'rect' ? 'rect' : 'circle';
  if (edited && prev && prev.kind === kind) return prev;
  return autoColumnLayout(input);
}

export interface ColumnProjectFile {
  app: 'rc-column-wsd';
  version: 1;
  input: ColumnInput;
  layout: ColumnLayout;
  edited: boolean;
}

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null => (typeof v === 'object' && v !== null ? (v as Obj) : null);
const isBarList = (v: unknown) =>
  Array.isArray(v) && v.every((b) => typeof asObj(b)?.id === 'string' && isBarName(asObj(b)?.size));

function isColumnLayout(value: unknown): value is ColumnLayout {
  const v = asObj(value);
  const tie = asObj(v?.tie);
  if (!v || !tie || !isBarName(tie.size) || typeof tie.spacing !== 'number' || tie.spacing <= 0) return false;
  if (v.kind === 'circle') return isBarList(v.bars);
  return (
    v.kind === 'rect' &&
    isBarList(v.corners) &&
    (v.corners as unknown[]).length === 4 &&
    isBarList(v.top) && isBarList(v.bottom) && isBarList(v.left) && isBarList(v.right)
  );
}

export function parseColumnProject(data: unknown): ColumnProjectFile | string {
  const root = asObj(data);
  if (!root || root.app !== 'rc-column-wsd') return 'ไม่ใช่ไฟล์โครงการเสาของโปรแกรมนี้';
  const raw = asObj(root.input);
  if (!raw) return 'ไฟล์ไม่มีข้อมูลนำเข้า';
  const input = { ...DEFAULT_COLUMN } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_COLUMN) as (keyof ColumnInput)[]) {
    if (key in raw) {
      if (typeof raw[key] !== typeof DEFAULT_COLUMN[key]) return `ข้อมูล ${key} ไม่ถูกต้อง`;
      input[key] = raw[key];
    }
  }
  if (!isBarName(input.mainBar) || !isBarName(input.tieBar)) return 'ขนาดเหล็กในไฟล์ไม่ถูกต้อง';
  if (input.shape !== 'rect' && input.shape !== 'circle') return 'รูปทรงเสาไม่ถูกต้อง';
  if (!isColumnLayout(root.layout)) return 'รูปแบบเหล็กเสริมในไฟล์ไม่ถูกต้อง';
  return { app: 'rc-column-wsd', version: 1, input: input as unknown as ColumnInput, layout: root.layout, edited: root.edited === true };
}

interface ColumnState {
  input: ColumnInput;
  layout: ColumnLayout;
  edited: boolean;
  setInput: (patch: Partial<ColumnInput>) => void;
  editLayout: (fn: (layout: ColumnLayout) => ColumnLayout) => void;
  redesign: () => void;
  resetProject: () => void;
  loadProject: (data: unknown) => string | null;
}

export const useColumnStore = create<ColumnState>()(
  (set, get) => ({
    input: DEFAULT_COLUMN,
    layout: design(DEFAULT_COLUMN, null, false),
    edited: false,
    setInput: (patch) => {
      const { input, layout, edited } = get();
      const next = { ...input, ...patch };
      const nextLayout = design(next, layout, edited);
      set({ input: next, layout: nextLayout, edited: edited && nextLayout === layout });
    },
    editLayout: (fn) => set({ layout: fn(get().layout), edited: true }),
    redesign: () => set({ edited: false, layout: design(get().input, null, false) }),
    resetProject: () => set({ input: DEFAULT_COLUMN, edited: false, layout: design(DEFAULT_COLUMN, null, false) }),
    loadProject: (data) => {
      const result = parseColumnProject(data);
      if (typeof result === 'string') return result;
      set({ input: result.input, layout: result.layout, edited: result.edited });
      return null;
    },
}));

export function toColumnProjectFile(s: Pick<ColumnState, 'input' | 'layout' | 'edited'>): ColumnProjectFile {
  return { app: 'rc-column-wsd', version: 1, input: s.input, layout: s.layout, edited: s.edited };
}
