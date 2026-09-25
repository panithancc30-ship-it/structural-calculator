import type { BarName } from '../rebar';
import type { BarRun, SizeMode } from '../slab/types';

/**
 * สภาพปลายบันได
 * - simple     ปลายไม่ต่อเนื่อง หล่อติดคานรองรับ (ออกแบบ M+ เป็นช่วงยึดหมุน)
 * - continuous ต่อเนื่องไปเป็นพื้นช่วงถัดไปเลยคานรองรับ
 */
export type StairEnd = 'simple' | 'continuous';

/** ทิศที่บันไดขึ้นเมื่อมองรูปตัด — ใช้เขียนแบบเท่านั้น ไม่มีผลต่อการคำนวณ */
export type StairAscend = 'right' | 'left';

/** ประเภทอาคาร — ใช้ตรวจขนาดลูกตั้ง ลูกนอน และความกว้างบันได */
export type StairUsage = 'residential' | 'public';

/**
 * ข้อมูลนำเข้าบันไดท้องเรียบหนึ่งช่วง — หน่วย: ขนาด ซม., น้ำหนักบรรทุก กก./ตร.ม. (พื้นที่ฉายราบ), หน่วยแรง ksc
 *
 * วัดตามแนวราบจากศูนย์กลางคานรองรับปลายล่าง (x = 0) ไปทางปลายบน
 * ส่วนราบปลายล่างยาว landingLow แล้วเป็นขั้นบันได (risers − 1) ลูกนอน แล้วเป็นส่วนราบปลายบนยาว landingHigh
 *
 * โครงสร้างต้องแบน (ไม่มี object ซ้อน) เพราะ parseStairProject คัดค่าทีละคีย์ด้วยการเทียบ typeof
 */
export interface StairInput {
  /** ชื่อชิ้นส่วนในหัวรูป — ตั้งจากชื่อรายการ ไม่ได้กรอกเอง */
  stairName: string;
  /** ช่วงระดับของบันไดช่วงนี้ เช่น "ชั้น 1 – ชานพัก" ใช้ต่อท้ายชื่อรูปตัด */
  levels: string;
  usage: StairUsage;

  /** ลูกตั้ง (ซม.) */
  riser: number;
  /** ลูกนอน (ซม.) */
  tread: number;
  /** จำนวนลูกตั้งของช่วงนี้ — ลูกนอนมีน้อยกว่าหนึ่ง เพราะขั้นบนสุดคือพื้นชั้นบน */
  risers: number;
  /** ส่วนราบปลายล่าง: จากศูนย์กลางคานรองรับถึงลูกตั้งขั้นแรก */
  landingLow: number;
  /** ส่วนราบปลายบน: จากลูกตั้งขั้นสุดท้ายถึงศูนย์กลางคานรองรับ */
  landingHigh: number;
  /** ความกว้างบันได — ใช้ตรวจตามกฎกระทรวง ส่วนการออกแบบคิดต่อแถบกว้าง 1 ม. */
  width: number;

  endLow: StairEnd;
  endHigh: StairEnd;
  ascend: StairAscend;

  thicknessMode: SizeMode;
  /** ความหนาท้องบันได (ตั้งฉากกับแนวลาด) ใช้เมื่อ thicknessMode = 'manual' */
  t: number;
  cover: number;

  fc: number;
  fy: number;

  /** น้ำหนักวัสดุปูผิวต่อพื้นที่ฉายราบ — น้ำหนักท้องบันไดและขั้นบันไดโปรแกรมคิดเอง */
  finishDL: number;
  LL: number;

  /** ขนาดเหล็กหลักที่ต้องการ */
  bar: BarName;
  /** ขนาดเหล็กกระจายและเหล็กขั้นบันไดที่ต้องการ */
  tempBar: BarName;
}

export interface StairDims {
  t: number;
}

/**
 * เหล็กเสริมบันไดแต่ละชุด
 * - bottom  เหล็กล่างรับ M+ วิ่งตลอดช่วง
 * - topLow  เหล็กบนที่ปลายล่าง รับ M− และไขว้ที่มุมหักด้านใน
 * - topHigh เหล็กบนที่ปลายบน
 * - dist    เหล็กกระจาย (ตั้งฉากกับระนาบตัด)
 * - step    เหล็กขั้นบันได และเหล็กมุมขั้น — ตามแบบมาตรฐาน ไม่ได้คำนวณ
 */
export type StairBarKey = 'bottom' | 'topLow' | 'topHigh' | 'dist' | 'step';

export const STAIR_BAR_KEYS: StairBarKey[] = ['bottom', 'topLow', 'topHigh', 'dist', 'step'];

/** null = ไม่มีเหล็กชุดนั้น */
export type StairLayout = Record<StairBarKey, BarRun | null>;
