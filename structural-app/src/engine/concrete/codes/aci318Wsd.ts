/**
 * ค่าคงที่ตาม ACI 318 Alternate Design Method (WSD)
 * อ้างอิง ACI 318-83 Appendix B / ACI 318-89 Appendix A (หน่วยแรงยอมให้ = 55% ของค่า SDM สำหรับคอนกรีต)
 *
 * หน่วยทั้งหมด kg, cm, ksc
 * การแปลงสัมประสิทธิ์ของ √f'c จาก psi เป็น ksc: คูณ 1/√14.22 ≈ 0.265
 *
 * ค่าที่เกี่ยวกับมาตรฐานรวมไว้ที่ไฟล์นี้ไฟล์เดียว เพื่อให้ตรวจสอบ/เพิ่มมาตรฐานอื่น (เช่น วสท.) ได้ง่าย
 */
export const ACI318_WSD = {
  label: 'ACI 318 Alternate Design Method (WSD)',

  /** โมดูลัสยืดหยุ่นเหล็ก (ksc) */
  Es: 2.04e6,
  /** Ec = 15,100·√f'c (ksc) */
  EcCoef: 15100,

  /** หน่วยแรงอัดดัดยอมให้ของคอนกรีต fc = 0.45f'c (A.3.1) */
  fcRatio: 0.45,
  /** หน่วยแรงดึงยอมให้ของเหล็ก fs = 0.5fy ≤ 1,700 ksc (A.3.2) */
  fsRatio: 0.5,
  fsMax: 1700,
  /** เหล็กรับแรงอัดใช้ modular ratio 2n (A.5.4) */
  compressionSteelFactor: 2,

  /** As,min = 14·b·d / fy (200 psi) */
  AsMinCoef: 14,

  /** vc = 0.29√f'c (1.1√f'c psi) */
  vcCoef: 0.29,
  /** v − vc ≤ 1.16√f'c (4.4√f'c psi) ไม่ผ่านต้องขยายหน้าตัด */
  vExcessMaxCoef: 1.16,
  /** v − vc > 0.58√f'c (2.2√f'c psi) → s max ลดเป็น d/4 */
  vExcessHalfSpacingCoef: 0.58,

  /** ละเลยแรงบิดได้เมื่อ vt ≤ 0.22√f'c (0.55 × 1.5√f'c psi) */
  vtNeglectCoef: 0.22,
  /** vtc = 0.35√f'c / √(1 + (1.2v/vt)²)  (0.55 × 2.4√f'c psi) */
  vtcCoef: 0.35,
  /** vt − vtc ≤ 4·vtc (Ts ≤ 4Tc) */
  torsionSteelMaxFactor: 4,
  /** αt = 0.66 + 0.33·y1/x1 ≤ 1.5 */
  alphaTMax: 1.5,
  /** s ≤ (x1 + y1)/4 ≤ 30 ซม. เมื่อมีแรงบิด */
  torsionSpacingMax: 30,

  /** Av + 2At ≥ 3.5·b·s / fy (50 psi) */
  AvMinCoef: 3.5,
  /** Al,min = [28·x·s/fy · vt/(vt+v) − 2At]·(x1+y1)/s (400 psi) */
  AlMinCoef: 28,

  /** ระยะช่องว่างระหว่างเหล็กยืน ≥ max(db, 2.5 ซม.) และระหว่างชั้น ≥ 2.5 ซม. */
  minClearSpacing: 2.5,
  /** ปัดระยะเหล็กปลอกลงทีละ 2.5 ซม. */
  spacingStep: 2.5,

  /** ความลึกขั้นต่ำของคาน (ACI Table 9.5(a)) h ≥ L/ค่านี้ ที่ fy = 4,200 ksc */
  minDepthDivisor: { simple: 16, oneEnd: 18.5, bothEnds: 21, cantilever: 8 },
  /** ตัวคูณปรับ fy สำหรับความลึกขั้นต่ำ: 0.4 + fy/7,000 */
  minDepthFyDivisor: 7000,

  /** สัดส่วนเหล็กล่างที่ต้องต่อเนื่องเข้าที่รองรับ (ACI 12.11.1) */
  continuityRatio: { simple: 1 / 3, oneEnd: 1 / 4, bothEnds: 1 / 4, cantilever: 1 / 4 },
} as const;

/**
 * เสา — ACI 318-89 Appendix A.6 (Alternate Design Method)
 * กำลังรับแรงอัดร่วมกับโมเมนต์ = 40% ของกำลังตาม Chapter 10 (SDM, รวม φ)
 * ผลความชะลูดตาม 10.10–10.11 โดยใช้ 2.5 เท่าของแรงใช้งานแทน Pu
 */
