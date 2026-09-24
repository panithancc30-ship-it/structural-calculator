import type { ReactNode } from 'react'
import { createElement } from 'react'
import { Columns3, Slash } from 'lucide-react'
import { calcSteelBeamASD, type SteelBeamInput } from '@/engine/steel/beamASD'
import { calcSteelColumnASD, type SteelColumnInput } from '@/engine/steel/columnASD'
import type { CalcSheetKind, CheckStatus, Project } from '@/engine/shared/types'
import { SteelBeamForm } from '@/features/steel-beam/SteelBeamForm'
import { SteelBeamResultView } from '@/features/steel-beam/SteelBeamResultView'
import { SteelBeamSheet } from '@/features/steel-beam/SteelBeamSheet'
import { DEFAULT_STEEL_BEAM_INPUT } from '@/features/steel-beam/steelBeamDefaults'
import { SteelColumnForm } from '@/features/steel-column/SteelColumnForm'
import { SteelColumnResultView } from '@/features/steel-column/SteelColumnResultView'
import { SteelColumnSheet } from '@/features/steel-column/SteelColumnSheet'
import { DEFAULT_STEEL_COLUMN_INPUT } from '@/features/steel-column/steelColumnDefaults'

export interface SheetRenderProps {
  project: Project
  title: string
  input: unknown
  remarks: string
  pageNumber: number
  totalPages: number
}

/**
 * ทะเบียนชนิดรายการคำนวณ
 *
 * App และรูปเล่มอ่านจากที่นี่ที่เดียว การเพิ่มโมดูลใหม่
 * จึงทำได้โดยเพิ่มรายการในไฟล์นี้ ไม่ต้องแก้หน้าจอหลัก
 */
export interface SheetTypeDef {
  kind: CalcSheetKind
  label: string
  /** ใช้ตั้งชื่อรายการเริ่มต้น เช่น "คานเหล็ก SB1" */
  titlePrefix: string
  icon: typeof Slash
  defaultInput: unknown
  /** คำบรรยายสั้น ๆ สำหรับตัวเลือกชนิดรายการ */
  description: string
  overallOf: (input: unknown) => CheckStatus
  renderForm: (input: unknown, onChange: (next: unknown) => void) => ReactNode
  renderResult: (input: unknown) => ReactNode
  renderSheet: (props: SheetRenderProps) => ReactNode
}

export const SHEET_TYPES: SheetTypeDef[] = [
  {
    kind: 'steel-beam',
    label: 'คานเหล็ก / จันทัน / แป',
    titlePrefix: 'คานเหล็ก SB',
    icon: Slash,
    defaultInput: DEFAULT_STEEL_BEAM_INPUT,
    description: 'ปรับมุมเอียงของชิ้นส่วนและของหน้าตัดได้ ครอบคลุมงานหลังคา',
    overallOf: (input) => calcSteelBeamASD(input as SteelBeamInput).overall,
    renderForm: (input, onChange) =>
      createElement(SteelBeamForm, {
        value: input as SteelBeamInput,
        onChange: onChange as (v: SteelBeamInput) => void,
      }),
    renderResult: (input) =>
      createElement(SteelBeamResultView, {
        result: calcSteelBeamASD(input as SteelBeamInput),
      }),
    renderSheet: (props) =>
      createElement(SteelBeamSheet, { ...props, input: props.input as SteelBeamInput }),
  },
  {
    kind: 'steel-column',
    label: 'เสาเหล็ก',
    titlePrefix: 'เสาเหล็ก SC',
    icon: Columns3,
    defaultInput: DEFAULT_STEEL_COLUMN_INPUT,
    description: 'แรงอัดร่วมกับโมเมนต์สองแกน ตรวจด้วยสมการแรงร่วม',
    overallOf: (input) => calcSteelColumnASD(input as SteelColumnInput).overall,
    renderForm: (input, onChange) =>
      createElement(SteelColumnForm, {
        value: input as SteelColumnInput,
        onChange: onChange as (v: SteelColumnInput) => void,
      }),
    renderResult: (input) =>
      createElement(SteelColumnResultView, {
        result: calcSteelColumnASD(input as SteelColumnInput),
      }),
    renderSheet: (props) =>
      createElement(SteelColumnSheet, { ...props, input: props.input as SteelColumnInput }),
  },
]

export function sheetType(kind: CalcSheetKind): SheetTypeDef {
  const found = SHEET_TYPES.find((t) => t.kind === kind)
  if (!found) throw new Error(`ไม่รู้จักชนิดรายการคำนวณ: ${kind}`)
  return found
}

export const KIND_LABEL = Object.fromEntries(
  SHEET_TYPES.map((t) => [t.kind, t.label]),
) as Record<CalcSheetKind, string>
