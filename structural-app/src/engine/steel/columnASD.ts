/**
 * เสาเหล็กรูปพรรณ ออกแบบด้วยวิธีหน่วยแรงใช้งาน (AISC ASD / วสท. 1008)
 * รับแรงอัดร่วมกับโมเมนต์ดัดสองแกน ตรวจด้วยสมการแรงร่วม H1
 */

import { checkConnectorSpacing } from './builtUp'
import { coldFormedAllowableAxial } from './coldFormed'
import {
  allowableAxial,
  allowableBendingStrong,
  allowableBendingWeak,
  allowableShear,
  allowableTension,
  combinedStress,
  eulerStress,
  SLENDERNESS_LIMIT,
  slenderElement,
} from './asd'
import { resolveSection, type SectionSelection } from './section'
import type { CalcStep, CheckItem, CheckStatus, SteelDetailing } from '../shared/types'
import { fmtSig, sigDecimals } from '../shared/units'

/** ค่าตัวคูณความยาวประสิทธิผล K ตามตาราง C-C2.1 ของ AISC (ใช้ค่าที่แนะนำสำหรับออกแบบ) */
export const K_FACTOR_CASES: Array<{
  id: string
  label: string
  K: number
  sway: boolean
}> = [
  { id: 'fixed-fixed', label: 'ปลายทั้งสองยึดแน่น ไม่เซทางข้าง', K: 0.65, sway: false },
  { id: 'fixed-pinned', label: 'ปลายหนึ่งยึดแน่น อีกปลายยึดหมุน ไม่เซ', K: 0.8, sway: false },
  { id: 'pinned-pinned', label: 'ปลายทั้งสองยึดหมุน ไม่เซทางข้าง', K: 1.0, sway: false },
  { id: 'fixed-fixed-sway', label: 'ปลายทั้งสองยึดแน่น แต่เซทางข้างได้', K: 1.2, sway: true },
  { id: 'fixed-pinned-sway', label: 'ปลายล่างยึดแน่น ปลายบนยึดหมุน เซได้', K: 2.1, sway: true },
  { id: 'cantilever', label: 'ปลายล่างยึดแน่น ปลายบนอิสระ (เสายื่น)', K: 2.1, sway: true },
  { id: 'custom', label: 'กำหนดค่า K เอง', K: 1.0, sway: false },
]

export interface SteelColumnInput {
  /** แรงตามแกน (กก.) — บวกคือแรงอัด ลบคือแรงดึง */
  axial: number
  /** โมเมนต์รอบแกนแข็ง (กก.-ม.) */
  momentX: number
  /** โมเมนต์รอบแกนอ่อน (กก.-ม.) */
  momentY: number
  /** แรงเฉือน (กก.) */
  shear: number
  /** ความยาวไร้การค้ำยันสำหรับการโก่งเดาะรอบแกนแข็ง (ม.) */
  lengthX: number
  /** ความยาวไร้การค้ำยันสำหรับการโก่งเดาะรอบแกนอ่อน (ม.) */
  lengthY: number
  Kx: number
  Ky: number
  /** สัมประสิทธิ์โมเมนต์เทียบเท่า — 0.85 สำหรับโครงที่เซได้ */
  Cmx: number
  Cmy: number
  Cb: number
  section: SectionSelection
}

export interface SteelColumnResult {
  input: SteelColumnInput
  steps: CalcStep[]
  checks: CheckItem[]
  overall: CheckStatus
  detailing: SteelDetailing
  warnings: string[]
  summary: { weight: number; maxRatio: number; sectionName: string }
}

function ratioOf(actual: number, allowable: number): number {
  if (allowable > 0) return actual / allowable
  return actual > 0 ? Number.POSITIVE_INFINITY : 0
}

function statusOf(actual: number, allowable: number): CheckStatus {
  return actual <= allowable ? 'pass' : 'fail'
}

