/**
 * คำนวณคุณสมบัติหน้าตัดเหล็กจาก "รูปทรง" ไม่ใช่จากการลอกตารางผู้ผลิต
 *
 * เหตุผล: ตัวเลขในตารางผู้ผลิตลอกผิดได้เงียบ ๆ และตรวจทานไม่ไหว ขณะที่ "มิติ" คือชื่อเรียก
 * หน้าตัดอยู่แล้ว (เช่น H200×100×5.5×8) จึงผิดยาก และหน้าตัดประกอบ/กำหนดเองใช้โค้ดชุดเดียวกันได้
 *
 * หน่วยทั้งหมดเป็นเซนติเมตร (ซม., ตร.ซม., ซม.⁴)
 */

import { STEEL_UNIT_WEIGHT } from './materials'

/**
 * ค่าคงที่ของ "ชิ้นส่วนมุมโค้ง" — สี่เหลี่ยม r×r ลบด้วยเสี้ยววงกลมรัศมี r
 * ใช้ได้ทั้งมุมเว้า (fillet ระหว่างปีกกับเอว) และมุมนูน (มุมมนของเหล็กกล่อง)
 */
/** พื้นที่ = r² × (1 − π/4) */
const FILLET_AREA_COEF = 1 - Math.PI / 4
/** ระยะจากจุดมุมแหลมถึงเซนทรอยด์ = r × (5/6 − π/4)/(1 − π/4) ≈ 0.2234r */
const FILLET_CENTROID_COEF = (5 / 6 - Math.PI / 4) / FILLET_AREA_COEF
/** โมเมนต์ความเฉื่อยรอบเซนทรอยด์ตัวเอง = r⁴ × ค่านี้ ≈ 0.00755r⁴ */
const FILLET_INERTIA_COEF =
  1 - (5 * Math.PI) / 16 - FILLET_AREA_COEF * FILLET_CENTROID_COEF ** 2

export type SectionFamily =
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

export interface SectionProps {
  family: SectionFamily
  /** ความลึกหน้าตัดทั้งหมด (ซม.) */
  d: number
  /** ความกว้างหน้าตัดทั้งหมด (ซม.) */
  bf: number
  /** ความหนาเอว / ผนัง (ซม.) */
  tw: number
  /** ความหนาปีก (ซม.) */
  tf: number
  /** พื้นที่หน้าตัด (ตร.ซม.) */
  A: number
  /** น้ำหนัก (กก./ม.) */
  weight: number
  /** โมเมนต์ความเฉื่อยรอบแกนแข็ง x-x (ซม.⁴) */
  Ix: number
  /** โมเมนต์ความเฉื่อยรอบแกนอ่อน y-y (ซม.⁴) */
  Iy: number
  /** โมดูลัสหน้าตัดรอบแกนแข็ง (ซม.³) */
  Sx: number
  /** โมดูลัสหน้าตัดรอบแกนอ่อน (ซม.³) */
  Sy: number
  /** รัศมีไจเรชันรอบแกนแข็ง (ซม.) */
  rx: number
  /** รัศมีไจเรชันรอบแกนอ่อน (ซม.) */
  ry: number
  /** รัศมีไจเรชันต่ำสุด — สำหรับเหล็กฉากคือแกนหลัก z-z (ซม.) */
  rmin: number
  /** พื้นที่เอวรับแรงเฉือน (ตร.ซม.) */
  Aw: number
  /** ค่าคงที่การบิด J (ซม.⁴) */
  J: number
  /** รัศมีไจเรชันของปีกอัดรวม 1/3 เอวด้านอัด ใช้ในสูตร LTB (ซม.) */
  rT: number
  /** d/Af ใช้ในสูตร LTB ของ AISC F1-8 (1/ซม.) */
  dAf: number
  /** หน้าตัดปิด (กล่อง/ท่อ) — ไม่ต้องตรวจการโก่งเดาะด้านข้าง */
  closed: boolean
  /** หน้าตัดสมมาตรสองแกน */
  doublySymmetric: boolean
  /** อัตราส่วนความชะลูดขององค์ประกอบ ใช้ตรวจ compact / non-compact */
  slenderness: { flange: number; web: number }
  /** ระยะจากผิวด้านซ้ายถึงเซนทรอยด์ (ซม.) — สำคัญกับรางน้ำและเหล็กฉาก */
  xbar: number
  /** ระยะจากผิวล่างถึงเซนทรอยด์ (ซม.) — สำคัญกับเหล็กฉาก */
  ybar: number
  /** ความยาวขอบพับ (ซม.) — เฉพาะตัวซีขึ้นรูปเย็น ใช้วาดรูปตัด */
  lip?: number
  /** รัศมีมุม (ซม.) — ใช้วาดรูปตัด */
  cornerRadius?: number
  /** ความกว้างสันแปหมวก (ซม.) — ใช้วาดรูปตัด */
  crown?: number
  /** ระยะห่างเอวที่ฐานของแปหมวก (ซม.) — ใช้วาดรูปตัด */
  webBottom?: number
}

