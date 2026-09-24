/**
 * หน้าตัดประสิทธิผลของเหล็กขึ้นรูปเย็น ตามวิธีความกว้างประสิทธิผล (AISI S100 B2–B3)
 *
 * เหล็กขึ้นรูปเย็นผนังบาง (ตัวซี มอก. 1228, ตัวซีกำลังสูง G550, แปหมวก) เกิดการโก่งเดาะเฉพาะที่
 * ก่อนถึงกำลังคราก จึงต้องลดความกว้างของแผ่นที่รับแรงอัด แล้วคิดกำลังจากหน้าตัดที่เหลือเท่านั้น
 *
 * ใช้ตัวแก้สมการชุดเดียวกับทุกรูปทรง: หน้าตัดถูกแทนด้วยแผ่นบาง (geometry.ts → Plate)
 * ที่ระบุการยึดขอบไว้ แล้ววนหาตำแหน่งแกนสะเทินจนลู่เข้า
 */

import { E_STEEL } from './materials'
import {
  hatPlates,
  lippedPlates,
  plateLength,
  propsFromPlates,
  type HatDims,
  type LippedChannelDims,
  type Plate,
  type SectionProps,
} from './geometry'

/**
 * ความกว้างประสิทธิผลของแผ่นรับแรงอัด (AISI B2.1)
 * @param w ความกว้างราบของแผ่น (ซม.)
 * @param t ความหนา (ซม.)
 * @param f หน่วยแรงอัดที่กระทำ (ksc)
 * @param k สัมประสิทธิ์การโก่งเดาะของแผ่น (4 = ยึดสองขอบ, 0.43 = ขอบอิสระข้างหนึ่ง)
 */
export function effectiveWidth(w: number, t: number, f: number, k: number): number {
  if (w <= 0 || t <= 0 || f <= 0) return Math.max(w, 0)

  /** ความชะลูดสัมพัทธ์ λ = (1.052/√k)(w/t)√(f/E) */
  const lambda = (1.052 / Math.sqrt(k)) * (w / t) * Math.sqrt(f / E_STEEL)
  if (lambda <= 0.673) return w

  const rho = (1 - 0.22 / lambda) / lambda
  return rho * w
}

/**
 * สัมประสิทธิ์การโก่งเดาะของแผ่นยึดสองขอบที่หน่วยแรงไล่ระดับ (AISI B2.3)
 * @param psi f2/f1 แบบมีเครื่องหมาย (แรงอัดเป็นบวก) — เอวรับการดัดล้วน ψ = −1 → k = 24
 */
export function webBucklingCoef(psi: number): number {
  return 4 + 2 * (1 - psi) ** 3 + 2 * (1 - psi)
}

export interface WebEffectiveParts {
  /** ความกว้างประสิทธิผลรวม (ซม.) */
  be: number
  /** ส่วนประสิทธิผลที่ติดขอบด้านรับแรงอัดมาก (ซม.) */
  b1: number
  /** ส่วนประสิทธิผลที่ติดแกนสะเทิน (ซม.) */
  b2: number
  /** ความยาวช่วงที่รับแรงอัด (ซม.) */
  compression: number
  /** ใช้ได้เต็มแผ่น */
  full: boolean
}

/**
 * แบ่งส่วนประสิทธิผลของแผ่นยึดสองขอบที่มีหน่วยแรงไล่ระดับ (AISI B2.3)
 * @param fc หน่วยแรงอัดที่ขอบซึ่งอัดมากกว่า (บวก)
 * @param fo หน่วยแรงที่อีกขอบ (บวก = อัด, ลบ = ดึง)
 */