export function calcSteelColumnASD(input: SteelColumnInput): SteelColumnResult {
  const resolved = resolveSection(input.section, { bendingSign: input.momentX < 0 ? -1 : 1 })
  const { props, single, Fy, grade, effective } = resolved
  const warnings = [...resolved.warnings]

  const compression = input.axial >= 0
  const P = Math.abs(input.axial)

  // ── ความชะลูดทั้งสองแกน — แกนที่ชะลูดกว่าเป็นตัวควบคุม ──────────────
  const KLx = input.Kx * input.lengthX * 100
  const KLy = input.Ky * input.lengthY * 100
  const slenderX = props.rx > 0 ? KLx / props.rx : 0
  const slenderY = props.ry > 0 ? KLy / props.ry : 0
  const slenderness = Math.max(slenderX, slenderY)
  const governingAxis = slenderX >= slenderY ? 'แกนแข็ง (x-x)' : 'แกนอ่อน (y-y)'

  // ── หน่วยแรงที่ยอมให้ ────────────────────────────────────────────────
  const coldFormed = grade.coldFormed
  const Sx = coldFormed ? effective.Se : props.Sx
  const Sy = coldFormed ? props.Sy * effective.ratioS : props.Sy
  const Aeff = coldFormed ? effective.Ae : props.A

  const axialRes = allowableAxial(Fy, slenderness)
  const coldAxial = coldFormedAllowableAxial(
    Fy,
    slenderness,
    props.A > 0 ? Aeff / props.A : 1,
  )
  const Fa = coldFormed ? coldAxial.Fa : axialRes.Fa
  const Ft = allowableTension(Fy)

  // ความยาวไร้การค้ำยันของปีกอัดคือความยาวรอบแกนอ่อน
  const bendX = allowableBendingStrong(props, Fy, KLy / Math.max(input.Ky, 1e-6), input.Cb)
  const bendY = allowableBendingWeak(props, Fy)
  const shearRes = allowableShear(props, Fy)

  const Fbx = coldFormed ? Math.min(bendX.Fb, 0.6 * Fy) : bendX.Fb
  const Fby = coldFormed ? Math.min(bendY.Fb, 0.6 * Fy) : bendY.Fb
  warnings.push(...bendX.notes)

  // ── หน่วยแรงที่เกิดขึ้น ──────────────────────────────────────────────
  const fa = Aeff > 0 ? P / Aeff : Infinity
  // ตรวจด้วยขนาดของโมเมนต์ ทิศมีผลเฉพาะด้านที่รับแรงอัดของหน้าตัดไม่สมมาตร
  const fbx = Sx > 0 ? Math.abs(input.momentX * 100) / Sx : 0
  const fby = Sy > 0 ? Math.abs(input.momentY * 100) / Sy : 0
  const fv = props.Aw > 0 ? Math.abs(input.shear) / props.Aw : 0

  const FexPrime = eulerStress(slenderX)
  const FeyPrime = eulerStress(slenderY)

  // ── ขั้นตอนการคำนวณ ─────────────────────────────────────────────────
  const steps: CalcStep[] = [
    {
      symbol: 'A',
      label: `พื้นที่หน้าตัด — ${resolved.name}`,
      formula: resolved.propertySource,
      value: props.A,
      unit: 'ตร.ซม.',
      decimals: sigDecimals(props.A),
    },
    {
      symbol: 'rx , ry',
      label: 'รัศมีไจเรชันสองแกน',
      substitution: `rx = ${fmtSig(props.rx)} ซม. · ry = ${fmtSig(props.ry)} ซม.`,
      value: props.ry,
      unit: 'ซม.',
    },
    {
      symbol: 'KL/r',
      label: `ความชะลูดที่ควบคุม — ${governingAxis}`,
      formula: 'KL/r = ค่ามากสุดของสองแกน',
      substitution:
        `x: ${input.Kx}×${input.lengthX}ม./${fmtSig(props.rx)} = ${slenderX.toFixed(1)} · ` +
        `y: ${input.Ky}×${input.lengthY}ม./${fmtSig(props.ry)} = ${slenderY.toFixed(1)}`,
      value: slenderness,
      unit: '-',
      decimals: 1,
    },
    {
      symbol: 'Cc',
      label: 'ความชะลูดที่แบ่งระหว่างเสาสั้นกับเสายาว',
      formula: 'Cc = √(2π²E/Fy)',
      substitution: `Cc = √(2π² × 2,040,000 / ${Fy})`,
      value: axialRes.Cc,
      unit: '-',
      decimals: 1,
    },
    {
      symbol: 'Fa',
      label: axialRes.elastic
        ? 'หน่วยแรงอัดที่ยอมให้ (เสายาว โก่งเดาะแบบยืดหยุ่น)'
        : 'หน่วยแรงอัดที่ยอมให้ (เสาสั้น)',
      formula: coldFormed ? 'AISI C4: Fa = Fn·(Ae/A)/1.80' : axialRes.formula,
      substitution: coldFormed ? undefined : `FS = ${axialRes.FS.toFixed(3)}`,
      value: Fa,
      unit: 'ksc',
      decimals: 0,
    },
    {
      symbol: 'fa',
      label: 'หน่วยแรงอัดที่เกิดขึ้น',
      formula: 'fa = P / A',
      substitution: `fa = ${P.toLocaleString()} / ${fmtSig(Aeff)}`,
      value: fa,
      unit: 'ksc',
      decimals: 0,
    },
    {
      symbol: 'Fbx',
      label: 'หน่วยแรงดัดที่ยอมให้ แกนแข็ง',
      formula: `${bendX.mode}: ${bendX.formula}`,
      value: Fbx,
      unit: 'ksc',
      decimals: 0,
    },
  ]

  if (Math.abs(input.momentX) > 1e-6) {
    steps.push({
      symbol: 'fbx',
      label: 'หน่วยแรงดัดที่เกิดขึ้น แกนแข็ง',
      formula: 'fbx = Mx / Sx',
      substitution: `fbx = ${fmtSig(Math.abs(input.momentX * 100))} / ${fmtSig(Sx)}`,
      value: fbx,
      unit: 'ksc',
      decimals: 0,
    })
  }

  if (Math.abs(input.momentY) > 1e-6) {
    steps.push({
      symbol: 'fby',
      label: 'หน่วยแรงดัดที่เกิดขึ้น แกนอ่อน',
      formula: 'fby = My / Sy',
      substitution: `fby = ${fmtSig(Math.abs(input.momentY * 100))} / ${fmtSig(Sy)}`,
      value: fby,
      unit: 'ksc',
      decimals: 0,
    })
  }

  // ── รายการตรวจสอบ ───────────────────────────────────────────────────
  const checks: CheckItem[] = []

  checks.push({
    id: 'slenderness',
    label: `ความชะลูดของเสา — ควบคุมโดย${governingAxis}`,
    actualSymbol: 'KL/r',
    actual: slenderness,
    allowableSymbol: 'ขีดจำกัด',
    allowable: compression ? SLENDERNESS_LIMIT.compression : SLENDERNESS_LIMIT.tension,
    unit: '-',
    ratio: ratioOf(
      slenderness,
      compression ? SLENDERNESS_LIMIT.compression : SLENDERNESS_LIMIT.tension,
    ),
    status: statusOf(
      slenderness,
      compression ? SLENDERNESS_LIMIT.compression : SLENDERNESS_LIMIT.tension,
    ),
    formula: compression ? 'KL/r ≤ 200 (ชิ้นส่วนรับแรงอัด)' : 'KL/r ≤ 300 (ชิ้นส่วนรับแรงดึง)',
  })

  if (compression) {
    checks.push({
      id: 'axial',
      label: 'หน่วยแรงอัดตามแกน',
      actualSymbol: 'fa',
      actual: fa,
      allowableSymbol: 'Fa',
      allowable: Fa,
      unit: 'ksc',
      ratio: ratioOf(fa, Fa),
      status: statusOf(fa, Fa),
      formula: axialRes.elastic ? "Fa = 12π²E/(23(KL/r)²)" : 'Fa = [1 − (KL/r)²/(2Cc²)]Fy / FS',
    })
  } else {
    checks.push({
      id: 'tension',
      label: 'หน่วยแรงดึงตามแกน',
      actualSymbol: 'ft',
      actual: fa,
      allowableSymbol: 'Ft',
      allowable: Ft,
      unit: 'ksc',
      ratio: ratioOf(fa, Ft),
      status: statusOf(fa, Ft),
      formula: 'Ft = 0.60Fy (หน้าตัดเต็ม)',
      note: 'หากมีรูสลักเกลียว ต้องตรวจหน้าตัดสุทธิด้วย 0.50Fu เพิ่มเติม',
    })
  }

  const hasMoment = Math.abs(input.momentX) > 1e-6 || Math.abs(input.momentY) > 1e-6
  if (hasMoment) {
    if (compression) {
      for (const c of combinedStress(
        fa,
        Fa,
        fbx,
        Fbx,
        fby,
        Fby,
        Fy,
        input.Cmx,
        input.Cmy,
        FexPrime,
        FeyPrime,
      )) {
        checks.push({
          id: `combined-${c.equation}`,
          label: `แรงอัดร่วมกับการดัด (${c.equation})`,
          actualSymbol: 'อัตราส่วนรวม',
          actual: c.ratio,
          allowableSymbol: '1.00',
          allowable: 1,
          unit: '-',
          ratio: c.ratio,
          status: statusOf(c.ratio, 1),
          formula: c.formula,
          substitution: c.substitution,
        })
      }
    } else {
      const combined = ratioOf(fa, Ft) + ratioOf(fbx, Fbx) + ratioOf(fby, Fby)
      checks.push({
        id: 'combined-tension',
        label: 'แรงดึงร่วมกับการดัด',
        actualSymbol: 'อัตราส่วนรวม',
        actual: combined,
        allowableSymbol: '1.00',
        allowable: 1,
        unit: '-',
        ratio: combined,
        status: statusOf(combined, 1),
        formula: 'ft/Ft + fbx/Fbx + fby/Fby ≤ 1.0',
      })
    }
  }

  if (Math.abs(input.shear) > 1e-6) {
    checks.push({
      id: 'shear',
      label: 'หน่วยแรงเฉือนในเอว',
      actualSymbol: 'fv',
      actual: fv,
      allowableSymbol: 'Fv',
      allowable: shearRes.Fv,
      unit: 'ksc',
      ratio: ratioOf(fv, shearRes.Fv),
      status: statusOf(fv, shearRes.Fv),
      formula: 'fv = V / Aw ≤ 0.40Fy',
    })
  }

  if (input.section.arrangement !== 'single') {
    const conn = checkConnectorSpacing(
      input.section.arrangement,
      single.rmin,
      input.section.connectorSpacing,
      slenderness,
    )
    checks.push({
      id: 'connector-spacing',
      label: 'ระยะห่างจุดยึดของหน้าตัดประกอบ',
      actualSymbol: 'a/ri',
      actual: conn.localSlenderness,
      allowableSymbol: '0.75·(KL/r)',
      allowable: conn.limit,
      unit: '-',
      ratio: ratioOf(conn.localSlenderness, conn.limit),
      status: conn.ok ? 'pass' : 'fail',
      formula: 'ความชะลูดของท่อนเดี่ยวระหว่างจุดยึด ≤ 0.75 เท่าของหน้าตัดรวม (AISC E4)',
      note: `ระยะห่างจุดยึดสูงสุดที่ยอมให้ ${conn.maxSpacing.toFixed(0)} ซม.`,
    })
  }

  // เหล็กขึ้นรูปเย็นคิดการโก่งเดาะเฉพาะที่ไว้แล้วในหน้าตัดประสิทธิผล (AISI) จึงไม่ต้องเตือนซ้ำ
  const slender = coldFormed ? null : slenderElement(props, Fy)
  if (slender) {
    checks.push({
      id: 'local-buckling',
      label: `ความชะลูดของ${slender.element}หน้าตัด (โก่งเดาะเฉพาะที่)`,
      actualSymbol: slender.element === 'ปีก' ? 'b/t' : 'h/tw',
      actual: slender.ratio,
      allowableSymbol: 'ขีดจำกัด',
      allowable: slender.limit,
      unit: '-',
      ratio: slender.ratio / slender.limit,
      status: 'warn',
      formula: 'เกินเกณฑ์ non-compact ของ AISC B5',
      note: 'ควรเลือกหน้าตัดที่ผนังหนาขึ้น หรือคิดกำลังลดลงตามภาคผนวก B',
    })
  }

  const hasFail = checks.some((c) => c.status === 'fail')
  const hasWarn = checks.some((c) => c.status === 'warn')
  const overall: CheckStatus = hasFail ? 'fail' : hasWarn ? 'warn' : 'pass'

  const detailing: SteelDetailing = {
    kind: 'steel',
    sectionName: resolved.name,
    categoryLabel: resolved.categoryLabel,
    gradeLabel: grade.label,
    family: single.family,
    arrangement: input.section.arrangement,
    gap: input.section.gap,
    sectionAngle: 0,
    memberAngle: 0,
    d: single.d,
    bf: single.bf,
    tw: single.tw,
    tf: single.tf,
    lip: single.lip,
    cornerRadius: single.cornerRadius,
    crown: single.crown,
    webBottom: single.webBottom,
  }

  return {
    input,
    steps,
    checks,
    overall,
    detailing,
    warnings: [...new Set(warnings)],
    summary: {
      weight: props.weight,
      maxRatio: checks.reduce((m, c) => Math.max(m, c.ratio), 0),
      sectionName: resolved.name,
    },
  }
}
