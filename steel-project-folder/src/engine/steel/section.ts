/**
 * รวมการเลือกหน้าตัดทั้งหมดไว้ที่เดียว — ตารางมาตรฐาน / หน้าตัดประกอบ / กำหนดเอง
 * ทั้งโมดูลคานและโมดูลเสาใช้ตัวนี้ร่วมกัน
 */

import { combineSection, type BuiltUpArrangement } from './builtUp'
import {
  effectiveHatBending,
  effectiveLippedBending,
  grossEffective,
  type EffectiveResult,
} from './coldFormed'
import { designYield, getGrade, type SteelGrade } from './materials'
import {
  getSection,
  categoryInfo,
  type SectionCategory,
  type SectionEntry,
} from './sectionTable'
import { hatProps, type HatDims, type SectionProps } from './geometry'

/** หมวดที่เป็นเหล็กขึ้นรูปเย็นผนังบาง — ต้องใช้หน้าตัดประสิทธิผลตาม AISI */
const THIN_WALL_CATEGORIES: SectionCategory[] = ['lipped-channel', 'g550', 'hat']

/** คุณสมบัติที่ผู้ใช้ป้อนเอง สำหรับหน้าตัดที่ไม่มีในตาราง */
export interface CustomSectionInput {
  name: string
  d: number
  bf: number
  tw: number
  tf: number
  A: number
  Ix: number
  Iy: number
  Sx: number
  Sy: number
  closed: boolean
}

export interface SectionSelection {
  /** เลือกจากตาราง หรือป้อนคุณสมบัติเอง */
  source: 'table' | 'custom'
  sectionId: string
  arrangement: BuiltUpArrangement
  /** ระยะห่างระหว่างสองท่อนของหน้าตัดประกอบ (ซม.) */
  gap: number
  /** ระยะห่างจุดยึดสองท่อนเข้าด้วยกัน (ซม.) */
  connectorSpacing: number
  gradeId: string
  /** ใช้เมื่อ gradeId = 'custom' */
  customFy: number
  custom: CustomSectionInput
  /** มิติแปหมวกที่ผู้ใช้แก้ไข (ซม.) — ใช้แทนมิติในตารางเมื่อเลือกหมวดแปหมวก */
  hat?: HatDims
}

export interface ResolveOptions {
  /**
   * ทิศของโมเมนต์: 1 = แรงกดลง (ผิวบนรับแรงอัด), −1 = แรงยก (ผิวล่างรับแรงอัด)
   * มีผลกับหน้าตัดที่ไม่สมมาตรรอบแกนนอน เช่น แปหมวก
   */
  bendingSign?: 1 | -1
}

export interface ResolvedSection {
  /** คุณสมบัติสุดท้ายที่ใช้คำนวณ (รวมผลการประกอบแล้ว) */
  props: SectionProps
  /** คุณสมบัติของเหล็กท่อนเดียว ใช้ตรวจระยะห่างจุดยึด */
  single: SectionProps
  entry?: SectionEntry
  grade: SteelGrade
  Fy: number
  Fu: number
  name: string
  categoryLabel: string
  /** กำลังครากถูกลดตามมาตรฐาน (เหล็ก G550 ผนังบาง) */
  yieldReduced: boolean
  /** แหล่งที่มาของคุณสมบัติหน้าตัด — พิมพ์ลงรายงานเพื่อความโปร่งใส */
  propertySource: string
  effective: EffectiveResult
  warnings: string[]
}

function customProps(c: CustomSectionInput): SectionProps {
  const A = Math.max(c.A, 1e-6)
  const h = Math.max(c.d - 2 * c.tf, c.d * 0.5)
  return {
    family: 'custom',
    d: c.d,
    bf: c.bf,
    tw: c.tw,
    tf: c.tf,
    A,
    weight: A * 0.785,
    Ix: c.Ix,
    Iy: c.Iy,
    Sx: c.Sx,
    Sy: c.Sy,
    rx: Math.sqrt(c.Ix / A),
    ry: Math.sqrt(c.Iy / A),
    rmin: Math.sqrt(Math.min(c.Ix, c.Iy) / A),
    Aw: c.d * c.tw,
    J: (2 * c.bf * c.tf ** 3 + h * c.tw ** 3) / 3,
    rT: Math.sqrt(c.Iy / A),
    dAf: c.tf > 0 && c.bf > 0 ? c.d / (c.bf * c.tf) : 0,
    closed: c.closed,
    doublySymmetric: true,
    slenderness: {
      flange: c.tf > 0 ? c.bf / (2 * c.tf) : 0,
      web: c.tw > 0 ? h / c.tw : 0,
    },
    xbar: c.bf / 2,
    ybar: c.d / 2,
  }
}

function sameHat(a: HatDims, b: HatDims): boolean {
  return (['d', 'bf', 'crown', 'webBottom', 'lip', 't'] as const).every(
    (k) => Math.abs(a[k] - b[k]) < 1e-9,
  )
}

/** ชื่อแปหมวกตามมิติ เช่น Ω65×30×0.55 */
export function hatName(dims: HatDims): string {
  const mm = (v: number) => String(Number((v * 10).toFixed(2)))
  return `Ω${mm(dims.bf)}×${mm(dims.d)}×${mm(dims.t)}`
}

function customGrade(Fy: number, coldFormed: boolean): SteelGrade {
  return {
    id: 'custom',
    label: `กำหนดเอง (Fy = ${Fy} ksc)`,
    Fy,
    Fu: Fy * 1.5,
    coldFormed,
    note: 'ผู้ใช้กำหนดกำลังครากเอง',
  }
}