export const ACI318_WSD_COLUMN = {
  label: 'ACI 318 Alternate Design Method — 40% ของกำลัง SDM',
  capacityFactor: 0.4,
  slendernessLoadFactor: 2.5,
  phiTied: 0.7,
  phiSpiral: 0.75,
  /** Pn,max = 0.80Po (ปลอกเดี่ยว), 0.85Po (ปลอกเกลียว) */
  pmaxTied: 0.8,
  pmaxSpiral: 0.85,
  epsCu: 0.003,

  rhoMin: 0.01,
  rhoMax: 0.08,
  minBarsRect: 4,
  minBarsSpiral: 6,
  /** ระยะช่องว่างเหล็กยืน ≥ max(1.5db, 4 ซม.) (7.6.3) */
  clearSpacingFactor: 1.5,
  clearSpacingMin: 4,

  /** ปลอกเดี่ยว: s ≤ min(16db, 48dt, ด้านแคบ), Ø ≥ 9 มม. (7.10.5) */
  tieSpacingDb: 16,
  tieSpacingDt: 48,
  tieMinDia: 0.9,
  /** เหล็กยืนที่ไม่มีเหล็กถ่างยึด ต้องห่างจากเหล็กที่ยึดแล้วไม่เกิน 15 ซม. (ระยะช่องว่าง) */
  crossTieClearMax: 15,

  /** ปลอกเกลียว: ρs ≥ 0.45(Ag/Ac − 1)f′c/fy, ระยะช่องว่าง 2.5–7.5 ซม., Ø ≥ 9 มม. (10.9.3, 7.10.4) */
  spiralRhoCoef: 0.45,
  spiralClearMin: 2.5,
  spiralClearMax: 7.5,
  spiralMinDia: 0.9,
  spiralPitchStep: 0.5,

  /** รัศมีไจเรชัน r = 0.3h (สี่เหลี่ยม), 0.25D (กลม) */
  radiusGyrationRect: 0.3,
  radiusGyrationCircle: 0.25,
  /** เสาสั้น: kLu/r ≤ 34 − 12·M1/M2; > 100 ต้องวิเคราะห์อันดับสอง */
  slenderBracedA: 34,
  slenderBracedB: 12,
  slenderMax: 100,
  /**
   * ค่ากำหนดอัตโนมัติ (ผู้ใช้กรอกเฉพาะ Lu) — เลือกค่าปลอดภัยสำหรับอาคารทั่วไปที่มีพื้น/คานยึด:
   * k = 1.0, M1/M2 = 1.0 (ดัดโค้งทางเดียว → Cm = 1, ขีดเสาสั้น 22), βd = 0.6
   */
  autoK: 1,
  autoM1M2: 1,
  autoBetaD: 0.6,
  /** EI = 0.4EcIg / (1 + βd) */
  EIcoef: 0.4,
  CmMin: 0.4,
  /** M2,min = P(1.5 + 0.03h) ซม. */
  minEccBase: 1.5,
  minEccCoef: 0.03,

  /** Bresler ใช้เมื่อ Pn ≥ 0.1f′cAg, ต่ำกว่านั้นใช้ Mx/Mnx + My/Mny ≤ 1 */
  breslerAxialRatio: 0.1,
} as const;

/**
 * ฐานรากแผ่ — ACI 318-89 Chapter 15 + Appendix A (Alternate Design Method)
 * แรงดันดินจากแรงใช้งาน ดินไม่รับแรงดึง (ฐานรากแข็ง แรงดันดินเป็นระนาบ)
 */