export function webEffectiveParts(w: number, t: number, fc: number, fo: number): WebEffectiveParts {
  const psi = fo / fc
  const be = effectiveWidth(w, t, fc, webBucklingCoef(psi))

  if (fo >= 0) {
    // อัดทั้งแผ่น: ส่วนที่ไม่ประสิทธิผลอยู่กลางแผ่น
    const b1 = be / (3 - psi)
    const b2 = be - b1
    return { be, b1, b2, compression: w, full: be >= w - 1e-9 }
  }

  // มีแรงดึงที่อีกขอบ: ψ = |f2/f1|, b1 = be/(3+ψ), b2 = be/2 เมื่อ ψ > 0.236 มิฉะนั้น be − b1
  const psiAbs = -psi
  const compression = (w * fc) / (fc - fo)
  const b1 = be / (3 + psiAbs)
  const b2 = psiAbs > 0.236 ? be / 2 : be - b1
  return { be, b1, b2, compression, full: b1 + b2 >= compression - 1e-9 }
}

export interface EffectiveResult {
  /** โมดูลัสหน้าตัดประสิทธิผลสำหรับการดัด (ซม.³) */
  Se: number
  /** พื้นที่ประสิทธิผลสำหรับแรงอัด (ตร.ซม.) */
  Ae: number
  /** โมเมนต์ความเฉื่อยประสิทธิผล (ซม.⁴) — ใช้คำนวณการโก่งตัวแบบปลอดภัย */
  Ie: number
  /** อัตราส่วนที่เหลือจากหน้าตัดเต็ม */
  ratioS: number
  ratioA: number
  ratioI: number
  /** หน้าตัดใช้ได้เต็มที่ ไม่มีการลด */
  fullyEffective: boolean
  notes: string[]
}

/** หน้าตัดที่ไม่ต้องลด (เหล็กรีดร้อน) */
export function grossEffective(props: SectionProps): EffectiveResult {
  return {
    Se: props.Sx,
    Ae: props.A,
    Ie: props.Ix,
    ratioS: 1,
    ratioA: 1,
    ratioI: 1,
    fullyEffective: true,
    notes: [],
  }
}

/** ช่วงที่ยังใช้ได้ วัดเป็นระยะจากปลาย start ของแผ่น (ซม.) */
type Interval = [number, number]

/** ส่วนย่อยของแผ่นสำหรับรวมคุณสมบัติ: ความยาว, y กึ่งกลาง, ช่วงยื่นตามแนวดิ่ง */
interface Piece {
  len: number
  y: number
  dy: number
}

function piecesOf(p: Plate, keep: Interval[]): Piece[] {
  const L = plateLength(p)
  if (L <= 0) return []
  const sorted = keep
    .map(([a, b]): Interval => [Math.max(0, Math.min(a, L)), Math.max(0, Math.min(b, L))])
    .filter(([a, b]) => b > a)
    .sort((m, n) => m[0] - n[0])

  const merged: Interval[] = []
  for (const iv of sorted) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }

  const dyPerLen = (p.y2 - p.y1) / L
  return merged.map(([a, b]) => ({
    len: b - a,
    y: p.y1 + dyPerLen * ((a + b) / 2),
    dy: dyPerLen * (b - a),
  }))
}

/** กลับทิศระยะ เมื่อวัดจากปลาย end แทน start */
function fromEnd(L: number, keep: Interval[]): Interval[] {
  return keep.map(([a, b]) => [L - b, L - a])
}

