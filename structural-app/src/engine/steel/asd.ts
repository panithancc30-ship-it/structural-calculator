/**
 * หน่วยแรงที่ยอมให้ตามวิธีหน่วยแรงใช้งาน (AISC ASD 9th Edition / วสท. 1008)
 *
 * ค่าคงที่ในตำรา AISC เป็นหน่วย ksi จึงแปลงเป็น ksc โดยอ้างอิงกับ E โดยตรง
 * (เช่น 102000 ksi ÷ 29000 ksi = 3.5172 → ใช้ 3.5172·E) เพื่อไม่ให้เกิดความผิดพลาดจากการแปลงหน่วย
 */

import { E_STEEL } from './materials'
import type { SectionProps } from './geometry'

/** ค่าคงที่ของ AISC เขียนเป็นสัดส่วนต่อ E เพื่อให้ใช้ได้ทุกระบบหน่วย */
const F1_6_START = 102000 / 29000
const F1_7_START = 510000 / 29000
const F1_6_DENOM = 1530000 / 29000
const F1_7_COEF = 170000 / 29000
const F1_8_COEF = 12000 / 29000

/** ตัวคูณแปลงค่าคงที่ความชะลูดของ AISC จากหน่วย ksi เป็น ksc: √(1 ksi / 1 ksc) */
const KSI_TO_KSC_SQRT = Math.sqrt(70.307)

/** ขีดจำกัดความชะลูดของแผ่นองค์ประกอบ (AISC Table B5.1) — คืนค่าในหน่วย ksc */
export function slendernessLimits(Fy: number) {
  const s = KSI_TO_KSC_SQRT / Math.sqrt(Fy)
  return {
    /** ปีกหน้าตัด I ที่ถือว่า compact */
    flangeCompact: 65 * s,
    /** ปีกหน้าตัด I ที่ยังไม่เป็น slender */
    flangeNonCompact: 95 * s,
    /** เอวรับการดัดที่ถือว่า compact */
    webCompact: 640 * s,
    /** เอวรับการดัดที่ยังไม่เป็น slender */
    webNonCompact: 970 * s,
    /** ปีกของหน้าตัดกล่องที่ถือว่า compact */
    boxFlangeCompact: 190 * s,
    /** ปีกของหน้าตัดกล่องที่ยังไม่เป็น slender */
    boxFlangeNonCompact: 238 * s,
    /** เอวที่ไม่ต้องลดหน่วยแรงเฉือน */
    shearFull: 380 * s,
    /** ขาเหล็กฉากรับแรงอัดที่ยังไม่เป็น slender */
    angleNonCompact: 76 * s,
  }
}

export type CompactClass = 'compact' | 'non-compact' | 'slender'

/** หน้าตัดรูปรางน้ำ (รวมตัวซีขึ้นรูปเย็น) — ไม่สมมาตรรอบระนาบเอว */
export function isChannelFamily(props: SectionProps): boolean {
  return props.family === 'channel' || props.family === 'lipped-channel'
}

export interface SlenderElement {
  element: 'ปีก' | 'เอว'
  ratio: number
  limit: number
}

/** องค์ประกอบที่ชะลูดเกินเกณฑ์ non-compact (AISC B5) พร้อมขีดจำกัดจริง — คืน null ถ้าไม่มี */
export function slenderElement(props: SectionProps, Fy: number): SlenderElement | null {
  const lim = slendernessLimits(Fy)
  const tube = props.family === 'box' || props.family === 'pipe'
  const flangeLimit = tube ? lim.boxFlangeNonCompact : lim.flangeNonCompact
  if (props.slenderness.flange > flangeLimit) {
    return { element: 'ปีก', ratio: props.slenderness.flange, limit: flangeLimit }
  }
  if (props.slenderness.web > lim.webNonCompact) {
    return { element: 'เอว', ratio: props.slenderness.web, limit: lim.webNonCompact }
  }
  return null
}

