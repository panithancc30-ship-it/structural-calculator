import type { BarName } from '../rebar';
import type { StirrupMode } from '../types';

/** สภาพรองรับของคานรับพื้นยื่น — ใช้เลือกสัมประสิทธิ์โมเมนต์และแรงเฉือน */
export type LedgeSupport = 'simple' | 'oneEnd' | 'bothEnds';

export const LEDGE_SUPPORTS: readonly LedgeSupport[] = ['simple', 'oneEnd', 'bothEnds'];

/**
 * ข้อมูลนำเข้าคานรับพื้นยื่น — หน่วย: ขนาดหน้าตัด ซม., ช่วงและความสูง ม., น้ำหนัก กก./ตร.ม. หรือ กก./ม., หน่วยแรง ksc
 *
 * ผู้ใช้กรอกน้ำหนักบรรทุก ไม่ได้กรอก M, V, T — โปรแกรมคิดแรงภายในให้ (ดู loads.ts)
 * โครงสร้างต้องแบน (ไม่มี object ซ้อน) เพราะ parseLedgeProject คัดค่าทีละคีย์ด้วยการเทียบ typeof
 */
export interface LedgeBeamInput {
  /** ความยาวพื้นยื่น Lc (ม.) วัดจากศูนย์กลางคานถึงปลายพื้น */
  slabLength: number;
  /** ความหนาพื้นยื่น (ซม.) */
  slabT: number;
  /** น้ำหนักวัสดุปูผิวบนพื้นยื่น */
  finishDL: number;
  /** น้ำหนักใช้งาน (น้ำหนักบรรทุกจร) บนพื้นยื่น */
  LL: number;

  /** ผนังหรือราวกันตกที่ปลายพื้นยื่น — สูง (ม.) และน้ำหนักต่อพื้นที่ผนัง */
  tipWallH: number;
  tipWallW: number;
  /** ผนังบนคาน — ลงคานตรง ไม่ทำให้เกิดแรงบิด */
  beamWallH: number;
  beamWallW: number;
  /** น้ำหนักอื่นที่ลงคานโดยตรง (กก./ม.) เช่น พื้นด้านในที่ถ่ายลงคาน */
  otherLoad: number;

  b: number;
  h: number;
  /** ช่วงคาน (ม.) */
  L: number;
  support: LedgeSupport;
  cover: number;

  fc: number;
  fy: number;
  fyv: number;

  mainBar: BarName;
  stirrupBar: BarName;
  stirrupMode: StirrupMode;
  /** ระยะเหล็กปลอกต่ำสุดที่ยังก่อสร้างสะดวก (ซม.) */
  sMin: number;
}