export const ACI318_WSD_FOOTING = {
  label: 'ACI 318 Alternate Design Method (WSD) — ฐานรากแผ่',
  /** หน่วยน้ำหนักคอนกรีตเสริมเหล็ก (t/m³) */
  concreteUnitWeight: 2.4,
  /** ระยะหุ้มคอนกรีตหล่อติดดิน (7.7.1) */
  cover: 7.5,

  /** เฉือนแบบคาน vc = 0.29√f'c (A.7.4.1, 1.1√f'c psi) */
  oneWayVcCoef: 0.29,
  /** เฉือนทะลุ vc = √f'c·min(0.53, 0.265(1 + 2/βc), 0.265(αs·d/b0 + 2)) (A.7.4.2 + 11.12.2) */
  punchingVcMax: 0.53,
  punchingVcBase: 0.265,
  /** αs = 40 เสาภายใน, 30 เสาขอบ, 20 เสามุม — ตามจำนวนด้านของหน้าตัดวิกฤต */
  alphaS4: 40,
  alphaS3: 30,
  alphaS2: 20,

  /** As,min ของฐานรากหนาสม่ำเสมอ = เหล็กกันร้าว (10.5.3, 7.12): 0.0020 เมื่อ fy < 4,000; 0.0018·4,000/fy ≥ 0.0014 */
  rhoTempLowFy: 0.002,
  rhoTemp: 0.0018,
  rhoTempRefFy: 4000,
  rhoTempMin: 0.0014,
  /** ระยะเรียงเหล็กหลัก ≤ 3t และ ≤ 45 ซม. (7.6.5) */
  maxSpacingFactor: 3,
  maxSpacing: 45,
  /** ความลึกเหนือเหล็กล่าง ≥ 15 ซม. (15.7) */
  minDepthAboveSteel: 15,
  /** ผิวบนรับแรงดึง (คอนกรีตล้วน) ft ≤ 0.42√f'c (1.6√f'c psi) */
  plainTensionCoef: 0.42,

  /** ระยะฝังเหล็กตรง ld = 0.06Ab·fy/√f'c ≥ 0.0057db·fy ≥ 30 ซม. (12.2.2) */
  ldCoef: 0.06,
  ldDbCoef: 0.0057,
  ldMin: 30,
  /** ขอ 90° ldh = 318db/√f'c × fy/4,200 ≥ 8db ≥ 15 ซม. (12.5) */
  ldhCoef: 318,
  ldhFyRef: 4200,
  ldhDbMin: 8,
  ldhMin: 15,
  /** ความยาวส่วนงอขอ 90° = 12db (7.1.2) */
  hookExtension: 12,

  /** แรงแบกทานใต้เสา 0.3f'c·√(A2/A1), √(A2/A1) ≤ 2 (A.3.1) */
  bearingRatio: 0.3,
  bearingSqrtMax: 2,

  /** เตือนเมื่อพื้นที่ดินรับแรงดันน้อยกว่าสัดส่วนนี้ */
  minContactRatio: 0.5,

  /** ออกแบบอัตโนมัติ: ปัดขนาดทีละ 5 ซม., ความหนาเริ่มต้น 30 ซม. สูงสุด 300 ซม., ด้านยาวสูงสุด 30 ม., ด้านยาว/ด้านสั้น ≤ 2 */
  sizeStep: 5,
  autoMinThickness: 30,
  autoMaxThickness: 300,
  autoMaxSpan: 3000,
  autoMaxAspect: 2,
} as const;

/**
 * ฐานรากเสาเข็ม — ACI 318-89 Chapter 15 + Appendix A (Alternate Design Method)
 * ฐานรากแข็ง แรงในเสาเข็มแปรผันเชิงเส้นตามระยะจากศูนย์ถ่วงกลุ่มเข็ม (ใช้ตำแหน่งเข็มจริงหลังตอก)
 */
export const ACI318_WSD_PILECAP = {
  label: 'ACI 318 Alternate Design Method (WSD) — ฐานรากเสาเข็ม',
  concreteUnitWeight: 2.4,

  /** ความลึกเหนือเหล็กล่างของฐานรากบนเสาเข็ม ≥ 30 ซม. (15.7) */
  minDepthAboveSteel: 30,
  /** แรงจากเสาเข็มที่ศูนย์อยู่ห่างหน้าตัดวิกฤต ≥ D/2 ด้านนอก คิดเต็ม, ≥ D/2 ด้านใน ไม่คิด, ระหว่างนั้นเชิงเส้น (15.5.4) */
  pileShareHalfWidth: 0.5,

  /** ระยะห่างเสาเข็มศูนย์ถึงศูนย์แนะนำ ≥ 3D (ต่ำกว่านั้นเตือน — ประสิทธิภาพกลุ่มเข็ม) */
  pileSpacingFactor: 3,
  /** ระยะผิวเสาเข็มถึงขอบฐานราก ≥ 15 ซม. (ต่ำกว่านั้นเตือน) */
  pileEdgeClear: 15,
  /** โมเมนต์ที่กลุ่มเข็มแถวเดียว/ต้นเดียวรับไม่ได้ ยอมให้ไม่เกิน 10 kg·m (kg·cm) */
  unresistedTolerance: 1000,

  /** จำนวนเสาเข็มที่รองรับ (รูปแบบมาตรฐาน) */
  maxPiles: 9,

  /** ออกแบบอัตโนมัติ: ความหนาเริ่ม 40 ซม. ทีละ 5 ซม. ถึง 300 ซม. */
  sizeStep: 5,
  autoMinThickness: 40,
  autoMaxThickness: 300,
} as const;