export function classifySection(props: SectionProps, Fy: number): CompactClass {
  const lim = slendernessLimits(Fy)
  const { flange, web } = props.slenderness

  const flangeLimitCompact =
    props.family === 'box' || props.family === 'pipe'
      ? lim.boxFlangeCompact
      : lim.flangeCompact
  const flangeLimitSlender =
    props.family === 'box' || props.family === 'pipe'
      ? lim.boxFlangeNonCompact
      : lim.flangeNonCompact

  if (flange > flangeLimitSlender || web > lim.webNonCompact) return 'slender'
  if (flange > flangeLimitCompact || web > lim.webCompact) return 'non-compact'
  return 'compact'
}

/** ความยาวไร้การค้ำยันสูงสุดที่ยังใช้ Fb = 0.66Fy ได้ (AISC F1-2) — หน่วย ซม. */
export function unbracedLimitLc(props: SectionProps, Fy: number): number {
  const byFlange = (76 * KSI_TO_KSC_SQRT * props.bf) / Math.sqrt(Fy)
  const byArea = props.dAf > 0 ? (20000 * 70.307) / (props.dAf * Fy) : Infinity
  return Math.min(byFlange, byArea)
}

export interface BendingResult {
  /** หน่วยแรงดัดที่ยอมให้ (ksc) */
  Fb: number
  /** เกณฑ์ที่ควบคุมค่า */
  mode: string
  formula: string
  compactness: CompactClass
  /** ความยาวไร้การค้ำยันสูงสุดสำหรับ 0.66Fy (ซม.) */
  Lc: number
  notes: string[]
}

/**
 * หน่วยแรงดัดที่ยอมให้รอบแกนแข็ง
 * @param Lb ความยาวที่ปีกอัดไม่มีการค้ำยันทางข้าง (ซม.)
 * @param Cb สัมประสิทธิ์รูปแบบโมเมนต์ (1.0 คือค่าปลอดภัย)
 */
