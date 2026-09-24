/**
 * คานเหล็กรูปพรรณ ออกแบบด้วยวิธีหน่วยแรงใช้งาน (AISC ASD / วสท. 1008)
 *
 * ครอบคลุมทั้งคานราบ จันทัน และแป ด้วยชิ้นส่วนชนิดเดียว โดยใช้มุมสองตัว
 *   θm = มุมเอียงของชิ้นส่วน   → ทำให้เกิดแรงตามแกน และช่วงวัดตามความลาด
 *   θs = มุมเอียงของหน้าตัด    → ทำให้โมเมนต์จากแรงดิ่งแตกเป็นสองแกน (biaxial)
 *
 * แป  = θm 0°  + θs เท่าความชันหลังคา
 * จันทัน = θm เท่าความชันหลังคา + θs 0°
 * คานราบ = 0° ทั้งคู่
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
import { E_STEEL } from './materials'
import { resolveSection, type SectionSelection } from './section'
import type { CalcStep, CheckItem, CheckStatus, SteelDetailing } from '../shared/types'
import { fmtSig, sigDecimals } from '../shared/units'

export type DeflectionPattern = 'udl' | 'point' | 'fixed' | 'cantilever' | 'none'

/**
 * เมื่อผู้ใช้ป้อนโมเมนต์แทนน้ำหนักบรรทุก ต้องย้อนหาการโก่งตัวจากโมเมนต์
 * โดยใช้สัมประสิทธิ์ตามรูปแบบแรง:  δ = k · M · L² / (E · I)
 */
export const DEFLECTION_PATTERNS: Array<{
  id: DeflectionPattern
  label: string
  coef: number
  formula: string
}> = [
  {
    id: 'udl',
    label: 'แรงกระจายสม่ำเสมอ ช่วงเดียว ปลายยึดหมุน',
    coef: 5 / 48,
    formula: 'δ = 5ML²/(48EI)',
  },
  {
    id: 'point',
    label: 'แรงกระทำเป็นจุดที่กลางช่วง',
    coef: 1 / 12,
    formula: 'δ = ML²/(12EI)',
  },
  {
    id: 'fixed',
    label: 'แรงกระจายสม่ำเสมอ ปลายยึดแน่นทั้งสองข้าง',
    coef: 1 / 16,
    formula: 'δ = ML²/(16EI)',
  },
  {
    id: 'cantilever',
    label: 'คานยื่น แรงกระจายสม่ำเสมอ',
    coef: 1 / 4,
    formula: 'δ = ML²/(4EI)',
  },
  { id: 'none', label: 'ไม่ตรวจการโก่งตัว', coef: 0, formula: '-' },
]

export type SagRodOption = 'none' | 'one' | 'two'

/** เหล็กยึดทางข้างช่วยลดโมเมนต์รอบแกนอ่อน เพราะแบ่งช่วงการดัดในทิศขนานหลังคา */
export const SAG_ROD_OPTIONS: Array<{
  id: SagRodOption
  label: string
  momentFactor: number
  spans: number
}> = [
  { id: 'none', label: 'ไม่มี', momentFactor: 1, spans: 1 },
  { id: 'one', label: '1 ตัว ที่กลางช่วง', momentFactor: 0.25, spans: 2 },
  { id: 'two', label: '2 ตัว ที่จุด 1/3 ของช่วง', momentFactor: 1 / 9, spans: 3 },
]

export interface SteelBeamInput {
  /** โมเมนต์ดัดใช้งานจากน้ำหนักบรรทุกในแนวดิ่ง (กก.-ม.) */
  moment: number
  /** แรงเฉือนใช้งาน (กก.) */
  shear: number
  /** แรงตามแกน (กก.) — บวกคือแรงอัด ลบคือแรงดึง ใส่ 0 ได้ถ้าไม่มี */
  axial: number
  /** ช่วงคาน (ม.) */
  span: number
  /** ช่วงที่ป้อนวัดตามความลาด หรือวัดตามแนวราบ */
  spanBasis: 'slope' | 'horizontal'
  /** θm — มุมเอียงของชิ้นส่วนเทียบแนวราบ (องศา) */
  memberAngle: number
  /** θs — มุมเอียงของหน้าตัด หมุนรอบแกนคาน (องศา) */
  sectionAngle: number
  /** ความยาวที่ปีกอัดไม่มีการค้ำยันทางข้าง (ม.) */
  unbracedLength: number
  /** สัมประสิทธิ์รูปแบบโมเมนต์ (1.0 คือค่าปลอดภัย) */
  Cb: number
  sagRods: SagRodOption
  deflectionPattern: DeflectionPattern
  /** เกณฑ์การโก่งตัว เช่น 360 หมายถึง L/360 */
  deflectionLimit: number
  section: SectionSelection
}