/** ส่วนที่ยังประสิทธิผลของแผ่นหนึ่งแผ่น ภายใต้หน่วยแรง f(y) (แรงอัดเป็นบวก) */
function effectivePieces(p: Plate, t: number, stressAt: (y: number) => number): Piece[] {
  const L = plateLength(p)
  const full: Interval[] = [[0, L]]
  if (p.support === 'corner') return piecesOf(p, full)

  const f1 = stressAt(p.y1)
  const f2 = stressAt(p.y2)
  if (f1 <= 0 && f2 <= 0) return piecesOf(p, full)

  if (p.support === 'both') {
    const startCompressed = f1 >= f2
    const fc = Math.max(f1, f2)
    const fo = Math.min(f1, f2)

    let keep: Interval[]
    if (Math.abs(fc - fo) <= 1e-9 * fc) {
      // หน่วยแรงสม่ำเสมอ: ส่วนที่ไม่ประสิทธิผลอยู่กลางแผ่น
      const be = effectiveWidth(L, t, fc, 4)
      keep = [
        [0, be / 2],
        [L - be / 2, L],
      ]
    } else {
      const parts = webEffectiveParts(L, t, fc, fo)
      if (parts.full) keep = full
      else if (fo >= 0)
        keep = [
          [0, parts.b1],
          [L - parts.b2, L],
        ]
      else
        keep = [
          [0, parts.b1],
          [parts.compression - parts.b2, L],
        ]
    }
    return piecesOf(p, startCompressed ? keep : fromEnd(L, keep))
  }

  // แผ่นขอบอิสระ: ส่วนประสิทธิผลต้องติดขอบที่ถูกยึด (AISI B3)
  const attachedAtStart = p.support === 'start'
  const fAttached = attachedAtStart ? f1 : f2
  const fFree = attachedAtStart ? f2 : f1

  let keep: Interval[]
  if (fAttached >= 0 && fFree >= 0) {
    keep = [[0, effectiveWidth(L, t, Math.max(fAttached, fFree), 0.43)]]
  } else if (fAttached > 0) {
    // อัดที่ขอบยึด ดึงที่ขอบอิสระ
    const zero = (L * fAttached) / (fAttached - fFree)
    keep = [
      [0, Math.min(zero, effectiveWidth(L, t, fAttached, 0.43))],
      [zero, L],
    ]
  } else {
    // ดึงที่ขอบยึด อัดที่ขอบอิสระ
    const zero = (L * -fAttached) / (fFree - fAttached)
    keep = [
      [0, zero],
      [zero, zero + effectiveWidth(L - zero, t, fFree, 0.43)],
    ]
  }
  return piecesOf(p, attachedAtStart ? keep : fromEnd(L, keep))
}

function sumPieces(pieces: Piece[], t: number) {
  const L = pieces.reduce((s, e) => s + e.len, 0)
  const ybar = L > 0 ? pieces.reduce((s, e) => s + e.len * e.y, 0) / L : 0
  const I =
    t * pieces.reduce((s, e) => s + (e.len * e.dy ** 2) / 12 + e.len * (e.y - ybar) ** 2, 0)
  return { ybar, I }
}

export interface ThinWallEffective {
  /** อัตราส่วนเทียบหน้าตัดเต็มของแบบจำลองเดียวกัน */
  ratioS: number
  ratioA: number
  ratioI: number
}

/**
 * หน้าตัดประสิทธิผลของหน้าตัดผนังบางใด ๆ ที่รับการดัดรอบแกนนอน
 * @param compressionTop true = ผิวบนรับแรงอัด (แรงกดลง), false = ผิวล่างรับแรงอัด (แรงยก)
 *
 * คิดหน่วยแรงที่ผิวอัดเท่ากับ Fy — ถ้าผิวดึงอยู่ไกลกว่า หน่วยแรงอัดจริงจะน้อยกว่านี้
 * ผลจึงลดหน้าตัดมากกว่าที่ AISI กำหนดเล็กน้อย (ปลอดภัย)
 */
export function effectiveThinWall(
  plates: Plate[],
  t: number,
  Fy: number,
  compressionTop: boolean,
): ThinWallEffective {
  const gross = propsFromPlates(plates, t)
  const SxGross = gross.Ix / Math.max(gross.yMax - gross.ybar, gross.ybar - gross.yMin)

  let yna = gross.ybar
  let Ie = gross.Ix
  for (let pass = 0; pass < 10; pass++) {
    const cComp = compressionTop ? gross.yMax - yna : yna - gross.yMin
    if (cComp <= 0) break
    const stressAt = (y: number) => (Fy * (compressionTop ? y - yna : yna - y)) / cComp
    const next = sumPieces(
      plates.flatMap((p) => effectivePieces(p, t, stressAt)),
      t,
    )
    const converged = Math.abs(next.ybar - yna) < 1e-7
    yna = next.ybar
    Ie = next.I
    if (converged) break
  }

  const Se = Ie / Math.max(gross.yMax - yna, yna - gross.yMin)

  // แรงอัดสม่ำเสมอทั้งหน้าตัดที่ Fy
  const aeLength = plates.reduce((s, p) => {
    const L = plateLength(p)
    if (p.support === 'corner') return s + L
    return s + effectiveWidth(L, t, Fy, p.support === 'both' ? 4 : 0.43)
  }, 0)

  return {
    ratioS: Math.min(Se / SxGross, 1),
    ratioA: Math.min((aeLength * t) / gross.A, 1),
    ratioI: Math.min(Ie / gross.Ix, 1),
  }
}

