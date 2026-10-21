import type { DesignCode } from './codes/designCode';
import type { BarName } from './rebar';

export type SectionKey = 'A' | 'B';
export type Face = 'top' | 'bottom';
export type StirrupMode = 'auto' | 'single' | 'double';
/**
 * แบบของ 2 ปลอก (4 ขา) — ปลอกนอกปิดรอบเหล็กทั้งหมดเหมือนกัน ต่างกันที่ปลอกใน
 * - narrow  ปลอกในแคบ คร่อมเหล็กเส้นกลางของชั้นแรก (ชั้นแรกบน/ล่างต้องมี ≥ 4 เส้น)
 * - layer2  ปลอกในกว้างเต็มคาน รัดเหล็กชั้นที่ 2 บน/ล่างไว้ที่มุม (ชั้นที่ 2 บน/ล่างต้องมี ≥ 2 เส้น)
 */
export type DoubleStirrupType = 'narrow' | 'layer2';
export const DOUBLE_STIRRUP_TYPES: readonly DoubleStirrupType[] = ['narrow', 'layer2'];
export type SupportCondition = 'simple' | 'oneEnd' | 'bothEnds' | 'cantilever';
/**
 * วิธีคำนวณแรงเฉือนร่วมแรงบิด
 * - aci  ACI 318-83 (vt = 3T/Σx²y, คอนกรีตรับแรงบิดร่วมกับแรงเฉือน) — คาน คสล. ทั่วไป
 * - eit  เอกสาร ว.ส.ท. (vt = 3.5T/Σx²y, เหล็กปลอกปิดรับแรงบิดทั้งหมด) — คานรับพื้นยื่น
 */
export type TorsionMethod = 'aci' | 'eit';

/** ข้อมูลนำเข้า — หน่วย: ขนาด ซม., L ม., หน่วยแรง ksc, M/T kg·m, V kg */
export interface BeamInput {
  b: number;
  h: number;
  L: number;
  cover: number;

  /** มาตรฐานที่ใช้ออกแบบ — ไม่ระบุ = วสท. */
  code?: DesignCode;

  fc: number;
  fy: number;
  fyv: number;

  M: number;
  V: number;
  T: number;

  mainBar: BarName;
  stirrupBar: BarName;
  stirrupMode: StirrupMode;
  /** แบบของ 2 ปลอกเมื่อโปรแกรมเลือก/ผู้ใช้สั่ง 2 ปลอก — ไม่ระบุ = ปลอกในแคบ */
  doubleStirrup?: DoubleStirrupType;
  /** ระยะเหล็กปลอกต่ำสุดที่ยังก่อสร้างสะดวก (ซม.) */
  sMin: number;
  support: SupportCondition;
  /** ไม่ระบุ = 'aci' — ไม่อยู่ในไฟล์ของคาน คสล. ทั่วไป คานรับพื้นยื่นตั้งเป็น 'eit' ตอนคำนวณ */
  torsionMethod?: TorsionMethod;
}

export interface Bar {
  id: string;
  size: BarName;
}

/** เหล็กหนึ่งชั้น — วางเรียงเต็มความกว้างหน้าตัด */
export interface BarLayer {
  id: string;
  bars: Bar[];
}

/** เหล็กข้างหนึ่งแถว = ซ้าย 1 เส้น + ขวา 1 เส้น */
export interface SideBarRow {
  id: string;
  size: BarName;
}

export interface StirrupSpec {
  size: BarName;
  /** 1 = ปลอกเดี่ยว (2 ขา), 2 = ปลอกนอก + ปลอกใน (4 ขา) */
  count: 1 | 2;
  /** แบบของปลอกใน (ใช้เมื่อ count = 2) — ไม่ระบุ = ปลอกในแคบ (ไฟล์ก่อนมีตัวเลือกนี้) */
  inner?: DoubleStirrupType;
  /** ระยะเรียง (ซม.) */
  spacing: number;
}

/** รูปแบบการเสริมเหล็กของหน้าตัด — layer[0] คือชั้นที่ชิดผิวคอนกรีต */
export interface SectionLayout {
  top: BarLayer[];
  bottom: BarLayer[];
  side: SideBarRow[];
  stirrup: StirrupSpec;
}

export type CheckStatus = 'ok' | 'fail' | 'warn';

export interface CheckItem {
  id: string;
  group:
    | 'flexure' | 'shear' | 'detail' | 'beam' | 'strength' | 'slenderness' | 'transverse'
    | 'soil' | 'oneWay' | 'punching' | 'anchorage' | 'bearing' | 'pile'
    | 'deflection' | 'geometry'
    | 'thickness' | 'reinforcement' | 'capacity';
  label: string;
  required: string;
  provided: string;
  status: CheckStatus;
}

export interface CalcStep {
  label: string;
  formula: string;
  value: string;
  /** แสดงในใบพิมพ์ A4 ด้วย */
  print?: boolean;
}

/** แบบปลอกในของรูปแบบเหล็ก — ไฟล์เก่าไม่มีค่านี้ = ปลอกในแคบ */
export const innerTypeOf = (spec: Pick<StirrupSpec, 'inner'>): DoubleStirrupType => spec.inner ?? 'narrow';