/**
 * พื้นคอนกรีตหล่อในที่ — วิธีหน่วยแรงใช้งาน
 *
 * ⚠ ค่าคงที่ในบล็อกนี้พิมพ์จากความรู้ทั่วไปของมาตรฐาน ไม่ได้คัดจากมาตรฐานฉบับจริง
 *   วิศวกรผู้ออกแบบต้องทานกับ ACI 318 ฉบับพิมพ์ก่อนนำไปใช้จริง
 *   ตั้งใจรวมไว้ที่เดียวทั้งหมดเพื่อให้ตรวจทานได้ครบในหน้าเดียว
 */
export const ACI318_WSD_SLAB = {
  label: 'ACI 318 Alternate Design Method (WSD) — พื้นหล่อในที่',
  /** หน่วยน้ำหนักคอนกรีตเสริมเหล็ก (t/m³) */
  concreteUnitWeight: 2.4,

  /**
   * สัมประสิทธิ์โมเมนต์โดยประมาณ (8.3.3) — M = w·L²/ตัวหาร
   *
   * ใช้ได้เมื่อ: น้ำหนักแผ่สม่ำเสมอ, ช่วงติดกันยาวต่างกันไม่เกิน 20%, และ LL ≤ 3·DL
   * เงื่อนไขข้อหลังโปรแกรมตรวจให้และขึ้นเป็นคำเตือนเมื่อไม่ผ่าน
   *
   * negEnd = โมเมนต์ลบที่ผิวในของที่รองรับริม (สมมติหล่อติดคานขอบ = 24;
   *          ถ้าหล่อติดเสาให้ใช้ 16; ถ้าที่รองรับหมุนได้อิสระไม่มีโมเมนต์ลบ)
   * negInt = โมเมนต์ลบที่ผิวของที่รองรับภายใน (ใช้ 10 ซึ่งเป็นค่าของช่วงต่อเนื่องตั้งแต่ 3 ช่วงขึ้นไป
   *          กรณี 2 ช่วงมาตรฐานให้ใช้ 9 — โปรแกรมเลือกค่าที่ปลอดภัยกว่าคือ 10 ไว้ก่อน)
   */
  momentDivisors: {
    simple: { pos: 8, negEnd: null, negInt: null },
    oneEnd: { pos: 14, negEnd: 24, negInt: 10 },
    bothEnds: { pos: 16, negEnd: null, negInt: 11 },
    cantilever: { pos: null, negEnd: 2, negInt: null },
  },
  /** สัมประสิทธิ์โมเมนต์ใช้ได้เมื่อ LL ≤ ค่านี้ × DL */
  liveToDeadLimit: 3,

  /**
   * ความหนาขั้นต่ำของพื้นทางเดียวตัน (Table 9.5(a)) h ≥ L/ตัวหาร ที่ fy = 4,200 ksc
   * ⚠ เป็นแถว "solid one-way slabs" คนละแถวกับคาน (คานใช้ 16/18.5/21/8 ใน ACI318_WSD)
   * ตัวคูณปรับ fy ใช้ร่วมกับคาน: 0.4 + fy/7,000 (ACI318_WSD.minDepthFyDivisor)
   */
  minThicknessDivisor: { simple: 20, oneEnd: 24, bothEnds: 28, cantilever: 10 },
  /** พื้นสองทางบนคาน (9.5.3): h ≥ เส้นรอบรูป/180 และไม่น้อยกว่า twoWayMinThickness */
  twoWayPerimeterDivisor: 180,
  twoWayMinThickness: 9,
  /** ความหนาต่ำสุดเชิงปฏิบัติของแต่ละชนิด (ซม.) — ค่าก่อสร้าง ไม่ใช่ข้อกำหนด ACI */
  absMinThickness: { oneWay: 8, twoWay: 9, cantilever: 8, onGround: 10 },
  /** พื้นวางบนดินตามการใช้งาน (ซม.) — ค่าปฏิบัติ ไม่ใช่ข้อกำหนด ACI ⚠ ต้องยืนยัน */
  onGroundMinThickness: { light: 10, medium: 12.5, heavy: 15 },

  /** ระยะหุ้มคอนกรีตของพื้นไม่สัมผัสดิน เหล็ก ≤ DB16 (7.7.1(c)) */
  cover: 2,
  /** ระยะหุ้มของพื้นวางบนดิน (หล่อติดดิน) */
  coverOnGround: 7.5,

  /** เฉือนแบบคาน vc = 0.29√f'c (A.7.4.1) — พื้นไม่ใส่เหล็กปลอก จึงเป็นขีดจำกัดตายตัว */
  oneWayVcCoef: 0.29,

  /** ระยะเรียงเหล็กหลัก ≤ 3h และ ≤ 45 ซม. (7.6.5) */
  maxSpacingFactor: 3,
  maxSpacing: 45,
  /** ระยะเรียงเหล็กกันร้าว/อุณหภูมิ ≤ 5h และ ≤ 45 ซม. (7.12.2.2) */
  tempSpacingFactor: 5,

  /** ความลึกประสิทธิผลต่ำสุดที่ยังออกแบบได้ (ซม.) */
  minEffectiveDepth: 5,

  /** ออกแบบอัตโนมัติ: ความหนาปัดทีละ 2.5 ซม. ในช่วง 8–40 ซม. */
  sizeStep: 2.5,
  autoMaxThickness: 40,
  /** ระยะเรียงปัดลงทีละ 2.5 ซม. และไม่ถี่กว่า 7.5 ซม. — ค่าก่อสร้าง ⚠ ต้องยืนยัน */
  spacingStep: 2.5,
  minSpacing: 7.5,

  /** ความยาวเหล็กบนที่ยื่นออกจากผิวที่รองรับในรูปตัด = สัดส่วนนี้ × ช่วง (ใช้เขียนแบบเท่านั้น) */
  topBarExtension: 0.25,
} as const;