function toResult(props: SectionProps, eff: ThinWallEffective): EffectiveResult {
  const notes: string[] = []
  const fullyEffective = eff.ratioS > 0.995 && eff.ratioA > 0.995
  if (!fullyEffective) {
    notes.push(
      `หน้าตัดโก่งเดาะเฉพาะที่ก่อนคราก — ใช้ได้ ${(eff.ratioS * 100).toFixed(0)}% ของโมดูลัสหน้าตัด ` +
        `และ ${(eff.ratioA * 100).toFixed(0)}% ของพื้นที่`,
    )
  }
  return {
    Se: props.Sx * eff.ratioS,
    Ae: props.A * eff.ratioA,
    Ie: props.Ix * eff.ratioI,
    ...eff,
    fullyEffective,
    notes,
  }
}

/** หน้าตัดประสิทธิผลของตัวซีขึ้นรูปเย็น (สมมาตรรอบแกนนอน ทิศแรงจึงไม่มีผล) */
export function effectiveLippedBending(
  dims: LippedChannelDims,
  props: SectionProps,
  Fy: number,
): EffectiveResult {
  const plates = lippedPlates(dims)
  const result = toResult(props, effectiveThinWall(plates, dims.t, Fy, true))
  const flangeFreeEdge = !plates.some(
    (p) => p.support === 'both' && Math.abs(p.y1 - p.y2) < 1e-9,
  )
  if (flangeFreeEdge) {
    result.notes.unshift(
      'ขอบพับสั้นเกินกว่าจะยึดปีกได้เต็มที่ — คิดปีกเป็นแผ่นขอบอิสระ (k = 0.43) ซึ่งลดกำลังลงมาก',
    )
  }
  return result
}

/**
 * หน้าตัดประสิทธิผลของแปหมวก
 * @param compressionTop true = แรงกดลง (สันรับแรงอัด) · false = แรงลมยก (ปีกรับแรงอัด)
 */
export function effectiveHatBending(
  dims: HatDims,
  props: SectionProps,
  Fy: number,
  compressionTop: boolean,
): EffectiveResult {
  return toResult(props, effectiveThinWall(hatPlates(dims), dims.t, Fy, compressionTop))
}

/**
 * กำลังอัดตาม AISI C4 — ใช้กับเหล็กขึ้นรูปเย็นแทนสูตร AISC E2
 * คืนหน่วยแรงอัดที่ยอมให้ (ksc) โดยใช้ตัวคูณความปลอดภัย Ω = 1.80
 */
export function coldFormedAllowableAxial(
  Fy: number,
  slenderness: number,
  areaRatio: number,
): { Fn: number; Fa: number; Fe: number } {
  if (slenderness <= 0) return { Fn: Fy, Fa: (Fy * areaRatio) / 1.8, Fe: Infinity }

  const Fe = (Math.PI ** 2 * E_STEEL) / slenderness ** 2
  const lambdaC = Math.sqrt(Fy / Fe)
  const Fn =
    lambdaC <= 1.5 ? 0.658 ** (lambdaC ** 2) * Fy : (0.877 / lambdaC ** 2) * Fy

  return { Fn, Fa: (Fn * areaRatio) / 1.8, Fe }
}