export interface SteelBeamResult {
  input: SteelBeamInput
  steps: CalcStep[]
  checks: CheckItem[]
  overall: CheckStatus
  detailing: SteelDetailing
  /** ข้อความเตือนที่ต้องแสดงคู่กับผลลัพธ์ */
  warnings: string[]
  /** สรุปค่าที่นำไปใช้ต่อ เช่น การแนะนำหน้าตัด */
  summary: {
    weight: number
    maxRatio: number
    sectionName: string
  }
}

const deg2rad = (deg: number) => (deg * Math.PI) / 180

function ratioOf(actual: number, allowable: number): number {
  if (allowable > 0) return actual / allowable
  return actual > 0 ? Number.POSITIVE_INFINITY : 0
}

function statusOf(actual: number, allowable: number): CheckStatus {
  return actual <= allowable ? 'pass' : 'fail'
}

export function calcSteelBeamASD(input: SteelBeamInput): SteelBeamResult {
  // โมเมนต์ติดลบ = แรงยก (เช่น แรงลม) ทำให้ผิวล่างรับแรงอัด — มีผลกับหน้าตัดไม่สมมาตร เช่น แปหมวก
  const uplift = input.moment < 0
  const resolved = resolveSection(input.section, { bendingSign: uplift ? -1 : 1 })
  const { props, single, Fy, grade, effective } = resolved
  const warnings = [...resolved.warnings]

  const thetaS = deg2rad(input.sectionAngle)
  const thetaM = deg2rad(input.memberAngle)

  // ── ช่วงคานตามความลาด ────────────────────────────────────────────────
  const cosM = Math.max(Math.cos(thetaM), 1e-6)
  const spanSlope = input.spanBasis === 'horizontal' ? input.span / cosM : input.span
  const L = spanSlope * 100
  const Lb = input.unbracedLength * 100

  // ── แยกโมเมนต์และแรงเฉือนเข้าแกนของหน้าตัด ────────────────────────────
  const sag = SAG_ROD_OPTIONS.find((s) => s.id === input.sagRods) ?? SAG_ROD_OPTIONS[0]
  // ตรวจด้วยขนาดของแรง — ทิศของแรงมีผลเฉพาะการเลือกด้านที่รับแรงอัดข้างบน
  const Mabs = Math.abs(input.moment)
  const Mx = Mabs * Math.cos(thetaS)
  const MyRaw = Mabs * Math.sin(thetaS)
  const My = MyRaw * sag.momentFactor
  const Vy = Math.abs(input.shear) * Math.cos(thetaS)
  const Vx = Math.abs(input.shear) * Math.sin(thetaS)

  const biaxial = Math.abs(My) > 1e-6

  // ── คุณสมบัติหน้าตัดที่ใช้จริง (เหล็กขึ้นรูปเย็นต้องใช้หน้าตัดประสิทธิผล) ──
  const coldFormed = grade.coldFormed
  const Sx = coldFormed ? effective.Se : props.Sx
  const Sy = coldFormed ? props.Sy * effective.ratioS : props.Sy
  const Aeff = coldFormed ? effective.Ae : props.A

  // ── หน่วยแรงที่ยอมให้ ────────────────────────────────────────────────
  const bendX = allowableBendingStrong(props, Fy, Lb, input.Cb)
  const bendY = allowableBendingWeak(props, Fy)
  const shearRes = allowableShear(props, Fy)

  // AISI ไม่ให้โบนัส 0.66Fy กับหน้าตัดแน่นตัว จึงจำกัดที่ 0.60Fy เมื่อเป็นเหล็กขึ้นรูปเย็น
  const Fbx = coldFormed ? Math.min(bendX.Fb, 0.6 * Fy) : bendX.Fb
  const Fby = coldFormed ? Math.min(bendY.Fb, 0.6 * Fy) : bendY.Fb
  const Fv = shearRes.Fv

  warnings.push(...bendX.notes)

  // ── หน่วยแรงที่เกิดขึ้น ──────────────────────────────────────────────
  const fbx = Sx > 0 ? (Mx * 100) / Sx : Infinity
  const fby = Sy > 0 ? (My * 100) / Sy : 0
  const fvy = props.Aw > 0 ? Vy / props.Aw : Infinity
  /** พื้นที่ปีกรับแรงเฉือนในทิศขนานหลังคา */
  const Awx = Math.max(2 * props.bf * props.tf, 1e-6)
  const fvx = Vx / Awx

  // ── แรงตามแกน ───────────────────────────────────────────────────────
  const hasAxial = Math.abs(input.axial) > 1e-6
  const compression = input.axial > 0
  // โก่งเดาะรอบแกนแข็งตลอดช่วงคาน หรือรอบแกนอ่อน (แกนหลักต่ำสุด) ระหว่างจุดค้ำยัน — ใช้ K = 1.0
  const slenderStrong = props.rx > 0 ? L / props.rx : 0
  const slenderWeak = props.rmin > 0 ? Lb / props.rmin : 0
  const slenderness = Math.max(slenderStrong, slenderWeak)
  const axialRes = allowableAxial(Fy, slenderness)
  const coldAxial = coldFormedAllowableAxial(
    Fy,
    slenderness,
    props.A > 0 ? Aeff / props.A : 1,
  )
  const Fa = coldFormed ? coldAxial.Fa : axialRes.Fa
  const Ft = allowableTension(Fy)
  const fa = Aeff > 0 ? Math.abs(input.axial) / Aeff : 0

  // ── การโก่งตัว ──────────────────────────────────────────────────────
  const pattern =
    DEFLECTION_PATTERNS.find((p) => p.id === input.deflectionPattern) ??
    DEFLECTION_PATTERNS[0]
  // เหล็กขึ้นรูปเย็นใช้โมเมนต์ความเฉื่อยประสิทธิผล (คิดที่ Fy จึงน้อยกว่าที่น้ำหนักใช้งาน — ปลอดภัย)
  const IxDefl = coldFormed ? props.Ix * effective.ratioI : props.Ix
  const IyDefl = coldFormed ? props.Iy * effective.ratioI : props.Iy
  const deflY =
    IxDefl > 0 ? (pattern.coef * Mx * 100 * L ** 2) / (E_STEEL * IxDefl) : 0
  const deflX =
    IyDefl > 0 ? (pattern.coef * My * 100 * L ** 2) / (E_STEEL * IyDefl) : 0
  const deflResultant = Math.sqrt(deflY ** 2 + deflX ** 2)
  const deflAllow = input.deflectionLimit > 0 ? L / input.deflectionLimit : Infinity

  // ── ขั้นตอนการคำนวณที่แสดงในรายงาน ──────────────────────────────────
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
      symbol: 'Sx',
      label: coldFormed ? 'โมดูลัสหน้าตัดประสิทธิผล (AISI)' : 'โมดูลัสหน้าตัด แกนแข็ง',
      formula: coldFormed ? 'Se = Sx × อัตราส่วนประสิทธิผล' : 'Sx = Ix / (d/2)',
      substitution: coldFormed
        ? `Se = ${fmtSig(props.Sx)} × ${effective.ratioS.toFixed(3)}`
        : undefined,
      value: Sx,
      unit: 'ซม.³',
      decimals: sigDecimals(Sx),
    },
    {
      symbol: 'Sy',
      label: 'โมดูลัสหน้าตัด แกนอ่อน',
      value: Sy,
      unit: 'ซม.³',
      decimals: sigDecimals(Sy),
    },
  ]

  if (input.memberAngle !== 0) {
    steps.push({
      symbol: 'L',
      label: 'ช่วงคานวัดตามความลาด',
      formula: 'L = L_ราบ / cos θm',
      substitution:
        input.spanBasis === 'horizontal'
          ? `L = ${input.span} / cos ${input.memberAngle}°`
          : 'ผู้ใช้ป้อนช่วงตามความลาดโดยตรง',
      value: spanSlope,
      unit: 'ม.',
    })
  }

  steps.push(
    {
      symbol: 'Mx',
      label: 'โมเมนต์รอบแกนแข็ง',
      formula: 'Mx = M · cos θs',
      substitution: `Mx = ${Mabs.toLocaleString()} × cos ${input.sectionAngle}°${uplift ? ' (แรงยก)' : ''}`,
      value: Mx,
      unit: 'กก.-ม.',
      decimals: sigDecimals(Mx),
    },
    {
      symbol: 'My',
      label: 'โมเมนต์รอบแกนอ่อน',
      formula:
        sag.momentFactor < 1
          ? `My = M · sin θs × ตัวลดจากเหล็กยึดทางข้าง (${sag.label})`
          : 'My = M · sin θs',
      substitution:
        sag.momentFactor < 1
          ? `My = ${fmtSig(MyRaw)} × ${sag.momentFactor.toFixed(3)}`
          : `My = ${Mabs.toLocaleString()} × sin ${input.sectionAngle}°`,
      value: My,
      unit: 'กก.-ม.',
      decimals: sigDecimals(My),
    },
    {
      symbol: 'Fbx',
      label: 'หน่วยแรงดัดที่ยอมให้ แกนแข็ง',
      formula: `${bendX.mode}: ${bendX.formula}`,
      substitution: Number.isFinite(bendX.Lc)
        ? `Lb = ${(Lb / 100).toFixed(2)} ม. · Lc = ${(bendX.Lc / 100).toFixed(2)} ม.`
        : undefined,
      value: Fbx,
      unit: 'ksc',
      decimals: 0,
    },
    {
      symbol: 'fbx',
      label: 'หน่วยแรงดัดที่เกิดขึ้น แกนแข็ง',
      formula: 'fbx = Mx / Sx',
      substitution: `fbx = ${fmtSig(Mx * 100)} / ${fmtSig(Sx)}`,
      value: fbx,
      unit: 'ksc',
      decimals: 0,
    },
  )

  if (biaxial) {
    steps.push({
      symbol: 'fby',
      label: 'หน่วยแรงดัดที่เกิดขึ้น แกนอ่อน',
      formula: 'fby = My / Sy',
      substitution: `fby = ${fmtSig(My * 100)} / ${fmtSig(Sy)}`,
      value: fby,
      unit: 'ksc',
      decimals: 0,
    })
  }

  if (pattern.id !== 'none') {
    steps.push({
      symbol: 'δ',
      label: 'การโก่งตัว',
      formula: pattern.formula,
      substitution: biaxial
        ? `ลัพธ์จากสองแกน: √(${fmtSig(deflY)}² + ${fmtSig(deflX)}²)`
        : `δ = ${pattern.coef.toFixed(4)} × ${fmtSig(Mx * 100)} × ${L.toFixed(0)}² / (${E_STEEL.toLocaleString()} × ${fmtSig(IxDefl)})`,
      value: deflResultant,
      unit: 'ซม.',
    })
  }

  // ── รายการตรวจสอบ ───────────────────────────────────────────────────
  const checks: CheckItem[] = []

  if (!hasAxial) {
    checks.push({
      id: 'bending-x',
      label: 'หน่วยแรงดัดรอบแกนแข็ง',
      actualSymbol: 'fbx',
      actual: fbx,
      allowableSymbol: 'Fbx',
      allowable: Fbx,
      unit: 'ksc',
      ratio: ratioOf(fbx, Fbx),
      status: statusOf(fbx, Fbx),
      formula: 'fbx = Mx / Sx ≤ Fbx',
      note: bendX.mode,
    })

    if (biaxial) {
      checks.push({
        id: 'bending-y',
        label: 'หน่วยแรงดัดรอบแกนอ่อน (จากหน้าตัดเอียง)',
        actualSymbol: 'fby',
        actual: fby,
        allowableSymbol: 'Fby',
        allowable: Fby,
        unit: 'ksc',
        ratio: ratioOf(fby, Fby),
        status: statusOf(fby, Fby),
        formula: 'fby = My / Sy ≤ Fby',
      })

      const combined = ratioOf(fbx, Fbx) + ratioOf(fby, Fby)
      checks.push({
        id: 'bending-combined',
        label: 'การดัดสองแกนพร้อมกัน',
        actualSymbol: 'อัตราส่วนรวม',
        actual: combined,
        allowableSymbol: '1.00',
        allowable: 1,
        unit: '-',
        ratio: combined,
        status: statusOf(combined, 1),
        formula: 'fbx/Fbx + fby/Fby ≤ 1.0',
        substitution: `${ratioOf(fbx, Fbx).toFixed(3)} + ${ratioOf(fby, Fby).toFixed(3)}`,
        note: 'เกณฑ์ควบคุมของชิ้นส่วนที่หน้าตัดวางเอียง เช่น แปหลังคา',
      })
    }
  } else {
    // มีแรงตามแกนร่วมด้วย — ใช้สมการแรงร่วมของ AISC H1
    if (compression) {
      const FexPrime = eulerStress(props.rx > 0 ? L / props.rx : 0)
      const FeyPrime = eulerStress(props.ry > 0 ? Lb / props.ry : 0)
      for (const c of combinedStress(
        fa,
        Fa,
        fbx,
        Fbx,
        fby,
        Fby,
        Fy,
        input.Cb >= 1 ? 0.85 : 1,
        0.85,
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

  checks.push({
    id: 'shear-y',
    label: 'หน่วยแรงเฉือนในเอว',
    actualSymbol: 'fv',
    actual: fvy,
    allowableSymbol: 'Fv',
    allowable: Fv,
    unit: 'ksc',
    ratio: ratioOf(fvy, Fv),
    status: statusOf(fvy, Fv),
    formula: 'fv = Vy / Aw ≤ 0.40Fy',
    substitution: `fv = ${fmtSig(Vy)} / ${fmtSig(props.Aw)}`,
    note: shearRes.reduced ? 'เอวชะลูด จึงลดหน่วยแรงเฉือนที่ยอมให้' : undefined,
  })

  if (biaxial) {
    checks.push({
      id: 'shear-x',
      label: 'หน่วยแรงเฉือนในปีก (ทิศขนานหลังคา)',
      actualSymbol: 'fvx',
      actual: fvx,
      allowableSymbol: 'Fv',
      allowable: Fv,
      unit: 'ksc',
      ratio: ratioOf(fvx, Fv),
      status: statusOf(fvx, Fv),
      formula: 'fvx = Vx / (2·bf·tf) ≤ 0.40Fy',
    })
  }

  if (pattern.id !== 'none') {
    checks.push({
      id: 'deflection',
      label: `การโก่งตัว (เกณฑ์ L/${input.deflectionLimit})`,
      actualSymbol: 'δ',
      actual: deflResultant,
      allowableSymbol: 'δ_allow',
      allowable: deflAllow,
      unit: 'ซม.',
      ratio: ratioOf(deflResultant, deflAllow),
      status: statusOf(deflResultant, deflAllow),
      formula: pattern.formula,
      note: biaxial
        ? `ตั้งฉากหลังคา ${fmtSig(deflY)} ซม. · ขนานหลังคา ${fmtSig(deflX)} ซม.`
        : `คำนวณย้อนจากโมเมนต์ตามสมมติฐาน: ${pattern.label}`,
    })
  }

  if (hasAxial && compression) {
    checks.push({
      id: 'slenderness',
      label: 'ความชะลูดของชิ้นส่วนรับแรงอัด',
      actualSymbol: 'KL/r',
      actual: slenderness,
      allowableSymbol: 'ขีดจำกัด',
      allowable: SLENDERNESS_LIMIT.compression,
      unit: '-',
      ratio: ratioOf(slenderness, SLENDERNESS_LIMIT.compression),
      status: statusOf(slenderness, SLENDERNESS_LIMIT.compression),
      formula: 'KL/r ≤ 200 (K = 1.0)',
      note: `แกนแข็ง L/rx = ${slenderStrong.toFixed(1)} · แกนอ่อน Lb/rmin = ${slenderWeak.toFixed(1)}`,
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
      note: `ระยะห่างจุดยึดสูงสุดที่ยอมให้ ${(conn.maxSpacing).toFixed(0)} ซม.`,
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
    sectionAngle: input.sectionAngle,
    memberAngle: input.memberAngle,
    d: single.d,
    bf: single.bf,
    tw: single.tw,
    tf: single.tf,
    lip: single.lip,
    cornerRadius: single.cornerRadius,
    crown: single.crown,
    webBottom: single.webBottom,
  }

  const maxRatio = checks.reduce((m, c) => Math.max(m, c.ratio), 0)

  return {
    input,
    steps,
    checks,
    overall,
    detailing,
    warnings: [...new Set(warnings)],
    summary: { weight: props.weight, maxRatio, sectionName: resolved.name },
  }
}