export function resolveSection(
  selection: SectionSelection,
  options: ResolveOptions = {},
): ResolvedSection {
  const warnings: string[] = []
  const compressionTop = (options.bendingSign ?? 1) >= 0

  if (selection.source === 'custom') {
    const single = customProps(selection.custom)
    const grade =
      selection.gradeId === 'custom' ? customGrade(selection.customFy, false) : getGrade(selection.gradeId)
    warnings.push(
      'ใช้คุณสมบัติหน้าตัดที่ผู้ใช้ป้อนเอง — โปรแกรมไม่ได้ตรวจสอบความถูกต้องของตัวเลขชุดนี้',
    )
    return {
      props: single,
      single,
      grade,
      Fy: grade.Fy,
      Fu: grade.Fu,
      yieldReduced: false,
      name: selection.custom.name || 'หน้าตัดกำหนดเอง',
      categoryLabel: 'หน้าตัดกำหนดเอง',
      propertySource: 'ผู้ใช้ป้อนคุณสมบัติเอง',
      effective: grossEffective(single),
      warnings,
    }
  }

  const entry = getSection(selection.sectionId)
  if (!entry) {
    const fallback = customProps(selection.custom)
    const grade = getGrade('SS400')
    return {
      props: fallback,
      single: fallback,
      grade,
      Fy: grade.Fy,
      Fu: grade.Fu,
      yieldReduced: false,
      name: 'ยังไม่ได้เลือกหน้าตัด',
      categoryLabel: '-',
      propertySource: '-',
      effective: grossEffective(fallback),
      warnings: ['ยังไม่ได้เลือกหน้าตัด'],
    }
  }

  const info = categoryInfo(entry.category)
  const thinWall = THIN_WALL_CATEGORIES.includes(entry.category)
  const grade =
    selection.gradeId === 'custom'
      ? customGrade(selection.customFy, thinWall)
      : getGrade(selection.gradeId)

  // แปหมวกใช้มิติที่ผู้ใช้แก้ไขได้ ส่วนหมวดอื่นใช้มิติในตาราง
  const hatDims = entry.category === 'hat' ? (selection.hat ?? entry.hatDims) : undefined
  const single = hatDims ? hatProps(hatDims) : entry.props()
  const editedHat = hatDims && entry.hatDims && !sameHat(hatDims, entry.hatDims)
  const props = combineSection(single, selection.arrangement, selection.gap)

  const { Fy, reduced: yieldReduced } = designYield(grade, single.tw)
  if (yieldReduced) {
    warnings.push(
      `เหล็ก G550 หนาน้อยกว่า 0.9 มม. ใช้กำลังครากออกแบบ ${Fy.toLocaleString()} ksc (75% ของ Fy ตาม AISI S100 A2.3.2 / AS/NZS 4600)`,
    )
  }

  // เหล็กขึ้นรูปเย็นผนังบางต้องลดหน้าตัดตาม AISI ก่อนใช้คำนวณกำลัง
  let effective = grossEffective(props)
  if (grade.coldFormed && thinWall) {
    const eff =
      hatDims
        ? effectiveHatBending(hatDims, single, Fy, compressionTop)
        : single.lip !== undefined
          ? effectiveLippedBending(
              { d: single.d, bf: single.bf, lip: single.lip, t: single.tw, bendRadius: single.cornerRadius },
              single,
              Fy,
            )
          : grossEffective(single)
    effective = {
      ...eff,
      Se: props.Sx * eff.ratioS,
      Ae: props.A * eff.ratioA,
      Ie: props.Ix * eff.ratioI,
    }
    warnings.push(...eff.notes)
  }

  if (hatDims) {
    warnings.push(
      editedHat
        ? 'มิติแปหมวกกำหนดโดยผู้ใช้ — ตรวจให้ตรงกับของจริง และใช้ความหนาเหล็กไม่รวมสารเคลือบ'
        : 'ผู้ขายไม่ระบุความกว้างสัน ระยะเอว และขอบพับ ค่าที่ใช้เป็นค่าสมมติ — ควรวัดจากของจริงแล้วแก้ไขมิติ',
      'ไม่ได้ตรวจการยุบตัวของเอวที่จุดรองรับ (web crippling) และความแข็งแรงของสกรูยึด',
    )
    if (!compressionTop) {
      warnings.unshift('ตรวจกรณีแรงลมยก: ปีกแปหมวกรับแรงอัด')
    }
  }

  if (entry.taperedFlange) {
    warnings.push(
      `${info.label} มีปีกสอบ แต่โปรแกรมคำนวณจากรูปทรงแบบปีกขนาน ` +
        'ทำให้ค่ารอบแกนอ่อน (Iy, Sy) สูงกว่าตารางมาตรฐานราว 10–15% ' +
        'หากรายการนี้มีการดัดรอบแกนอ่อน ต้องเทียบกับตารางผู้ผลิตก่อนใช้งาน',
    )
  }

  const arrangementLabel = selection.arrangement === 'single' ? '' : ' (ประกอบ 2 ท่อน)'
  const baseName = editedHat && hatDims ? `${hatName(hatDims)} (มิติกำหนดเอง)` : entry.name

  return {
    props,
    single,
    entry,
    grade,
    Fy,
    Fu: yieldReduced ? Math.min(0.75 * grade.Fu, 4360) : grade.Fu,
    yieldReduced,
    name: baseName + arrangementLabel,
    categoryLabel: info.label,
    propertySource: `คำนวณจากมิติระบุตาม ${info.standard}`,
    effective,
    warnings,
  }
}

export const DEFAULT_CUSTOM_SECTION: CustomSectionInput = {
  name: 'หน้าตัดกำหนดเอง',
  d: 30,
  bf: 15,
  tw: 0.7,
  tf: 1.0,
  A: 50,
  Ix: 7000,
  Iy: 600,
  Sx: 467,
  Sy: 80,
  closed: false,
}
