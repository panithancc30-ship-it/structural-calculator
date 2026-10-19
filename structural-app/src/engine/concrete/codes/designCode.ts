import { ACI318_WSD_FOOTING } from './aci318Wsd';

/**
 * มาตรฐานที่ใช้ออกแบบงานคอนกรีต — เลือกได้ทีละรายการ ทั้งสองแบบเป็นวิธีหน่วยแรงใช้งาน (WSD)
 * - eit  มาตรฐาน วสท. (ค่าเริ่มต้น) — ค่าคงที่ทั้งหมดอยู่ใน aci318Wsd.ts
 * - aci  ACI 318-89 Appendix A (Alternate Design Method) — ใช้ค่าคงที่ชุดเดียวกับ วสท.
 *        ยกเว้นค่าที่ต่างกันซึ่งรวมไว้ใน ACI_ADM ด้านล่าง
 *
 * fc = 0.45f′c และ fs = 0.5fy ≤ 1,700 ksc ใช้ร่วมกันทั้งสองมาตรฐาน
 */
export type DesignCode = 'eit' | 'aci';

export const DESIGN_CODES: readonly DesignCode[] = ['eit', 'aci'];

/** ไม่ระบุ (ไฟล์ที่บันทึกก่อนมีตัวเลือกนี้) = มาตรฐาน วสท. */
export const codeOf = (input: { code?: DesignCode }): DesignCode => input.code ?? 'eit';

/** ชื่อสั้นบนปุ่มเลือก */
export const CODE_SHORT: Record<DesignCode, string> = { eit: 'วสท.', aci: 'ACI 318 (WSD)' };

/** ชื่อมาตรฐานในหัวรายการคำนวณ เช่น "มาตรฐาน วสท. ฐานรากแผ่", "ACI 318 Alternate Design Method — ฐานรากแผ่" */
export function codeLabel(code: DesignCode, part = ''): string {
  if (code === 'aci') return `ACI 318 Alternate Design Method${part ? ` — ${part}` : ''}`;
  return `มาตรฐาน วสท.${part ? ` ${part}` : ''}`;
}

/**
 * ค่าที่ ACI 318-89 Appendix A ต่างจากมาตรฐาน วสท. (คัดจากสูตร ACI เดิมของโปรแกรมก่อนเปลี่ยนเป็น วสท.)
 * หน่วย kg, cm, ksc — สัมประสิทธิ์ของ √f′c แปลงจาก psi ด้วย 1/√14.22 ≈ 0.265
 */
export const ACI_ADM = {
  /** คาน: v − vc ≤ 1.16√f′c (4.4√f′c psi) ไม่ผ่านต้องขยายหน้าตัด */
  vExcessMaxCoef: 1.16,

  /**
   * เสา (A.6): กำลังรับแรงอัดร่วมกับโมเมนต์ = 40% ของกำลังตาม Chapter 10 (SDM, รวม φ)
   * ผลความชะลูดตาม 10.10–10.11 โดยใช้ 2.5 เท่าของแรงใช้งานแทน Pu
   */
  column: {
    capacityFactor: 0.4,
    slendernessLoadFactor: 2.5,
    phiTied: 0.7,
    phiSpiral: 0.75,
    /** Pn,max = 0.80Po (ปลอกเดี่ยว), 0.85Po (ปลอกเกลียว) */
    pmaxTied: 0.8,
    pmaxSpiral: 0.85,
    epsCu: 0.003,
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
    /** Ø ปลอกเดี่ยว ≥ 9 มม. (#3) (7.10.5.1) */
    tieMinDia: 0.9,
  },

  /** ฐานรากแผ่และฐานรากเสาเข็ม */
  footing: {
    /** เฉือนทะลุ vc = √f′c·min(0.53, 0.265(1 + 2/βc), 0.265(αs·d/b0 + 2)) (A.7.4.2 + 11.12.2) */
    punchingVcMax: 0.53,
    punchingVcBase: 0.265,
    /** αs = 40 เสาภายใน, 30 เสาขอบ, 20 เสามุม — ตามจำนวนด้านของหน้าตัดวิกฤต */
    alphaS4: 40,
    alphaS3: 30,
    alphaS2: 20,
    /** ระยะฝังเหล็กตรง ld = 0.06Ab·fy/√f′c ≥ 0.0057db·fy ≥ 30 ซม. (12.2.2) */
    ldCoef: 0.06,
    ldDbCoef: 0.0057,
  },
} as const;

/** αs ของเฉือนทะลุ ACI ตามจำนวนด้านของหน้าตัดวิกฤต */
export const alphaS = (nSides: number) =>
  nSides >= 4 ? ACI_ADM.footing.alphaS4 : nSides === 3 ? ACI_ADM.footing.alphaS3 : ACI_ADM.footing.alphaS2;

/**
 * หน่วยแรงเฉือนทะลุที่คอนกรีตรับได้ (ksc)
 * วสท. 0.53√f′c, ACI √f′c·min(0.53, 0.265(1 + 2/βc), 0.265(αs·d/b0 + 2))
 */
export function punchingVc(code: DesignCode, fc: number, betaC: number, nSides: number, d: number, b0: number): number {
  const sq = Math.sqrt(fc);
  if (code === 'eit') return ACI318_WSD_FOOTING.punchingVcCoef * sq;
  const F = ACI_ADM.footing;
  return sq * Math.min(F.punchingVcMax, F.punchingVcBase * (1 + 2 / betaC), F.punchingVcBase * ((alphaS(nSides) * d) / b0 + 2));
}

/** สูตร vc ทะลุสำหรับขั้นตอนคำนวณ */
export const punchingVcFormula = (code: DesignCode, nSides: number) =>
  code === 'eit' ? '0.53√f′c' : `√f′c·min(0.53, 0.265(1+2/βc), 0.265(αs·d/b0+2)), αs = ${alphaS(nSides)}`;
