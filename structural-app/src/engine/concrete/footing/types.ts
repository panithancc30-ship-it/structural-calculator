import type { BarName } from '../rebar';

/** ตำแหน่งเสาบนฐานราก: ศูนย์กลาง, เยื้องศูนย์ (กำหนดระยะ), ตีนเป็ดชิดขอบ, ตีนเป็ดชิดมุม */
export type ColumnPosition = 'center' | 'offset' | 'edge' | 'corner';
export type EdgeSide = 'left' | 'right' | 'bottom' | 'top';
export type CornerSide = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
export type SizeMode = 'auto' | 'manual';
/** ทิศเหล็ก: 'x' = เหล็กวางยาวตามด้าน B (กระจายตามด้าน L), 'y' = ยาวตามด้าน L */
export type BarDir = 'x' | 'y';

/**
 * ข้อมูลนำเข้าฐานราก — หน่วย: ขนาด ซม., Df ม., qa t/m², γs t/m³, หน่วยแรง ksc, P kg, Mx/My kg·m
 * พิกัดจุดกำเนิดที่ศูนย์ถ่วงฐานราก แกน x ตามด้าน B (ขวา +), แกน y ตามด้าน L (บน +)
 * My บวก → แรงดันดินด้าน +x เพิ่มขึ้น, Mx บวก → ด้าน +y เพิ่มขึ้น
 */
export interface FootingInput {
  projectName: string;
  footingName: string;
  designer: string;

  /** ขนาดเสา/ตอม่อ ตามแกน x และ y */
  cx: number;
  cy: number;
  position: ColumnPosition;
  /** ระยะศูนย์เสาจากศูนย์ฐานราก (เฉพาะเยื้องศูนย์) */
  ex: number;
  ey: number;
  edgeSide: EdgeSide;
  cornerSide: CornerSide;
  /** ระยะผิวเสาถึงขอบฐานราก (ตีนเป็ด) */
  edgeGap: number;

  sizeMode: SizeMode;
  /** ขนาดที่กำหนดเอง (ใช้เมื่อ sizeMode = 'manual') */
  B: number;
  L: number;
  t: number;
  cover: number;

  /** ความลึกจากผิวดินถึงท้องฐานราก (ม.) */
  Df: number;
  /** กำลังรับน้ำหนักบรรทุกที่ยอมให้ของดิน (t/m²) — เทียบกับแรงดันรวมน้ำหนักฐานรากและดินถม */
  qa: number;
  gammaSoil: number;

  fc: number;
  fy: number;

  P: number;
  Mx: number;
  My: number;

  bar: BarName;
}

export interface FootingDims {
  B: number;
  L: number;
  t: number;
}

export interface BarSet {
  size: BarName;
  count: number;
}

export interface FootingLayout {
  x: BarSet;
  y: BarSet;
  /** ทิศของเหล็กชั้นล่างสุด */
  bottom: BarDir;
}
