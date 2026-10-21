import type { DesignCode } from '../codes/designCode';
import type { BarDir } from '../footing/types';
import type { BarName } from '../rebar';
import type { Face } from '../types';

/**
 * ชนิดพื้นหล่อในที่
 * - oneWay     พื้นทางเดียว วางบนคานสองด้าน
 * - twoWay     พื้นสองทาง วางบนคานสี่ด้าน
 * - cantilever พื้นยื่น ยึดแน่นด้านเดียว
 * - onGround   พื้นวางบนดิน ถ่ายน้ำหนักลงดินโดยตรง
 */
export type SlabType = 'oneWay' | 'twoWay' | 'cantilever' | 'onGround';

/** สภาพขอบพื้นแต่ละด้าน — ใช้เลือกสัมประสิทธิ์โมเมนต์ */
export type EdgeSupport = 'simple' | 'continuous' | 'free';

export type SizeMode = 'auto' | 'manual';

/** ระดับการใช้งานของพื้นวางบนดิน — ใช้กำหนดความหนาขั้นต่ำ */
export type GroundUsage = 'light' | 'medium' | 'heavy';

/**
 * ระดับของพื้นทางเดียว/สองทาง ตามแบบขยายพื้น S1 — ใช้เลือกรูปเท่านั้น ไม่เปลี่ยนการคำนวณ
 * - general  กรณีพื้นทั่วไป: หลังพื้นเสมอหลังคาน เหล็กคอม้าผ่านคานต่อไปช่วงถัดไป
 * - dropped  กรณีพื้นลดระดับ: พื้นต่ำกว่าคานและพื้นข้างเคียง เหล็กทุกเส้นงอลงฝังในคาน
 */
export type SlabLevel = 'general' | 'dropped';

/**
 * ข้อมูลนำเข้าพื้น — หน่วย: ขนาด ซม., น้ำหนักบรรทุก กก./ตร.ม., หน่วยแรง ksc
 *
 * แกน x วางตามด้าน lx, แกน y ตามด้าน ly
 * เหล็ก "ทิศ x" คือเหล็กที่พาดช่วง lx (วางขนานแกน x)
 *
 * โครงสร้างต้องแบน (ไม่มี object ซ้อน) เพราะ parseSlabProject คัดค่าทีละคีย์ด้วยการเทียบ typeof
 */
export interface SlabInput {
  /** ชื่อชิ้นส่วนในหัวรูป — ตั้งจากชื่อรายการ ไม่ได้กรอกเอง */
  slabName: string;

  slabType: SlabType;

  /** ช่วงพื้นตามแกน x (ซม.) — พื้นยื่นใช้เป็นระยะยื่น */
  lx: number;
  /** ช่วงพื้นตามแกน y (ซม.) */
  ly: number;

  /** สภาพขอบ: x1/x2 คือขอบที่ตั้งฉากแกน x (รองรับช่วง lx), y1/y2 ตั้งฉากแกน y */
  edgeX1: EdgeSupport;
  edgeX2: EdgeSupport;
  edgeY1: EdgeSupport;
  edgeY2: EdgeSupport;

  thicknessMode: SizeMode;
  /** ความหนาที่กำหนดเอง (ใช้เมื่อ thicknessMode = 'manual') */
  t: number;
  cover: number;

  /** มาตรฐานที่ใช้ออกแบบ — ไม่ระบุ = วสท. */
  code?: DesignCode;

  fc: number;
  fy: number;

  /** น้ำหนักบรรทุกคงที่เพิ่มเติม (วัสดุปูผิว ฝ้า ผนังเบา) — น้ำหนักตัวพื้นโปรแกรมคิดจาก t เอง */
  finishDL: number;
  /** น้ำหนักบรรทุกจร */
  LL: number;

  /** ระดับพื้นตามแบบขยายพื้น S1 — ใช้เฉพาะพื้นทางเดียวและสองทาง */
  level: SlabLevel;

  /** ระดับการใช้งาน — ใช้เฉพาะพื้นวางบนดิน */
  usage: GroundUsage;
  /** กำลังรับน้ำหนักของดินใต้พื้นที่ยอมให้ (t/m²) — ใช้เฉพาะพื้นวางบนดิน */
  qa: number;

  /** ขนาดเหล็กหลักที่ต้องการ (แบบ S1: เหล็กคอม้าเว้นเส้นและเหล็กเสริมพิเศษ) */
  bar: BarName;
  /** ขนาดเหล็กกันร้าว/อุณหภูมิที่ต้องการ (แบบ S1: เหล็กทิศตั้งฉากของพื้นทางเดียว) */
  tempBar: BarName;
}

export interface SlabDims {
  lx: number;
  ly: number;
  t: number;
}

/** เหล็กหนึ่งชุด — ระบุด้วยระยะเรียง ไม่ใช่จำนวนเส้น ตามธรรมเนียมแบบพื้น */
export interface BarRun {
  size: BarName;
  /** ระยะเรียงศูนย์ถึงศูนย์ (ซม.) */
  spacing: number;
}

/**
 * รูปแบบการเสริมเหล็กของพื้น
 *
 * null = ไม่มีเหล็กชุดนั้น (เช่น ผิวบนของพื้นที่ขอบไม่ต่อเนื่อง)
 * outerLayer บอกว่าทิศใดวางชิดผิวคอนกรีตกว่า (ได้ d มากกว่า) ของแต่ละผิว
 *
 * พื้นทางเดียว/สองทาง (แบบขยายพื้น S1) อ่านความหมายต่างออกไป — ดู detail.ts
 * - bottom[ทิศที่มีคอม้า] = เหล็กคอม้าเว้นเส้น: อยู่ล่างกลางช่วง ครึ่งหนึ่งงอขึ้นเป็นเหล็กบนที่ขอบ
 * - top[ทิศที่มีคอม้า]    = เหล็กเสริมพิเศษ: เหล็กบนที่ขอบ ยื่น L/4
 * - bottom[ทิศตั้งฉาก] ของพื้นทางเดียว = เหล็กกันร้าว (เห็นเป็นจุดในรูป)
 *
 * ตั้งชื่อ outerLayer แทน bottom เพราะ FootingLayout.bottom เป็น BarDir
 * ส่วนที่นี่ bottom เป็นชื่อผิว ถ้าใช้ชื่อซ้ำกันจะสับสน
 */
export interface SlabLayout {
  bottom: Record<BarDir, BarRun | null>;
  top: Record<BarDir, BarRun | null>;
  outerLayer: Record<Face, BarDir>;
}
