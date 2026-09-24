import type { SteelColumnInput } from '@/engine/steel/columnASD'
import { DEFAULT_SECTION_SELECTION } from '../steel-beam/steelBeamDefaults'
import type { SectionCategory } from '@/engine/steel/sectionTable'

export const DEFAULT_STEEL_COLUMN_INPUT: SteelColumnInput = {
  axial: 40000,
  momentX: 1500,
  momentY: 0,
  shear: 1000,
  lengthX: 4,
  lengthY: 4,
  Kx: 1,
  Ky: 1,
  Cmx: 0.85,
  Cmy: 0.85,
  Cb: 1,
  section: { ...DEFAULT_SECTION_SELECTION, sectionId: 'h-wide:H200×200×8×12' },
}

export const DEFAULT_COLUMN_SUGGEST_CATEGORIES: SectionCategory[] = ['h-wide', 'h-narrow']