export function allowableBendingStrong(
  props: SectionProps,
  Fy: number,
  Lb: number,
  Cb: number,
): BendingResult {
  const compactness = classifySection(props, Fy)
  const Lc = unbracedLimitLc(props, Fy)
  const notes: string[] = []

  // หน้าตัดปิดมีความแข็งในการบิดสูงมาก จึงไม่เกิดการโก่งเดาะด้านข้าง
  if (props.closed) {
    const Fb = compactness === 'compact' ? 0.66 * Fy : 0.6 * Fy
    return {
      Fb,
      mode: compactness === 'compact' ? 'หน้าตัดปิด แน่นตัว' : 'หน้าตัดปิด ไม่แน่นตัว',
      formula: compactness === 'compact' ? 'Fb = 0.66Fy' : 'Fb = 0.60Fy',
      compactness,
      Lc: Infinity,
      notes: ['หน้าตัดปิด (กล่อง/ท่อ) ไม่ต้องตรวจการโก่งเดาะด้านข้าง'],
    }
  }

  // ดัดรอบแกนที่มี I มากกว่าหรือเท่ากับอีกแกน จะไม่เกิดการโก่งเดาะด้านข้าง (เช่น แปหมวกที่กว้างกว่าสูง)
  // ยกเว้นเหล็กฉาก เพราะแกนเรขาคณิตไม่ใช่แกนหลัก
  if (props.Iy >= props.Ix && props.family !== 'angle') {
    const Fb = compactness === 'compact' ? 0.66 * Fy : 0.6 * Fy
    return {
      Fb,
      mode: 'Iy ≥ Ix ไม่เกิดการโก่งเดาะด้านข้าง',
      formula: compactness === 'compact' ? 'Fb = 0.66Fy' : 'Fb = 0.60Fy',
      compactness,
      Lc: Infinity,
      notes: [],
    }
  }

  if (compactness === 'compact' && Lb <= Lc) {
    return {
      Fb: 0.66 * Fy,
      mode: 'หน้าตัดแน่นตัว และค้ำยันเพียงพอ',
      formula: 'Fb = 0.66Fy',
      compactness,
      Lc,
      notes: [],
    }
  }

  if (Lb <= Lc) {
    return {
      Fb: 0.6 * Fy,
      mode: 'หน้าตัดไม่แน่นตัว',
      formula: 'Fb = 0.60Fy',
      compactness,
      Lc,
      notes:
        compactness === 'slender'
          ? ['องค์ประกอบหน้าตัดชะลูดเกินเกณฑ์ AISC — ควรเลือกหน้าตัดที่หนาขึ้น']
          : [],
    }
  }

  // โก่งเดาะด้านข้างควบคู่กับการบิด (AISC F1-6, F1-7, F1-8)
  const ratio = props.rT > 0 ? Lb / props.rT : Infinity
  const start = Math.sqrt((F1_6_START * Cb * E_STEEL) / Fy)
  const end = Math.sqrt((F1_7_START * Cb * E_STEEL) / Fy)

  let fbTorsion = 0
  let torsionFormula = ''
  if (ratio < start) {
    fbTorsion = 0.6 * Fy
    torsionFormula = 'Lb/rT ยังต่ำกว่าเกณฑ์โก่งเดาะ → Fb = 0.60Fy'
  } else if (ratio <= end) {
    fbTorsion = (2 / 3 - (Fy * ratio ** 2) / (F1_6_DENOM * Cb * E_STEEL)) * Fy
    torsionFormula = 'Fb = [2/3 − Fy(Lb/rT)²/(52.76·Cb·E)]·Fy'
  } else {
    fbTorsion = (F1_7_COEF * Cb * E_STEEL) / ratio ** 2
    torsionFormula = 'Fb = 5.862·Cb·E/(Lb/rT)²'
  }

  // สูตรปีกอัดอย่างเดียว ใช้ได้กับหน้าตัดที่ปีกอัดเป็นสี่เหลี่ยมตัน
  const fbFlange =
    props.dAf > 0 && Lb > 0 ? (F1_8_COEF * Cb * E_STEEL) / (Lb * props.dAf) : 0

  // AISC F1.3: รางน้ำที่ดัดรอบแกนแข็งใช้ได้เฉพาะสูตร F1-8
  // (หน้าตัดไม่สมมาตรรอบระนาบเอว สูตร F1-6/F1-7 ที่อาศัยความแข็งบิดของหน้าตัด I จึงไม่ปลอดภัย)
  const channelOnly = isChannelFamily(props)
  const Fb = Math.min(0.6 * Fy, channelOnly ? fbFlange : Math.max(fbTorsion, fbFlange))

  notes.push(
    `ความยาวไร้การค้ำยัน ${(Lb / 100).toFixed(2)} ม. เกิน Lc = ${(Lc / 100).toFixed(2)} ม. ` +
      'จึงต้องลดหน่วยแรงดัดลงจากการโก่งเดาะด้านข้าง',
  )
  if (Fb < 0.45 * Fy) {
    notes.push('หน่วยแรงที่ยอมให้ลดลงมาก — ควรเพิ่มจุดค้ำยันปีกอัด เช่น ใส่ค้ำยันกลางช่วง')
  }

  return {
    Fb,
    mode: 'ควบคุมโดยการโก่งเดาะด้านข้าง (LTB)',
    formula:
      channelOnly || fbFlange > fbTorsion
        ? `Fb = 0.414·Cb·E/(Lb·d/Af)${channelOnly ? ' (รางน้ำใช้ F1-8 เท่านั้น)' : ''}`
        : torsionFormula,
    compactness,
    Lc,
    notes,
  }
}

