import { ACI318_WSD as C } from '../codes/aci318Wsd';

export interface WsdParams {
  fc: number;
  fy: number;
  fyv: number;
  Ec: number;
  n: number;
  fcAllow: number;
  fsAllow: number;
  fvAllow: number;
  k: number;
  j: number;
  R: number;
}

export function wsdParams(fc: number, fy: number, fyv: number): WsdParams {
  const Ec = C.EcCoef * Math.sqrt(fc);
  const n = Math.round(C.Es / Ec);
  const fcAllow = C.fcRatio * fc;
  const fsAllow = Math.min(C.fsRatio * fy, C.fsMax);
  const fvAllow = Math.min(C.fsRatio * fyv, C.fsMax);
  const k = 1 / (1 + fsAllow / (n * fcAllow));
  const j = 1 - k / 3;
  const R = 0.5 * fcAllow * k * j;
  return { fc, fy, fyv, Ec, n, fcAllow, fsAllow, fvAllow, k, j, R };
}

export interface FlexureDesign {
  /** kg·cm */
  M: number;
  d: number;
  dPrime: number;
  /** โมเมนต์ต้านทานของหน้าตัดเสริมเหล็กรับดึงอย่างเดียว (kg·cm) */
  Mc: number;
  doubly: boolean;
  As1: number;
  As2: number;
  AsFlex: number;
  AsMin: number;
  /** As รับดึงที่ต้องการ = max(AsFlex, AsMin) */
  AsReq: number;
  fsPrime: number;
  /** A′s ที่ต้องการ (Infinity ถ้าเหล็กรับอัดไม่มีประสิทธิผล) */
  AsPrimeReq: number;
}

/**
 * ออกแบบเหล็กรับโมเมนต์ดัด M (kg·cm) ของหน้าตัดสี่เหลี่ยม
 * M = 0 (เช่น ปลายคานช่วงเดียวของคานรับพื้นยื่น) ไม่ต้องการเหล็กรับดึงจากการวิเคราะห์ จึงไม่ใช้ As,min
 */
export function designFlexure(p: WsdParams, b: number, d: number, dPrime: number, M: number): FlexureDesign {
  const Mc = p.R * b * d * d;
  const AsMin = (C.AsMinCoef / p.fy) * b * d;

  if (M <= Mc) {
    const As1 = M / (p.fsAllow * p.j * d);
    return {
      M, d, dPrime, Mc,
      doubly: false,
      As1, As2: 0, AsFlex: As1, AsMin,
      AsReq: M > 0 ? Math.max(As1, AsMin) : 0,
      fsPrime: 0,
      AsPrimeReq: 0,
    };
  }

  const M2 = M - Mc;
  const arm = d - dPrime;
  const As1 = Mc / (p.fsAllow * p.j * d);
  const As2 = arm > 0 ? M2 / (p.fsAllow * arm) : Infinity;
  const fsPrime = Math.min(p.fsAllow, (2 * p.fsAllow * (p.k - dPrime / d)) / (1 - p.k));
  const AsPrimeReq = fsPrime > 0 && arm > 0 ? M2 / (fsPrime * arm) : Infinity;
  const AsFlex = As1 + As2;

  return {
    M, d, dPrime, Mc,
    doubly: true,
    As1, As2, AsFlex, AsMin,
    AsReq: Math.max(AsFlex, AsMin),
    fsPrime,
    AsPrimeReq,
  };
}