/**
 * บันไดท้องเรียบพาดตามยาวระหว่างคาน — ออกแบบเป็นแผ่นพื้นทางเดียว แถบกว้าง 1 ม.
 *
 * ใช้สัมประสิทธิ์โมเมนต์ ความหนาขั้นต่ำ ระยะเรียง และเฉือน ชุดเดียวกับพื้น (ACI318_WSD_SLAB)
 * บล็อกนี้เก็บเฉพาะค่าที่เป็นของบันไดเอง
 *
 * ⚠ เกณฑ์ขนาดขั้นบันไดพิมพ์จากความรู้ทั่วไปของกฎกระทรวงฉบับที่ 55 (พ.ศ. 2543)
 *   ไม่ได้คัดจากฉบับจริง วิศวกรต้องทานกับกฎกระทรวงฉบับปัจจุบันก่อนใช้งาน
 */
export const ACI318_WSD_STAIR = {
  label: 'ACI 318 Alternate Design Method (WSD) — บันไดท้องเรียบ',

  /**
   * ปลายที่ไม่ต่อเนื่องแต่หล่อเป็นเนื้อเดียวกับคานรองรับ มีโมเมนต์ลบจากการยึดรั้ง
   * ใช้ M− = w·L²/24 ตาม ACI 8.3.3 (ที่รองรับริมหล่อติดคานขอบ) เพื่อจัดเหล็กบนกันร้าว
   * ส่วน M+ ยังคิดเป็นช่วงยึดหมุน (w·L²/8) ปลอดภัยไว้ก่อน
   */
  discontinuousEndDivisor: 24,
  /** แรงเฉือนที่ปลายต่อเนื่องเผื่อ 15% ตาม ACI 8.3.3 */
  continuousShearFactor: 1.15,

  /** ความหนาท้องบันไดต่ำสุดเชิงปฏิบัติ (ซม.) — ค่าก่อสร้าง ไม่ใช่ข้อกำหนด ACI */
  absMinThickness: 10,
  /** ส่วนราบที่ปลายต้องยาวพอวางบนคาน = ครึ่งความกว้างคานที่ใช้เขียนแบบ (ซม.) */
  minLanding: 10,

  /** ระยะที่เหล็กรับแรงดึงเลยจุดหักมุมด้านในไปทาบกับผิวตรงข้าม (ซม.) — ค่าเขียนแบบ ⚠ ต้องยืนยัน */
  kinkLap: 40,
  /** ระยะเรียงเหล็กขั้นบันไดเริ่มต้น (ซม.) — เหล็กตามแบบมาตรฐาน ไม่ได้คำนวณ */
  stepBarSpacing: 25,

  /** ขนาดขั้นบันไดตามประเภทอาคาร (ซม.) ⚠ ต้องยืนยันกับกฎกระทรวงฉบับจริง */
  riserMax: { residential: 20, public: 18 },
  treadMin: { residential: 22, public: 25 },
  flightRiseMax: { residential: 300, public: 400 },
  widthMin: { residential: 80, public: 120 },
  /** ระยะก้าวที่เดินสบาย 2R + T (ซม.) — เกณฑ์ออกแบบทั่วไป ไม่ใช่ข้อกฎหมาย */
  strideMin: 60,
  strideMax: 65,
} as const;
