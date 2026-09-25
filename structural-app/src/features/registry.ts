import type { ReactNode } from 'react'
import { createElement } from 'react'
import { Box, Columns3, DoorStairwell, Grid2x2, Layers, Slash, Square } from 'lucide-react'
import { calcSteelBeamASD, type SteelBeamInput } from '@/engine/steel/beamASD'
import { calcSteelColumnASD, type SteelColumnInput } from '@/engine/steel/columnASD'
import type { CalcSheetKind, CheckStatus, Project } from '@/engine/shared/types'
import { toReportStatus } from '@/features/concrete/concreteDraft'
import { ConcreteBeamForm } from '@/features/concrete-beam/ConcreteBeamForm'
import { ConcreteBeamResultView } from '@/features/concrete-beam/ConcreteBeamResultView'
import { ConcreteBeamSheet, analyzeBeamSheet } from '@/features/concrete-beam/ConcreteBeamSheet'
import { DEFAULT_CONCRETE_BEAM_INPUT } from '@/features/concrete-beam/concreteBeamDefaults'
import { ConcreteColumnForm } from '@/features/concrete-column/ConcreteColumnForm'
import { ConcreteColumnResultView } from '@/features/concrete-column/ConcreteColumnResultView'
import { ConcreteColumnSheet, analyzeColumnSheet } from '@/features/concrete-column/ConcreteColumnSheet'
import { DEFAULT_CONCRETE_COLUMN_INPUT } from '@/features/concrete-column/concreteColumnDefaults'
import { ConcreteFootingForm } from '@/features/concrete-footing/ConcreteFootingForm'
import { ConcreteFootingResultView } from '@/features/concrete-footing/ConcreteFootingResultView'
import { ConcreteFootingSheet, analyzeFootingSheet } from '@/features/concrete-footing/ConcreteFootingSheet'
import { DEFAULT_CONCRETE_FOOTING_INPUT } from '@/features/concrete-footing/concreteFootingDefaults'
import { ConcretePileCapForm } from '@/features/concrete-pilecap/ConcretePileCapForm'
import { ConcretePileCapResultView } from '@/features/concrete-pilecap/ConcretePileCapResultView'
import { ConcretePileCapSheet, analyzePileCapSheet } from '@/features/concrete-pilecap/ConcretePileCapSheet'
import { DEFAULT_CONCRETE_PILECAP_INPUT } from '@/features/concrete-pilecap/concretePileCapDefaults'
import { ConcreteSlabForm } from '@/features/concrete-slab/ConcreteSlabForm'
import { ConcreteSlabResultView } from '@/features/concrete-slab/ConcreteSlabResultView'
import { ConcreteSlabSheet, analyzeSlabSheet } from '@/features/concrete-slab/ConcreteSlabSheet'
import { DEFAULT_CONCRETE_SLAB_INPUT } from '@/features/concrete-slab/concreteSlabDefaults'
import { ConcreteStairForm } from '@/features/concrete-stair/ConcreteStairForm'
import { ConcreteStairResultView } from '@/features/concrete-stair/ConcreteStairResultView'
import { ConcreteStairSheet, analyzeStairSheet } from '@/features/concrete-stair/ConcreteStairSheet'
import { DEFAULT_CONCRETE_STAIR_INPUT } from '@/features/concrete-stair/concreteStairDefaults'
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

/** กลุ่มของชนิดรายการ ใช้จัดกลุ่มปุ่มเลือกชนิดในหน้าจอ */
export type SheetGroup = 'steel' | 'concrete'

/**
 * ทะเบียนชนิดรายการคำนวณ
 *
 * App และรูปเล่มอ่านจากที่นี่ที่เดียว การเพิ่มโมดูลใหม่
 * จึงทำได้โดยเพิ่มรายการในไฟล์นี้ ไม่ต้องแก้หน้าจอหลัก
 */
export interface SheetTypeDef {
  kind: CalcSheetKind
  group: SheetGroup
  label: string
  /** ใช้ตั้งชื่อรายการเริ่มต้น เช่น "คานเหล็ก SB1" */
  titlePrefix: string
  /**
   * ช่องในข้อมูลนำเข้า (file.input) ที่เก็บชื่อชิ้นส่วนสำหรับหัวรูป เช่น SECTION C1
   * ค่านี้ไม่ให้กรอกเอง — ตั้งจากชื่อรายการด้วย inputWithTitle
   */
  nameKey?: string
  icon: typeof Slash
  defaultInput: unknown
  /** คำบรรยายสั้น ๆ สำหรับตัวเลือกชนิดรายการ */
  description: string
  overallOf: (input: unknown) => CheckStatus
  renderForm: (input: unknown, onChange: (next: unknown) => void) => ReactNode
  renderResult: (input: unknown) => ReactNode
  renderSheet: (props: SheetRenderProps) => ReactNode
}