/** หน่วยแรงดัดที่ยอมให้รอบแกนอ่อน (AISC F2) */
export function allowableBendingWeak(props: SectionProps, Fy: number): BendingResult {
  const compactness = classifySection(props, Fy)
  const lim = slendernessLimits(Fy)

  // แกนอ่อนไม่เกิดการโก่งเดาะด้านข้าง จึงขึ้นกับความแน่นตัวของปีกเท่านั้น
  const canUse075 =
    (props.family === 'i-shape' || props.family === 'built-up') &&
    props.doublySymmetric &&
    props.slenderness.flange <= lim.flangeCompact

  if (props.closed) {
    return {
      Fb: compactness === 'compact' ? 0.66 * Fy : 0.6 * Fy,
      mode: 'หน้าตัดปิด',
      formula: compactness === 'compact' ? 'Fb = 0.66Fy' : 'Fb = 0.60Fy',
      compactness,
      Lc: Infinity,
      notes: [],
    }
  }

  if (canUse075) {
    return {
      Fb: 0.75 * Fy,
      mode: 'ดัดรอบแกนอ่อน ปีกแน่นตัว',
      formula: 'Fb = 0.75Fy',
      compactness,
      Lc: Infinity,
      notes: [],
    }
  }

  return {
    Fb: 0.6 * Fy,
    mode: 'ดัดรอบแกนอ่อน',
    formula: 'Fb = 0.60Fy',
    compactness,
    Lc: Infinity,
    notes: [],
  }
}

export interface ShearResult {
  Fv: number
  formula: string
  reduced: boolean
}

/** หน่วยแรงเฉือนที่ยอมให้ (AISC F4) */
export function allowableShear(props: SectionProps, Fy: number): ShearResult {
  const lim = slendernessLimits(Fy)
  const hOverT = props.slenderness.web

  if (hOverT <= lim.shearFull) {
    return { Fv: 0.4 * Fy, formula: 'Fv = 0.40Fy', reduced: false }
  }

  // เอวชะลูด ต้องลดหน่วยแรงเฉือน — สมมติไม่มีแผ่นเสริมกันเอวโก่ง (kv = 5.34)
  const kv = 5.34
  const cvHigh = (190 * KSI_TO_KSC_SQRT * Math.sqrt(kv / Fy)) / hOverT
  const Cv =
    cvHigh > 0.8
      ? cvHigh
      : (45000 * 70.307 * kv) / (Fy * hOverT ** 2)

  return {
    Fv: Math.min((Fy * Cv) / 2.89, 0.4 * Fy),
    formula: 'Fv = Fy·Cv/2.89 (เอวชะลูด ไม่มีแผ่นเสริมกันโก่ง)',
    reduced: true,
  }
}

export interface AxialResult {
  /** หน่วยแรงอัดที่ยอมให้ (ksc) */
  Fa: number
  /** ความชะลูดที่ควบคุม */
  slenderness: number
  /** ความชะลูดที่แบ่งระหว่างเสาสั้นกับเสายาว */
  Cc: number
  /** เสายาว (โก่งเดาะแบบยืดหยุ่น) */
  elastic: boolean
  /** ตัวคูณความปลอดภัย */
  FS: number
  formula: string
}

/** หน่วยแรงอัดที่ยอมให้ (AISC E2) */
export function allowableAxial(Fy: number, slenderness: number): AxialResult {
  const Cc = Math.sqrt((2 * Math.PI ** 2 * E_STEEL) / Fy)

  if (slenderness <= 0) {
    return {
      Fa: 0.6 * Fy,
      slenderness: 0,
      Cc,
      elastic: false,
      FS: 1.67,
      formula: 'Fa = 0.60Fy (ไม่มีความชะลูด)',
    }
  }

  if (slenderness <= Cc) {
    const ratio = slenderness / Cc
    const FS = 5 / 3 + (3 * ratio) / 8 - ratio ** 3 / 8
    return {
      Fa: ((1 - ratio ** 2 / 2) * Fy) / FS,
      slenderness,
      Cc,
      elastic: false,
      FS,
      formula: 'Fa = [1 − (KL/r)²/(2Cc²)]·Fy / FS',
    }
  }

  return {
    Fa: (12 * Math.PI ** 2 * E_STEEL) / (23 * slenderness ** 2),
    slenderness,
    Cc,
    elastic: true,
    FS: 23 / 12,
    formula: "Fa = 12π²E / (23(KL/r)²)",
  }
}

