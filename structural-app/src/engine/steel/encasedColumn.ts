/**
 * เสาเหล็กหุ้มด้วยคอนกรีต (encased steel column) — มาตรฐาน วสท. วิธีหน่วยแรงใช้งาน
 *
 * เหล็กรูปพรรณเป็นตัวรับแรงหลัก คอนกรีตที่หุ้มโดยรอบ (เสริมลวดตาข่าย) ช่วยเพิ่มกำลังตามสัดส่วนพื้นที่
 *
 *   P   = Ar·fr′·(1 + Ag / (100·Ar))
 *   fr′ = 1,195 − 0.0342·(h/Ks)²     ใช้ได้เมื่อ h/Ks ≤ 120
 *
 * ที่มาของสูตรคือ ACI 318-63 ข้อ 1406 (fr′ คือสูตรเสาเหล็กของ AISC รุ่นเก่า 17,000 − 0.485(L/r)² psi)
 * รับเฉพาะแรงอัดตามแนวแกน — ไม่มีสมการแรงร่วมกับโมเมนต์ดัดในมาตรฐาน
 */

import { resolveSection, type SectionSelection } from './section'
import type { CalcStep, CheckItem, CheckStatus, SteelDetailing } from '../shared/types'
import { fmt, fmtInput, fmtSig, sigDecimals } from '../shared/units'

/** ข้อกำหนดของเสาเหล็กหุ้มคอนกรีตตามมาตรฐาน วสท. */
export const ENCASED_RULES = {
  /** fr′ = frBase − frSlope·(h/Ks)² (ksc) */
  frBase: 1195,
  frSlope: 0.0342,
  /** สูตร fr′ ใช้ได้เมื่อ h/Ks ไม่เกินค่านี้ */
  maxSlenderness: 120,
  /**
   * กำลังอัดคอนกรีตต่ำสุด (ksc)
   * ⚠ ใช้ 200 ตามข้อมูลที่ได้รับ — ACI 318-63 ต้นฉบับกำหนด 2,500 psi ≈ 176 ksc
   * และตัวอย่าง 6.4 ในตำราใช้ 180 ksc ต้องทานกับฉบับจริง
   */
  minFc: 200,
  /** คอนกรีตหุ้มเหล็กรูปพรรณหนาไม่น้อยกว่า (ซม.) */
  minCover: 6,
  /** ขนาดเสาเล็กสุด (ซม.) */
  minDimension: 20,
  /** สูตร fr′ สร้างจากเหล็กกำลังครากราว 2,300 ksc — เหล็กที่อ่อนกว่านี้ต้องระวัง */
  minFy: 2300,
  mesh: {
    label: 'ลวดตาข่ายเบอร์ 10 AS&W',
    /** เส้นผ่านศูนย์กลางลวดเบอร์ 10 AS&W = 0.135 นิ้ว (ซม.) */
    wireDia: 0.343,
    /** ระยะเรียงลวดที่พันรอบเสา (ซม.) */
    maxHoopSpacing: 10,
    /** ระยะเรียงลวดตามแนวยาวเสา (ซม.) */
    maxVerticalSpacing: 20,
    /** ระยะจากผิวคอนกรีตถึงลวด (ซม.) */
    inset: 2.5,
    /** ระยะทาบ = lapFactor × เส้นผ่านศูนย์กลางลวด */
    lapFactor: 40,
  },
} as const

export interface EncasedColumnInput {
  /** แรงอัดตามแนวแกน (กก.) */
  axial: number
  /** ความสูงเสา / ความยาวไร้การค้ำยัน (ม.) */
  height: number
  /** ด้านกว้างของเสาคอนกรีต ขนานกับปีกเหล็ก (ซม.) */
  width: number
  /** ด้านลึกของเสาคอนกรีต ขนานกับเอวเหล็ก (ซม.) */
  depth: number
  /** กำลังอัดคอนกรีต f′c (ksc) */
  fc: number
  /** ระยะเรียงลวดตาข่ายที่พันรอบเสา (ซม.) */
  meshHoopSpacing: number
  /** ระยะเรียงลวดตาข่ายตามแนวยาวเสา (ซม.) */
  meshVerticalSpacing: number
  section: SectionSelection
}

/** มิติคอนกรีตหุ้มและลวดตาข่าย ใช้วาดรูปตัด */
export interface EncasementDetailing {
  width: number
  depth: number
  fc: number
  coverX: number
  coverY: number
  meshInset: number
  meshHoopSpacing: number
  meshVerticalSpacing: number
  meshLabel: string
  wireDia: number
  lapLength: number
}

