import type { BarName } from './rebar';

export type SectionKey = 'A' | 'B';
export type Face = 'top' | 'bottom';
export type StirrupMode = 'auto' | 'single' | 'double';
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

  fc: number;
  fy: number;
  fyv: number;

  M: number;
  V: number;
  T: number;

  mainBar: BarName;
  stirrupBar: BarName;
  stirrupMode: StirrupMode;
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
    | 'deflection' | 'geometry';
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