/** หน่วยแรงดึงที่ยอมให้บนหน้าตัดเต็ม (AISC D1) */
export function allowableTension(Fy: number): number {
  return 0.6 * Fy
}

/** หน่วยแรงดัดยูเลอร์หารด้วยตัวคูณความปลอดภัย ใช้ในสมการแรงร่วม (AISC H1) */
export function eulerStress(slenderness: number): number {
  if (slenderness <= 0) return Infinity
  return (12 * Math.PI ** 2 * E_STEEL) / (23 * slenderness ** 2)
}

/** ขีดจำกัดความชะลูด (AISC B7) */
export const SLENDERNESS_LIMIT = {
  compression: 200,
  tension: 300,
} as const

export interface CombinedResult {
  /** อัตราส่วนกำลังที่ใช้ไป (≤ 1.0 คือผ่าน) */
  ratio: number
  /** สมการที่ควบคุม */
  equation: 'H1-1' | 'H1-2' | 'H1-3'
  formula: string
  substitution: string
}

/**
 * สมการแรงอัดร่วมกับการดัด (AISC H1)
 * เมื่อแรงอัดน้อย (fa/Fa ≤ 0.15) ใช้สมการรวมอย่างง่าย
 * มิฉะนั้นต้องคิดผลขยายโมเมนต์จากการโก่งตัวของเสา (P-δ) ด้วยตัวคูณ 1/(1 − fa/F'e)
 */
export function combinedStress(
  fa: number,
  Fa: number,
  fbx: number,
  Fbx: number,
  fby: number,
  Fby: number,
  Fy: number,
  Cmx: number,
  Cmy: number,
  FexPrime: number,
  FeyPrime: number,
): CombinedResult[] {
  const safe = (v: number, d: number) => (d > 0 ? v / d : v > 0 ? Infinity : 0)
  const raxial = safe(fa, Fa)
  const rbx = safe(fbx, Fbx)
  const rby = safe(fby, Fby)

  if (raxial <= 0.15) {
    return [
      {
        ratio: raxial + rbx + rby,
        equation: 'H1-3',
        formula: 'fa/Fa + fbx/Fbx + fby/Fby ≤ 1.0',
        substitution: `${raxial.toFixed(3)} + ${rbx.toFixed(3)} + ${rby.toFixed(3)}`,
      },
    ]
  }

  const ampX = FexPrime > fa ? 1 / (1 - fa / FexPrime) : Infinity
  const ampY = FeyPrime > fa ? 1 / (1 - fa / FeyPrime) : Infinity

  return [
    {
      ratio: raxial + Cmx * rbx * ampX + Cmy * rby * ampY,
      equation: 'H1-1',
      formula: "fa/Fa + Cmx·fbx/[(1 − fa/F'ex)Fbx] + Cmy·fby/[(1 − fa/F'ey)Fby] ≤ 1.0",
      substitution:
        `${raxial.toFixed(3)} + ${Cmx}×${rbx.toFixed(3)}×${Number.isFinite(ampX) ? ampX.toFixed(3) : '∞'}` +
        ` + ${Cmy}×${rby.toFixed(3)}×${Number.isFinite(ampY) ? ampY.toFixed(3) : '∞'}`,
    },
    {
      ratio: safe(fa, 0.6 * Fy) + rbx + rby,
      equation: 'H1-2',
      formula: 'fa/(0.60Fy) + fbx/Fbx + fby/Fby ≤ 1.0',
      substitution: `${safe(fa, 0.6 * Fy).toFixed(3)} + ${rbx.toFixed(3)} + ${rby.toFixed(3)}`,
    },
  ]
}