export const GROUP_LABEL: Record<SheetGroup, string> = {
  steel: 'โครงสร้างเหล็กรูปพรรณ',
  concrete: 'คอนกรีตเสริมเหล็ก',
}

export const SHEET_TYPES: SheetTypeDef[] = [
  {
    kind: 'steel-beam',
    group: 'steel',
    label: 'คานเหล็ก',
    titlePrefix: 'คานเหล็ก SB',
    icon: Slash,
    defaultInput: DEFAULT_STEEL_BEAM_INPUT,
    description: 'ใช้กับคานราบ จันทัน และแป — ปรับมุมเอียงของชิ้นส่วนและของหน้าตัดได้ ครอบคลุมงานหลังคา',
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
    group: 'steel',
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
  {
    kind: 'concrete-beam',
    group: 'concrete',
    label: 'คาน คสล.',
    titlePrefix: 'คาน คสล. B',
    icon: Slash,
    defaultInput: DEFAULT_CONCRETE_BEAM_INPUT,
    description: 'วิธีหน่วยแรงใช้งาน ตรวจสองหน้าตัด (กลางคาน / ใกล้เสา) แก้ไขเหล็กในรูปได้',
    overallOf: (input) => {
      const result = analyzeBeamSheet(input)
      return result ? toReportStatus(result.status) : 'fail'
    },
    renderForm: (input, onChange) => createElement(ConcreteBeamForm, { value: input, onChange }),
    renderResult: () => createElement(ConcreteBeamResultView),
    renderSheet: (props) => createElement(ConcreteBeamSheet, props),
  },
  {
    kind: 'concrete-column',
    group: 'concrete',
    label: 'เสา คสล.',
    titlePrefix: 'เสา คสล. C',
    nameKey: 'columnName',
    icon: Square,
    defaultInput: DEFAULT_CONCRETE_COLUMN_INPUT,
    description: 'เสาปลอกเดี่ยว / ปลอกเกลียว พร้อมแผนภาพ P–M และผลความชะลูด',
    overallOf: (input) => {
      const result = analyzeColumnSheet(input)
      return result ? toReportStatus(result.analysis.status) : 'fail'
    },
    renderForm: (input, onChange) => createElement(ConcreteColumnForm, { value: input, onChange }),
    renderResult: () => createElement(ConcreteColumnResultView),
    renderSheet: (props) => createElement(ConcreteColumnSheet, props),
  },
  {
    kind: 'concrete-footing',
    group: 'concrete',
    label: 'ฐานรากแผ่',
    titlePrefix: 'ฐานราก F',
    nameKey: 'footingName',
    icon: Box,
    defaultInput: DEFAULT_CONCRETE_FOOTING_INPUT,
    description: 'หาขนาดฐานรากให้อัตโนมัติ ตรวจแรงดันดิน เฉือนทะลุ และเสาเยื้องศูนย์',
    overallOf: (input) => {
      const result = analyzeFootingSheet(input)
      return result ? toReportStatus(result.analysis.status) : 'fail'
    },
    renderForm: (input, onChange) => createElement(ConcreteFootingForm, { value: input, onChange }),
    renderResult: () => createElement(ConcreteFootingResultView),
    renderSheet: (props) => createElement(ConcreteFootingSheet, props),
  },
  {
    kind: 'concrete-pilecap',
    group: 'concrete',
    label: 'ฐานรากเสาเข็ม',
    titlePrefix: 'ฐานรากเข็ม F',
    nameKey: 'capName',
    icon: Grid2x2,
    defaultInput: DEFAULT_CONCRETE_PILECAP_INPUT,
    description: 'จัดกลุ่มเข็มให้อัตโนมัติ คำนวณแรงในเข็มแต่ละต้น รวมระยะเยื้องหลังตอก',
    overallOf: (input) => {
      const result = analyzePileCapSheet(input)
      return result ? toReportStatus(result.analysis.status) : 'fail'
    },
    renderForm: (input, onChange) => createElement(ConcretePileCapForm, { value: input, onChange }),
    renderResult: () => createElement(ConcretePileCapResultView),
    renderSheet: (props) => createElement(ConcretePileCapSheet, props),
  },
  {
    kind: 'concrete-slab',
    group: 'concrete',
    label: 'พื้น คสล.',
    titlePrefix: 'พื้น คสล. S',
    nameKey: 'slabName',
    icon: Layers,
    defaultInput: DEFAULT_CONCRETE_SLAB_INPUT,
    description: 'พื้นหล่อในที่ ทางเดียว สองทาง พื้นยื่น และพื้นวางบนดิน — หาความหนาและจัดเหล็กให้จากน้ำหนักบรรทุก',
    overallOf: (input) => {
      const result = analyzeSlabSheet(input)
      return result ? toReportStatus(result.analysis.status) : 'fail'
    },
    renderForm: (input, onChange) => createElement(ConcreteSlabForm, { value: input, onChange }),
    renderResult: () => createElement(ConcreteSlabResultView),
    renderSheet: (props) => createElement(ConcreteSlabSheet, props),
  },
  {
    kind: 'concrete-stair',
    group: 'concrete',
    label: 'บันได คสล.',
    titlePrefix: 'บันได คสล. ST',
    nameKey: 'stairName',
    icon: DoorStairwell,
    defaultInput: DEFAULT_CONCRETE_STAIR_INPUT,
    description:
      'บันไดท้องเรียบพาดตามยาวระหว่างคาน คิดน้ำหนักขั้นบันไดและชานพักให้ จัดเหล็กและเขียนรูปตัดพร้อมเหล็กขั้นบันได',
    overallOf: (input) => {
      const result = analyzeStairSheet(input)
      return result ? toReportStatus(result.analysis.status) : 'fail'
    },
    renderForm: (input, onChange) => createElement(ConcreteStairForm, { value: input, onChange }),
    renderResult: () => createElement(ConcreteStairResultView),
    renderSheet: (props) => createElement(ConcreteStairSheet, props),
  },
]

export function sheetType(kind: CalcSheetKind): SheetTypeDef {
  const found = SHEET_TYPES.find((t) => t.kind === kind)
  if (!found) throw new Error(`ไม่รู้จักชนิดรายการคำนวณ: ${kind}`)
  return found
}

/**
 * ชื่อชิ้นส่วน = ชื่อรายการที่ตัดชื่อชนิดข้างหน้าออก
 * เช่น "เสา คสล. C1 ชั้น 2" → "C1 ชั้น 2", "ฐานรากแผ่ F1" → "F1", "C3" → "C3"
 */
export function markFromTitle(type: Pick<SheetTypeDef, 'label' | 'titlePrefix'>, title: string): string {
  const t = title.trim()
  const words = [type.label, type.titlePrefix.replace(/\s*[A-Za-z]+$/, '')].sort((a, b) => b.length - a.length)
  const hit = words.find((w) => t.startsWith(w))
  return (hit ? t.slice(hit.length) : t).trim()
}

/**
 * ใส่ชื่อชิ้นส่วนจากชื่อรายการลงในข้อมูลรายการ ใช้ทั้งหน้าจอออกแบบและรูปเล่ม
 * คืนตัวเดิมเมื่อชื่อตรงกันอยู่แล้ว เพื่อไม่ให้ store ของงานคอนกรีตโหลดข้อมูลซ้ำ
 */
export function inputWithTitle(type: SheetTypeDef, input: unknown, title: string): unknown {
  const file = input as { input?: Record<string, unknown> } | null
  if (!type.nameKey || !file?.input) return input
  const mark = markFromTitle(type, title)
  if (file.input[type.nameKey] === mark) return input
  return { ...file, input: { ...file.input, [type.nameKey]: mark } }
}

export const KIND_LABEL = Object.fromEntries(
  SHEET_TYPES.map((t) => [t.kind, t.label]),
) as Record<CalcSheetKind, string>

/** ชนิดรายการแยกตามกลุ่ม ตามลำดับที่ประกาศไว้ */
export const SHEET_TYPES_BY_GROUP: Array<{ group: SheetGroup; types: SheetTypeDef[] }> = (
  ['steel', 'concrete'] as const
).map((group) => ({ group, types: SHEET_TYPES.filter((t) => t.group === group) }))