export interface EncasedColumnResult {
  input: EncasedColumnInput
  steps: CalcStep[]
  checks: CheckItem[]
  overall: CheckStatus
  detailing: SteelDetailing
  encasement: EncasementDetailing
  warnings: string[]
  summary: {
    weight: number
    /** อัตราส่วนแรงอัดต่อกำลังรับน้ำหนัก P/Pa */
    maxRatio: number
    sectionName: string
    capacity: number
  }
}

/** รายการตรวจสอบที่ขึ้นกับหน้าตัดเหล็ก — ใช้คัดหน้าตัดในตัวช่วยแนะนำ */
export const SECTION_DEPENDENT_CHECKS = new Set(['slenderness', 'capacity', 'cover'])

/** หน่วยแรงอัดยอมให้ของเหล็กรูปพรรณ fr′ (ksc) */
export function encasedSteelStress(slenderness: number): number {
  return Math.max(ENCASED_RULES.frBase - ENCASED_RULES.frSlope * slenderness ** 2, 0)
}

/** กำลังรับน้ำหนักของเสาเหล็กหุ้มคอนกรีต P = Ar·fr′·(1 + Ag/(100·Ar)) (กก.) */
export function encasedCapacity(Ar: number, frPrime: number, Ag: number): number {
  if (Ar <= 0) return 0
  return Ar * frPrime * (1 + Ag / (100 * Ar))
}

/** ขนาดเสาที่เล็กที่สุดที่หุ้มเหล็กได้ครบระยะ ปัดขึ้นทีละ 5 ซม. */
export function minimumEncasement(bf: number, d: number): { width: number; depth: number } {
  const round5 = (v: number) => Math.ceil(v / 5 - 1e-9) * 5
  const need = (v: number) => Math.max(round5(v + 2 * ENCASED_RULES.minCover), ENCASED_RULES.minDimension)
  return { width: need(bf), depth: need(d) }
}

/** ตรวจค่าขั้นต่ำ (ค่าที่มี ≥ ค่าที่ต้องการ) — อัตราส่วนคือ ค่าที่ต้องการ / ค่าที่มี */
function minimumCheck(
  base: Omit<CheckItem, 'ratio' | 'status'>,
): CheckItem {
  const ratio = base.actual > 0 ? base.allowable / base.actual : Number.POSITIVE_INFINITY
  return { ...base, ratio, status: base.actual >= base.allowable - 1e-9 ? 'pass' : 'fail' }
}

/** ตรวจค่าสูงสุด (ค่าที่เกิดขึ้น ≤ ค่าที่ยอมให้) */
function maximumCheck(
  base: Omit<CheckItem, 'ratio' | 'status'>,
): CheckItem {
  const ratio =
    base.allowable > 0 ? base.actual / base.allowable : base.actual > 0 ? Number.POSITIVE_INFINITY : 0
  return { ...base, ratio, status: base.actual <= base.allowable + 1e-9 ? 'pass' : 'fail' }
}