function gyration(I: number, A: number): number {
  return A > 0 && I > 0 ? Math.sqrt(I / A) : 0
}

function weightOf(A: number): number {
  return A * STEEL_UNIT_WEIGHT
}

// ───────────────────────────────────────────────────────────────────────────
// หน้าตัดรูปตัว I / H (รีดร้อน)
// ───────────────────────────────────────────────────────────────────────────

export interface IShapeDims {
  /** ความลึกทั้งหมด (ซม.) */
  d: number
  /** ความกว้างปีก (ซม.) */
  bf: number
  /** ความหนาเอว (ซม.) */
  tw: number
  /** ความหนาปีก (ซม.) */
  tf: number
  /** รัศมีมุมโค้งระหว่างปีกกับเอว (ซม.) — ใส่ 0 ได้ ผลจะปลอดภัยกว่าเล็กน้อย */
  r?: number
}

export function iShapeProps(dims: IShapeDims): SectionProps {
  const { d, bf, tw, tf } = dims
  const r = dims.r ?? 0
  /** ความสูงเอวที่ว่างระหว่างปีก */
  const h = d - 2 * tf

  const Afil = r ** 2 * FILLET_AREA_COEF
  const fx = tw / 2 + r * FILLET_CENTROID_COEF
  const fy = h / 2 - r * FILLET_CENTROID_COEF
  const Ifil = r ** 4 * FILLET_INERTIA_COEF

  const A = 2 * bf * tf + h * tw + 4 * Afil

  const Ix =
    2 * ((bf * tf ** 3) / 12 + bf * tf * ((d - tf) / 2) ** 2) +
    (tw * h ** 3) / 12 +
    4 * (Ifil + Afil * fy ** 2)

  const Iy =
    2 * ((tf * bf ** 3) / 12) + (h * tw ** 3) / 12 + 4 * (Ifil + Afil * fx ** 2)

  // rT = รัศมีไจเรชันของปีกอัดบวก 1/3 ของเอวด้านอัด (เอวด้านอัด = h/2 จึงใช้ h/6)
  const aT = bf * tf + (h / 6) * tw
  const iT = (tf * bf ** 3) / 12 + ((h / 6) * tw ** 3) / 12

  return {
    family: 'i-shape',
    d,
    bf,
    tw,
    tf,
    A,
    weight: weightOf(A),
    Ix,
    Iy,
    Sx: Ix / (d / 2),
    Sy: Iy / (bf / 2),
    rx: gyration(Ix, A),
    ry: gyration(Iy, A),
    rmin: gyration(Iy, A),
    Aw: d * tw,
    J: (2 * bf * tf ** 3 + h * tw ** 3) / 3,
    rT: gyration(iT, aT),
    dAf: d / (bf * tf),
    closed: false,
    doublySymmetric: true,
    slenderness: { flange: bf / (2 * tf), web: h / tw },
    xbar: bf / 2,
    ybar: d / 2,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// รางน้ำ (channel) รีดร้อน — เอวเต็มความลึก ปีกยื่นออกด้านเดียว
// ───────────────────────────────────────────────────────────────────────────

export function channelProps(dims: IShapeDims): SectionProps {
  const { d, bf, tw, tf } = dims
  const r = dims.r ?? 0

  /** ความยาวปีกที่ยื่นพ้นเอว */
  const bo = bf - tw
  const Afil = r ** 2 * FILLET_AREA_COEF
  const fx = tw + r * FILLET_CENTROID_COEF
  const fy = d / 2 - tf - r * FILLET_CENTROID_COEF
  const Ifil = r ** 4 * FILLET_INERTIA_COEF

  const aWeb = d * tw
  const aFlange = bo * tf
  const A = aWeb + 2 * aFlange + 2 * Afil

  const xbar = (aWeb * (tw / 2) + 2 * aFlange * ((tw + bf) / 2) + 2 * Afil * fx) / A

  const Ix =
    (tw * d ** 3) / 12 +
    2 * ((bo * tf ** 3) / 12 + aFlange * ((d - tf) / 2) ** 2) +
    2 * (Ifil + Afil * fy ** 2)

  const Iy =
    (d * tw ** 3) / 12 +
    aWeb * (tw / 2 - xbar) ** 2 +
    2 * ((tf * bo ** 3) / 12 + aFlange * ((tw + bf) / 2 - xbar) ** 2) +
    2 * (Ifil + Afil * (fx - xbar) ** 2)

  const h = d - 2 * tf
  const aT = bo * tf + (h / 6) * tw
  const iT = (tf * bo ** 3) / 12 + ((h / 6) * tw ** 3) / 12

  return {
    family: 'channel',
    d,
    bf,
    tw,
    tf,
    A,
    weight: weightOf(A),
    Ix,
    Iy,
    Sx: Ix / (d / 2),
    Sy: Iy / Math.max(xbar, bf - xbar),
    rx: gyration(Ix, A),
    ry: gyration(Iy, A),
    rmin: gyration(Iy, A),
    Aw: d * tw,
    J: (2 * bo * tf ** 3 + d * tw ** 3) / 3,
    rT: gyration(iT, aT),
    dAf: d / (bo * tf),
    closed: false,
    doublySymmetric: false,
    slenderness: { flange: bf / tf, web: h / tw },
    xbar,
    ybar: d / 2,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ตัวซีขึ้นรูปเย็น (lipped channel) — วิธี linear element ตาม AISI
// ───────────────────────────────────────────────────────────────────────────

export interface LippedChannelDims {
  /** ความลึกเอวทั้งหมด H (ซม.) */
  d: number
  /** ความกว้างปีก B (ซม.) */
  bf: number
  /** ความยาวขอบพับ C (ซม.) */
  lip: number
  /** ความหนา t (ซม.) */
  t: number
  /** รัศมีดัดด้านใน R (ซม.) — ค่าปกติของงานขึ้นรูปเย็นคือเท่ากับความหนา */
  bendRadius?: number
}

/**
 * องค์ประกอบเส้นกึ่งกลางของตัวซี ตามวิธี linear element ของ AISI
 * พิกัด: x วัดจากเส้นกึ่งกลางเอว (ปีกยื่นไป +x) · y วัดจากกึ่งกลางความลึก
 */
export function lippedMidline(dims: LippedChannelDims) {
  const { d, bf, lip, t } = dims
  const R = dims.bendRadius ?? t
  /** รัศมีดัดวัดถึงเส้นกึ่งกลางความหนา */
  const rc = R + t / 2

  /** ครึ่งความลึกของเส้นกึ่งกลางเอว */
  const Y = Math.max((d - t) / 2, 0)
  /** ตำแหน่ง x ของเส้นกึ่งกลางขอบพับ */
  const B = Math.max(bf - t, 0)

  return {
    t,
    R,
    rc,
    Y,
    B,
    /** ความยาวส่วนตรงของเอว */
    webFlat: Math.max(2 * (Y - rc), 0),
    /** ความยาวส่วนตรงของปีก */
    flangeFlat: Math.max(B - 2 * rc, 0),
    /** ความยาวส่วนตรงของขอบพับ */
    lipFlat: Math.max(lip - t / 2 - rc, 0),
    /** ความยาวเส้นโค้งของมุมดัดหนึ่งมุม (หนึ่งในสี่วงกลม) */
    cornerArc: (Math.PI / 2) * rc,
    /** ความกว้างราบตาม AISI (ใช้หาหน้าตัดประสิทธิผล) */
    flatWidth: {
      web: Math.max(d - 2 * (R + t), 0),
      flange: Math.max(bf - 2 * (R + t), 0),
      lip: Math.max(lip - (R + t), 0),
    },
  }
}

/** ค่าคงที่ของเส้นโค้งหนึ่งในสี่วงกลม: เซนทรอยด์ = 2r/π จากจุดศูนย์กลาง */
const ARC_CENTROID_COEF = 2 / Math.PI
/** โมเมนต์ความเฉื่อยของเส้นโค้งหนึ่งในสี่รอบเซนทรอยด์ตัวเอง = r³ × ค่านี้ */
const ARC_INERTIA_COEF = Math.PI / 4 - (Math.PI / 2) * ARC_CENTROID_COEF ** 2

/** ชิ้นส่วนเส้นบาง: พื้นที่ เซนทรอยด์ และโมเมนต์ความเฉื่อยรอบแกนตัวเอง */
interface LineElement {
  area: number
  x: number
  y: number
  ixOwn: number
  iyOwn: number
}

export function lippedChannelProps(dims: LippedChannelDims): SectionProps {
  const { d, bf, lip, t } = dims
  const m = lippedMidline(dims)
  const { rc, Y, B, webFlat, flangeFlat, lipFlat, cornerArc } = m

  const arcArea = cornerArc * t
  const arcOffset = ARC_CENTROID_COEF * rc
  const arcOwn = ARC_INERTIA_COEF * rc ** 3 * t

  const elements: LineElement[] = [
    // เอว — เส้นตรงแนวตั้งที่ x = 0
    { area: webFlat * t, x: 0, y: 0, ixOwn: (t * webFlat ** 3) / 12, iyOwn: 0 },
  ]

  for (const s of [1, -1]) {
    // มุมดัดเอว→ปีก จุดศูนย์กลางที่ (rc, s(Y − rc))
    elements.push({
      area: arcArea,
      x: rc - arcOffset,
      y: s * (Y - rc + arcOffset),
      ixOwn: arcOwn,
      iyOwn: arcOwn,
    })
    // ปีก — เส้นตรงแนวนอนที่ y = ±Y
    elements.push({
      area: flangeFlat * t,
      x: B / 2,
      y: s * Y,
      ixOwn: 0,
      iyOwn: (t * flangeFlat ** 3) / 12,
    })
    // มุมดัดปีก→ขอบพับ จุดศูนย์กลางที่ (B − rc, s(Y − rc))
    elements.push({
      area: arcArea,
      x: B - rc + arcOffset,
      y: s * (Y - rc + arcOffset),
      ixOwn: arcOwn,
      iyOwn: arcOwn,
    })
    // ขอบพับ — เส้นตรงแนวตั้งที่ x = B
    elements.push({
      area: lipFlat * t,
      x: B,
      y: s * (Y - rc - lipFlat / 2),
      ixOwn: (t * lipFlat ** 3) / 12,
      iyOwn: 0,
    })
  }

  const A = elements.reduce((sum, e) => sum + e.area, 0)
  /** เซนทรอยด์วัดจากเส้นกึ่งกลางเอว (แกน x-x สมมาตรจึง ȳ = 0) */
  const xbarMid = A > 0 ? elements.reduce((sum, e) => sum + e.area * e.x, 0) / A : 0

  const Ix = elements.reduce((sum, e) => sum + e.ixOwn + e.area * e.y ** 2, 0)
  const Iy = elements.reduce(
    (sum, e) => sum + e.iyOwn + e.area * (e.x - xbarMid) ** 2,
    0,
  )

  /** เซนทรอยด์วัดจากผิวนอกของเอว */
  const xbar = xbarMid + t / 2
  const L = A / t

  const aT = flangeFlat * t + (webFlat / 6) * t
  const iT = (t * flangeFlat ** 3) / 12

  return {
    family: 'lipped-channel',
    lip,
    cornerRadius: m.R,
    d,
    bf,
    tw: t,
    tf: t,
    A,
    weight: weightOf(A),
    Ix,
    Iy,
    Sx: d > 0 ? Ix / (d / 2) : 0,
    Sy: Iy / Math.max(xbar, bf - xbar),
    rx: gyration(Ix, A),
    ry: gyration(Iy, A),
    rmin: gyration(Iy, A),
    Aw: d * t,
    J: (L * t ** 3) / 3,
    rT: gyration(iT, aT),
    dAf: d / (bf * t),
    closed: false,
    doublySymmetric: false,
    slenderness: {
      flange: m.flatWidth.flange / t,
      web: m.flatWidth.web / t,
    },
    xbar,
    ybar: d / 2,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// เหล็กฉาก (angle) — ต้องหาแกนหลักเพื่อให้ได้ rmin ที่ใช้ตรวจการโก่งเดาะ
// ───────────────────────────────────────────────────────────────────────────

export interface AngleDims {
  /** ความยาวขายาว (ซม.) — วางตั้ง */
  legLong: number
  /** ความยาวขาสั้น (ซม.) — วางนอน */
  legShort: number
  /** ความหนา (ซม.) */
  t: number
}

export function angleProps(dims: AngleDims): SectionProps {
  const { legLong: aL, legShort: bL, t } = dims

  // ขาตั้ง: [0,t] × [0,aL] · ขานอน: [t,bL] × [0,t]
  const bo = Math.max(bL - t, 0)
  const a1 = t * aL
  const a2 = t * bo
  const A = a1 + a2

  const x1 = t / 2
  const y1 = aL / 2
  const x2 = (t + bL) / 2
  const y2 = t / 2

  const xbar = (a1 * x1 + a2 * x2) / A
  const ybar = (a1 * y1 + a2 * y2) / A

  const Ix =
    (t * aL ** 3) / 12 +
    a1 * (y1 - ybar) ** 2 +
    (bo * t ** 3) / 12 +
    a2 * (y2 - ybar) ** 2
  const Iy =
    (aL * t ** 3) / 12 +
    a1 * (x1 - xbar) ** 2 +
    (t * bo ** 3) / 12 +
    a2 * (x2 - xbar) ** 2

  // ผลคูณความเฉื่อย — สี่เหลี่ยมแต่ละชิ้นมี Ixy รอบแกนตัวเองเป็นศูนย์
  const Ixy = a1 * (x1 - xbar) * (y1 - ybar) + a2 * (x2 - xbar) * (y2 - ybar)

  const avg = (Ix + Iy) / 2
  const dev = Math.sqrt(((Ix - Iy) / 2) ** 2 + Ixy ** 2)
  const Imin = avg - dev

  return {
    family: 'angle',
    d: aL,
    bf: bL,
    tw: t,
    tf: t,
    A,
    weight: weightOf(A),
    Ix,
    Iy,
    Sx: Ix / Math.max(ybar, aL - ybar),
    Sy: Iy / Math.max(xbar, bL - xbar),
    rx: gyration(Ix, A),
    ry: gyration(Iy, A),
    rmin: gyration(Imin, A),
    Aw: aL * t,
    J: (aL * t ** 3 + bo * t ** 3) / 3,
    rT: gyration(Iy, A),
    dAf: aL / (bL * t),
    closed: false,
    doublySymmetric: false,
    slenderness: { flange: bL / t, web: aL / t },
    xbar,
    ybar,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// เหล็กกล่อง (square / rectangular hollow section)
// ───────────────────────────────────────────────────────────────────────────

export interface BoxDims {
  /** ความลึกด้านนอก (ซม.) */
  d: number
  /** ความกว้างด้านนอก (ซม.) */
  b: number
  /** ความหนาผนัง (ซม.) */
  t: number
  /** รัศมีมุมนอก (ซม.) — ค่าปกติของเหล็กกล่องขึ้นรูปเย็นคือ 2t */
  r?: number
}

/** คุณสมบัติของสี่เหลี่ยมมุมมน ใช้ทั้งขอบนอกและขอบใน */
function roundedRect(b: number, d: number, r: number) {
  const rr = Math.max(Math.min(r, b / 2, d / 2), 0)
  const Ac = rr ** 2 * FILLET_AREA_COEF
  const cx = b / 2 - rr * FILLET_CENTROID_COEF
  const cy = d / 2 - rr * FILLET_CENTROID_COEF
  const Ic = rr ** 4 * FILLET_INERTIA_COEF
  return {
    A: b * d - 4 * Ac,
    Ix: (b * d ** 3) / 12 - 4 * (Ic + Ac * cy ** 2),
    Iy: (d * b ** 3) / 12 - 4 * (Ic + Ac * cx ** 2),
  }
}

export function boxProps(dims: BoxDims): SectionProps {
  const { d, b, t } = dims
  const ro = dims.r ?? 2 * t
  const ri = Math.max(ro - t, 0)

  const outer = roundedRect(b, d, ro)
  const inner = roundedRect(Math.max(b - 2 * t, 0), Math.max(d - 2 * t, 0), ri)

  const A = outer.A - inner.A
  const Ix = outer.Ix - inner.Ix
  const Iy = outer.Iy - inner.Iy

  // J ของหน้าตัดปิดผนังบาง ตามสูตร Bredt
  const bm = Math.max(b - t, 0)
  const dm = Math.max(d - t, 0)
  const J = bm + dm > 0 ? (2 * t * bm ** 2 * dm ** 2) / (bm + dm) : 0

  /** ความกว้างราบของผนัง (ไม่รวมมุมโค้ง) ใช้ตรวจความชะลูด */
  const flatB = Math.max(b - 2 * ro, 0)
  const flatD = Math.max(d - 2 * ro, 0)

  return {
    family: 'box',
    cornerRadius: ro,
    d,
    bf: b,
    tw: t,
    tf: t,
    A,
    weight: weightOf(A),
    Ix,
    Iy,
    Sx: Ix / (d / 2),
    Sy: Iy / (b / 2),
    rx: gyration(Ix, A),
    ry: gyration(Iy, A),
    rmin: gyration(Math.min(Ix, Iy), A),
    /** แรงเฉือนรับโดยผนังสองข้างที่ขนานแนวแรง */
    Aw: 2 * d * t,
    J,
    rT: gyration(Iy, A),
    dAf: d / (b * t),
    closed: true,
    doublySymmetric: true,
    slenderness: { flange: flatB / t, web: flatD / t },
    xbar: b / 2,
    ybar: d / 2,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// ท่อกลม (pipe)
// ───────────────────────────────────────────────────────────────────────────

export interface PipeDims {
  /** เส้นผ่านศูนย์กลางนอก (ซม.) */
  D: number
  /** ความหนาผนัง (ซม.) */
  t: number
}

export function pipeProps(dims: PipeDims): SectionProps {
  const { D, t } = dims
  const di = Math.max(D - 2 * t, 0)

  const A = (Math.PI / 4) * (D ** 2 - di ** 2)
  const I = (Math.PI / 64) * (D ** 4 - di ** 4)
  const S = I / (D / 2)
  const r = gyration(I, A)

  return {
    family: 'pipe',
    d: D,
    bf: D,
    tw: t,
    tf: t,
    A,
    weight: weightOf(A),
    Ix: I,
    Iy: I,
    Sx: S,
    Sy: S,
    rx: r,
    ry: r,
    rmin: r,
    /** หน้าตัดวงแหวน: พื้นที่รับเฉือนประสิทธิผล ≈ A/2 */
    Aw: A / 2,
    J: 2 * I,
    rT: r,
    dAf: 1 / t,
    closed: true,
    doublySymmetric: true,
    slenderness: { flange: D / t, web: D / t },
    xbar: D / 2,
    ybar: D / 2,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// แผ่นเหล็ก (ใช้ประกอบหน้าตัด)
// ───────────────────────────────────────────────────────────────────────────

export function plateProps(b: number, t: number): SectionProps {
  const A = b * t
  const Ix = (b * t ** 3) / 12
  const Iy = (t * b ** 3) / 12

  return {
    family: 'plate',
    d: t,
    bf: b,
    tw: t,
    tf: t,
    A,
    weight: weightOf(A),
    Ix,
    Iy,
    Sx: Ix / (t / 2),
    Sy: Iy / (b / 2),
    rx: gyration(Ix, A),
    ry: gyration(Iy, A),
    rmin: gyration(Ix, A),
    Aw: A,
    J: (b * t ** 3) / 3,
    rT: gyration(Iy, A),
    dAf: 1 / b,
    closed: false,
    doublySymmetric: true,
    slenderness: { flange: b / t, web: b / t },
    xbar: b / 2,
    ybar: t / 2,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// หน้าตัดผนังบางทั่วไป — เส้นกึ่งกลางหักมุมที่มีมุมดัดโค้ง
// ใช้กับแปหมวก และใช้หาหน้าตัดประสิทธิผลของเหล็กขึ้นรูปเย็นทุกแบบ
// ───────────────────────────────────────────────────────────────────────────

/**
 * การยึดขอบของแผ่นเรียบ ใช้หาความกว้างประสิทธิผลตาม AISI
 * both = ยึดทั้งสองขอบ (k = 4) · start/end = ยึดเฉพาะขอบนั้น อีกขอบอิสระ (k = 0.43)
 * corner = มุมดัดโค้ง ใช้ได้เต็มเสมอ
 */
export type PlateSupport = 'both' | 'start' | 'end' | 'corner'

export interface Plate {
  x1: number
  y1: number
  x2: number
  y2: number
  support: PlateSupport
}

/** จำนวนช่วงเส้นตรงที่ใช้ประมาณมุมดัดโค้งหนึ่งมุม */
const ARC_CHORDS = 6

/**
 * แปลงเส้นกึ่งกลางหักมุมเป็นแผ่นเรียบ + มุมดัดโค้ง
 * @param points จุดหักมุมของเส้นกึ่งกลางความหนา (ซม.)
 * @param supports การยึดขอบของช่วงตรงแต่ละช่วง (จำนวน = จุด − 1)
 * @param rc รัศมีดัดวัดถึงเส้นกึ่งกลางความหนา (ซม.)
 */
export function platesFromPath(
  points: Array<[number, number]>,
  supports: PlateSupport[],
  rc: number,
): Plate[] {
  const n = points.length
  const dirs = points.slice(0, -1).map(([x, y], i) => {
    const [x2, y2] = points[i + 1]
    const len = Math.hypot(x2 - x, y2 - y)
    return { ux: (x2 - x) / len, uy: (y2 - y) / len, len }
  })

  // ระยะที่ต้องตัดปลายช่วงตรงออกเพื่อใส่มุมโค้ง ณ จุดหักมุมภายใน
  const trims = new Array<number>(n).fill(0)
  const radii = new Array<number>(n).fill(0)
  const turns = new Array<number>(n).fill(0)
  for (let j = 1; j < n - 1; j++) {
    const a = dirs[j - 1]
    const b = dirs[j]
    const phi = Math.acos(Math.min(1, Math.max(-1, a.ux * b.ux + a.uy * b.uy)))
    if (phi < 1e-6 || rc <= 0) continue
    const trim = Math.min(rc * Math.tan(phi / 2), 0.45 * a.len, 0.45 * b.len)
    trims[j] = trim
    radii[j] = trim / Math.tan(phi / 2)
    turns[j] = phi
  }

  const plates: Plate[] = []
  for (let i = 0; i < n - 1; i++) {
    const [x, y] = points[i]
    const [x2, y2] = points[i + 1]
    const { ux, uy } = dirs[i]
    plates.push({
      x1: x + ux * trims[i],
      y1: y + uy * trims[i],
      x2: x2 - ux * trims[i + 1],
      y2: y2 - uy * trims[i + 1],
      support: supports[i],
    })

    const j = i + 1
    if (j >= n - 1 || radii[j] <= 0) continue
    const a = dirs[j - 1]
    const b = dirs[j]
    const [px, py] = points[j]
    /** หมุนซ้าย (+1) หรือขวา (−1) — จุดศูนย์กลางมุมโค้งอยู่ด้านในของการหมุน */
    const side = a.ux * b.uy - a.uy * b.ux >= 0 ? 1 : -1
    const r = radii[j]
    const sx = px - a.ux * trims[j]
    const sy = py - a.uy * trims[j]
    const cx = sx - side * a.uy * r
    const cy = sy + side * a.ux * r
    const start = Math.atan2(sy - cy, sx - cx)
    const sweep = side * turns[j]
    for (let k = 0; k < ARC_CHORDS; k++) {
      const t0 = start + (sweep * k) / ARC_CHORDS
      const t1 = start + (sweep * (k + 1)) / ARC_CHORDS
      plates.push({
        x1: cx + r * Math.cos(t0),
        y1: cy + r * Math.sin(t0),
        x2: cx + r * Math.cos(t1),
        y2: cy + r * Math.sin(t1),
        support: 'corner',
      })
    }
  }
  return plates
}

export function plateLength(p: Plate): number {
  return Math.hypot(p.x2 - p.x1, p.y2 - p.y1)
}

/** คุณสมบัติหน้าตัดของชุดแผ่นบางความหนา t */
export function propsFromPlates(plates: Plate[], t: number) {
  let L = 0
  let momentX = 0
  let momentY = 0
  for (const p of plates) {
    const len = plateLength(p)
    L += len
    momentX += len * ((p.x1 + p.x2) / 2)
    momentY += len * ((p.y1 + p.y2) / 2)
  }
  const xbar = L > 0 ? momentX / L : 0
  const ybar = L > 0 ? momentY / L : 0

  let Ix = 0
  let Iy = 0
  for (const p of plates) {
    const len = plateLength(p)
    // โมเมนต์ความเฉื่อยของเส้นตรงบาง รอบแกนผ่านจุดกึ่งกลางตัวเอง = L·(ช่วงยื่นตามแกน)²/12
    Ix += (len * (p.y2 - p.y1) ** 2) / 12 + len * ((p.y1 + p.y2) / 2 - ybar) ** 2
    Iy += (len * (p.x2 - p.x1) ** 2) / 12 + len * ((p.x1 + p.x2) / 2 - xbar) ** 2
  }

  const ys = plates.flatMap((p) => [p.y1, p.y2])
  return {
    A: L * t,
    length: L,
    xbar,
    ybar,
    Ix: Ix * t,
    Iy: Iy * t,
    yMin: Math.min(...ys) - t / 2,
    yMax: Math.max(...ys) + t / 2,
  }
}

/** ตัวซีขึ้นรูปเย็นในรูปชุดแผ่นบาง — ใช้หาหน้าตัดประสิทธิผล */
export function lippedPlates(dims: LippedChannelDims): Plate[] {
  const { d, bf, lip, t } = dims
  const R = dims.bendRadius ?? t
  const Y = (d - t) / 2
  const B = bf - t
  const lipEnd = Y + t / 2 - lip
  const hasLip = lip > t
  // ขอบพับยาวพอจะยึดปีกได้ (ประมาณตาม AISI B4 แบบง่าย)
  const lipAdequate = hasLip && (lip - t >= 0.3 * (bf - 2 * (R + t)) || lip / bf >= 0.2)

  const points: Array<[number, number]> = []
  const supports: PlateSupport[] = []
  if (hasLip) {
    points.push([B, lipEnd])
    supports.push('end')
  }
  points.push([B, Y], [0, Y], [0, -Y], [B, -Y])
  supports.push(lipAdequate ? 'both' : 'end', 'both', lipAdequate ? 'both' : 'start')
  if (hasLip) {
    points.push([B, -lipEnd])
    supports.push('start')
  }
  return platesFromPath(points, supports, R + t / 2)
}

// ───────────────────────────────────────────────────────────────────────────
// แปหมวก (top-hat batten) — แปเหล็กเคลือบสำหรับรับกระเบื้องหลังคา
// ───────────────────────────────────────────────────────────────────────────

export interface HatDims {
  /** ความสูงทั้งหมด (ซม.) */
  d: number
  /** ความกว้างฐานรวมปีกทั้งสองข้าง (ซม.) */
  bf: number
  /** ความกว้างสันด้านบน วัดผิวนอก (ซม.) */
  crown: number
  /** ระยะห่างผิวนอกของเอวทั้งสองที่ระดับฐาน (ซม.) — เท่ากับความกว้างสันถ้าเอวตั้งดิ่ง */
  webBottom: number
  /** ขอบพับยกขึ้นที่ปลายปีก (ซม.) — ใส่ 0 ถ้าไม่มี */
  lip: number
  /** ความหนาเหล็กไม่รวมสารเคลือบ (ซม.) */
  t: number
  /** รัศมีดัดด้านใน (ซม.) — ปกติเท่ากับความหนา */
  bendRadius?: number
}

/**
 * แปหมวกในรูปชุดแผ่นบาง (y วัดจากใต้ปีก)
 * แรงกดลงทำให้ "สัน" รับแรงอัด — สันยึดด้วยเอวทั้งสองข้างจึงเป็นแผ่นยึดสองขอบ
 */
export function hatPlates(dims: HatDims): Plate[] {
  const { d, bf, crown, webBottom, lip, t } = dims
  const R = dims.bendRadius ?? t
  const yTop = d - t / 2
  const yBase = t / 2
  const xCrown = Math.max(crown / 2 - t / 2, t)
  const xWeb = Math.max(webBottom / 2 - t / 2, t)
  const xEdge = Math.max(bf / 2 - t / 2, xWeb + 2 * t)
  const hasLip = lip > t
  const lipAdequate = hasLip && lip - t / 2 >= 0.3 * (xEdge - xWeb)

  const points: Array<[number, number]> = []
  const supports: PlateSupport[] = []
  if (hasLip) {
    points.push([-xEdge, lip - t / 2])
    supports.push('end')
  }
  points.push(
    [-xEdge, yBase],
    [-xWeb, yBase],
    [-xCrown, yTop],
    [xCrown, yTop],
    [xWeb, yBase],
    [xEdge, yBase],
  )
  supports.push(lipAdequate ? 'both' : 'end', 'both', 'both', 'both', lipAdequate ? 'both' : 'start')
  if (hasLip) {
    points.push([xEdge, lip - t / 2])
    supports.push('start')
  }
  return platesFromPath(points, supports, R + t / 2)
}

export function hatProps(dims: HatDims): SectionProps {
  const { d, bf, crown, webBottom, lip, t } = dims
  const plates = hatPlates(dims)
  const g = propsFromPlates(plates, t)

  const flats = plates.filter((p) => p.support === 'both')
  const crownFlat = Math.max(
    0,
    ...flats.filter((p) => Math.abs(p.y1 - p.y2) < 1e-9 && p.y1 > d / 2).map(plateLength),
  )
  const webFlat = Math.max(
    0,
    ...flats.filter((p) => Math.abs(p.y1 - p.y2) > 1e-9).map(plateLength),
  )

  const aT = crown * t + (d / 6) * 2 * t
  const iT = (t * crown ** 3) / 12

  return {
    family: 'hat',
    d,
    bf,
    tw: t,
    tf: t,
    A: g.A,
    weight: weightOf(g.A),
    Ix: g.Ix,
    Iy: g.Iy,
    // ผิวบนกับผิวล่างอยู่ห่างแกนสะเทินไม่เท่ากัน จึงใช้ระยะที่ไกลกว่า (ค่าปลอดภัย)
    Sx: g.Ix / Math.max(g.yMax - g.ybar, g.ybar - g.yMin),
    Sy: g.Iy / (bf / 2),
    rx: gyration(g.Ix, g.A),
    ry: gyration(g.Iy, g.A),
    rmin: gyration(Math.min(g.Ix, g.Iy), g.A),
    // เอวสองข้างรับแรงเฉือน
    Aw: 2 * d * t,
    J: (g.length * t ** 3) / 3,
    rT: gyration(iT, aT),
    dAf: d / (crown * t),
    closed: false,
    doublySymmetric: false,
    slenderness: { flange: crownFlat / t, web: webFlat / t },
    xbar: bf / 2,
    ybar: g.ybar,
    lip,
    cornerRadius: dims.bendRadius ?? t,
    crown,
    webBottom,
  }
}
