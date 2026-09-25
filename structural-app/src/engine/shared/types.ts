export type CheckStatus = 'pass' | 'fail' | 'warn'

export interface CalcStep {
  symbol: string
  label: string
  formula?: string
  substitution?: string
  value: number
  unit: string
  decimals?: number
}

export interface CheckItem {
  id: string
  label: string
  actualSymbol: string
  actual: number
  allowableSymbol: string
  allowable: number
  unit: string
  ratio: number
  status: CheckStatus
  formula?: string
  substitution?: string
  note?: string
}

/** รูปทรงหน้าตัดเหล็กที่โปรแกรมวาดรูปตัดได้ */
export type SteelShapeFamily =
  | 'i-shape'
  | 'channel'
  | 'lipped-channel'
  | 'hat'
  | 'angle'
  | 'box'
  | 'pipe'
  | 'plate'
  | 'built-up'
  | 'custom'

/** รูปแบบการประกอบหน้าตัดจากเหล็กสองท่อน */
export type SteelArrangement = 'single' | '2c-back' | '2c-box' | '2l-back' | '2tube'

export interface SteelDetailing {
  kind: 'steel'
  sectionName: string
  categoryLabel: string
  gradeLabel: string
  family: SteelShapeFamily
  arrangement: SteelArrangement
  /** ระยะห่างระหว่างสองท่อนของหน้าตัดประกอบ (ซม.) */
  gap: number
  /** θs — มุมหมุนหน้าตัด (องศา) ใช้วาดรูปตัดให้เอียงตามจริง */
  sectionAngle: number
  /** θm — มุมเอียงของชิ้นส่วน (องศา) */
  memberAngle: number
  d: number
  bf: number
  tw: number
  tf: number
  lip?: number
  cornerRadius?: number
  /** ความกว้างสันของแปหมวก (ซม.) */
  crown?: number
  /** ระยะห่างเอวที่ฐานของแปหมวก (ซม.) */
  webBottom?: number
}

export type MemberDetailing = SteelDetailing

export interface CalcResult<TInput, TDetailing extends MemberDetailing> {
  input: TInput
  steps: CalcStep[]
  checks: CheckItem[]
  overall: CheckStatus
  detailing: TDetailing
}

/** ชนิดรายการคำนวณที่โปรแกรมรองรับ */
export const CALC_SHEET_KINDS = [
  'steel-beam',
  'steel-column',
  'concrete-beam',
  'concrete-ledge-beam',
  'concrete-column',
  'concrete-footing',
  'concrete-pilecap',
  'concrete-slab',
  'concrete-stair',
] as const

export type CalcSheetKind = (typeof CALC_SHEET_KINDS)[number]

export function isSupportedKind(kind: string): kind is CalcSheetKind {
  return (CALC_SHEET_KINDS as readonly string[]).includes(kind)
}

export interface CalcSheet {
  id: string
  projectId: string
  kind: CalcSheetKind
  title: string
  order: number
  input: unknown
  remarks: string
  createdAt: number
  updatedAt: number
}

export interface Project {
  id: string
  name: string
  location: string
  owner: string
  engineerName: string
  engineerLicense: string
  checkerName: string
  checkerLicense: string
  documentDate: string
  scope: string
  createdAt: number
  updatedAt: number
}