export function calcEncasedColumn(input: EncasedColumnInput): EncasedColumnResult {
  const R = ENCASED_RULES
  const resolved = resolveSection(input.section)
  const { props, single, grade, Fy } = resolved
  const warnings = [...resolved.warnings]

  if (input.axial < 0) {
    warnings.unshift('สูตรนี้ใช้กับแรงอัดเท่านั้น — แรงดึงต้องตรวจเหล็กรูปพรรณแยกต่างหาก')
  }
  const P = Math.max(input.axial, 0)

  const Ar = props.A
  const Ks = props.rmin
  const h = input.height * 100
  const slenderness = Ks > 0 ? h / Ks : Number.POSITIVE_INFINITY
  const frPrime = encasedSteelStress(slenderness)

  const b = input.width
  const t = input.depth
  const Ag = b * t
  const concreteFactor = Ar > 0 ? 1 + Ag / (100 * Ar) : 0
  const Ps = Ar * frPrime
  const Pa = encasedCapacity(Ar, frPrime, Ag)

  const coverX = (b - props.bf) / 2
  const coverY = (t - props.d) / 2
  const cover = Math.min(coverX, coverY)
  const coverAxis = coverX <= coverY ? 'ด้านปลายปีก' : 'ด้านหน้าปีก'
  const minSize = minimumEncasement(props.bf, props.d)

  const lapLength = Math.ceil(R.mesh.lapFactor * R.mesh.wireDia)

  // ── ขั้นตอนการคำนวณ ─────────────────────────────────────────────────
  const steps: CalcStep[] = [
    {
      symbol: 'Ar',
      label: `พื้นที่หน้าตัดเหล็กรูปพรรณ — ${resolved.name}`,
      formula: resolved.propertySource,
      value: Ar,
      unit: 'ตร.ซม.',
      decimals: sigDecimals(Ar),
    },
    {
      symbol: 'Ks',
      label: 'รัศมีไจเรชันของเหล็กรูปพรรณ แกนที่มีค่าน้อยสุด',
      substitution: `rx = ${fmtSig(props.rx)} ซม. · ry = ${fmtSig(props.ry)} ซม.`,
      value: Ks,
      unit: 'ซม.',
    },
    {
      symbol: 'h/Ks',
      label: 'อัตราส่วนความชะลูดของเหล็กรูปพรรณ',
      formula: `h/Ks ≤ ${R.maxSlenderness}`,
      substitution: `h/Ks = ${fmtInput(h)} / ${fmtSig(Ks)}`,
      value: slenderness,
      unit: '-',
    },
    {
      symbol: 'fr′',
      label: 'หน่วยแรงอัดยอมให้ของเหล็กรูปพรรณ',
      formula: 'fr′ = 1,195 − 0.0342(h/Ks)²',
      substitution: `fr′ = 1,195 − 0.0342 × ${fmt(slenderness, 2)}²`,
      value: frPrime,
      unit: 'ksc',
    },
    {
      symbol: 'Ag',
      label: 'พื้นที่หน้าตัดคอนกรีตทั้งหมด',
      formula: 'Ag = b × t',
      substitution: `Ag = ${fmtInput(b)} × ${fmtInput(t)}`,
      value: Ag,
      unit: 'ตร.ซม.',
      decimals: 0,
    },
    {
      symbol: 'Ps',
      label: 'กำลังของเหล็กรูปพรรณเปล่า (ช่วงก่อสร้างก่อนเทคอนกรีตหุ้ม)',
      formula: 'Ps = Ar·fr′',
      substitution: `Ps = ${fmtSig(Ar)} × ${fmt(frPrime, 2)}`,
      value: Ps,
      unit: 'กก.',
      decimals: 0,
    },
    {
      symbol: 'Pa',
      label: 'กำลังรับน้ำหนักของเสาเหล็กหุ้มคอนกรีต',
      formula: 'P = Ar·fr′·(1 + Ag/(100·Ar))',
      substitution:
        `P = ${fmtSig(Ar)} × ${fmt(frPrime, 2)} × (1 + ${fmt(Ag, 0)}/(100 × ${fmtSig(Ar)}))` +
        ` = ${fmt(Ps, 0)} × ${fmt(concreteFactor, 3)}`,
      value: Pa,
      unit: 'กก.',
      decimals: 0,
    },
    {
      symbol: 'c',
      label: `ระยะคอนกรีตหุ้มเหล็กรูปพรรณ — น้อยสุดที่${coverAxis}`,
      formula: 'cx = (b − bf)/2 · cy = (t − d)/2',
      substitution:
        `cx = (${fmtInput(b)} − ${fmtSig(props.bf)})/2 = ${fmt(coverX, 2)} · ` +
        `cy = (${fmtInput(t)} − ${fmtSig(props.d)})/2 = ${fmt(coverY, 2)} · ` +
        `เสาเล็กสุดที่หุ้มได้ ${minSize.width} × ${minSize.depth} ซม.`,
      value: cover,
      unit: 'ซม.',
    },
    {
      symbol: 'ลวดตาข่าย',
      label: `${R.mesh.label} (Ø ${fmt(R.mesh.wireDia * 10, 1)} มม.) ห่างผิวคอนกรีต ${R.mesh.inset} ซม.`,
      formula: `ระยะทาบ ≥ ${R.mesh.lapFactor}d = ${R.mesh.lapFactor} × ${fmt(R.mesh.wireDia * 10, 2)} มม.`,
      substitution:
        `ลวดรอบเสา @ ${fmtInput(input.meshHoopSpacing)} ซม. · ` +
        `ลวดตามยาว @ ${fmtInput(input.meshVerticalSpacing)} ซม.`,
      value: lapLength,
      unit: 'ซม.',
      decimals: 0,
    },
  ]

  // ── รายการตรวจสอบ ───────────────────────────────────────────────────
  const checks: CheckItem[] = [
    maximumCheck({
      id: 'slenderness',
      label: 'ความชะลูดของเหล็กรูปพรรณ (ขอบเขตของสูตร fr′)',
      actualSymbol: 'h/Ks',
      actual: slenderness,
      allowableSymbol: 'ขีดจำกัด',
      allowable: R.maxSlenderness,
      unit: '-',
      formula: `h/Ks ≤ ${R.maxSlenderness}`,
    }),
    maximumCheck({
      id: 'capacity',
      label: 'แรงอัดตามแนวแกน',
      actualSymbol: 'P',
      actual: P,
      allowableSymbol: 'Pa',
      allowable: Pa,
      unit: 'กก.',
      formula: 'P ≤ Ar·fr′·(1 + Ag/(100·Ar))',
    }),
    minimumCheck({
      id: 'cover',
      label: 'ความหนาคอนกรีตหุ้มเหล็กรูปพรรณ',
      actualSymbol: 'c',
      actual: cover,
      allowableSymbol: 'ต่ำสุด',
      allowable: R.minCover,
      unit: 'ซม.',
      formula: `คอนกรีตหุ้มโดยรอบหนา ≥ ${R.minCover} ซม.`,
      note:
        cover < R.minCover
          ? `ขยายเสาเป็นอย่างน้อย ${minSize.width} × ${minSize.depth} ซม. หรือเลือกเหล็กที่เล็กลง`
          : undefined,
    }),
    minimumCheck({
      id: 'min-dimension',
      label: 'ขนาดเสาเล็กสุด',
      actualSymbol: 'min(b, t)',
      actual: Math.min(b, t),
      allowableSymbol: 'ต่ำสุด',
      allowable: R.minDimension,
      unit: 'ซม.',
      formula: `ด้านแคบของเสา ≥ ${R.minDimension} ซม.`,
    }),
    minimumCheck({
      id: 'fc-min',
      label: 'กำลังอัดคอนกรีตหุ้ม',
      actualSymbol: 'f′c',
      actual: input.fc,
      allowableSymbol: 'ต่ำสุด',
      allowable: R.minFc,
      unit: 'ksc',
      formula: `f′c ≥ ${R.minFc} ksc`,
    }),
    maximumCheck({
      id: 'mesh-hoop',
      label: 'ระยะเรียงลวดตาข่ายที่พันรอบเสา',
      actualSymbol: 's',
      actual: input.meshHoopSpacing,
      allowableSymbol: 'สูงสุด',
      allowable: R.mesh.maxHoopSpacing,
      unit: 'ซม.',
      formula: `s ≤ ${R.mesh.maxHoopSpacing} ซม.`,
    }),
    maximumCheck({
      id: 'mesh-vertical',
      label: 'ระยะเรียงลวดตาข่ายตามแนวยาวเสา',
      actualSymbol: 's',
      actual: input.meshVerticalSpacing,
      allowableSymbol: 'สูงสุด',
      allowable: R.mesh.maxVerticalSpacing,
      unit: 'ซม.',
      formula: `s ≤ ${R.mesh.maxVerticalSpacing} ซม.`,
    }),
  ]

  const overall: CheckStatus = checks.some((c) => c.status === 'fail')
    ? 'fail'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'pass'

  if (Fy < R.minFy) {
    warnings.push(
      `เหล็กกำลังคราก ${fmtInput(Fy)} ksc ต่ำกว่า ${fmtInput(R.minFy)} ksc ที่สูตร fr′ ใช้เป็นฐาน — ควรใช้หน่วยแรงยอมให้ที่ต่ำลงตามจริง`,
    )
  }
  warnings.push(
    'สูตรนี้ใช้กับแรงอัดตามแนวแกนเท่านั้น หากเสามีโมเมนต์ดัดต้องตรวจเพิ่มเติม',
    'ที่ระดับพื้นทุกชั้นต้องมีแป้นรับ (bracket) ถ่ายน้ำหนักพื้นทั้งหมดเข้าสู่เหล็กรูปพรรณ',
    `เหล็กรูปพรรณต้องรับน้ำหนักช่วงก่อสร้างก่อนเทคอนกรีตหุ้มได้เอง (Ps = ${fmt(Ps, 0)} กก.)`,
  )

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
    encasement: {
      width: b,
      depth: t,
      fc: input.fc,
      coverX,
      coverY,
      meshInset: R.mesh.inset,
      meshHoopSpacing: input.meshHoopSpacing,
      meshVerticalSpacing: input.meshVerticalSpacing,
      meshLabel: R.mesh.label,
      wireDia: R.mesh.wireDia,
      lapLength,
    },
    warnings: [...new Set(warnings)],
    summary: {
      weight: props.weight,
      maxRatio: Pa > 0 ? P / Pa : Number.POSITIVE_INFINITY,
      sectionName: resolved.name,
      capacity: Pa,
    },
  }
}
