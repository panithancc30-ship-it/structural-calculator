import type { BarName } from '../rebar';
import type { Bar } from '../types';

export type ColumnShape = 'rect' | 'circle';

/**
 * ข้อมูลนำเข้าเสา — หน่วย: ขนาด ซม., Lu ม., หน่วยแรง ksc, P kg, Mx/My kg·m
 * แกน x ตามด้าน b, แกน y ตามด้าน h — Mx ดัดรอบแกน x (ด้าน h รับอัด/ดึง), My ดัดรอบแกน y
 */
export interface ColumnInput {
  projectName: string;
  columnName: string;
  designer: string;

  shape: ColumnShape;
  b: number;
  h: number;
  D: number;
  cover: number;

  /** ความสูงเสาที่ไม่มีการค้ำยัน (ม.) — k, M1/M2, βd กำหนดอัตโนมัติใน ACI318_WSD_COLUMN */
  Lu: number;

  fc: number;
  fy: number;
  fyv: number;

  P: number;
  Mx: number;
  My: number;

  mainBar: BarName;
  tieBar: BarName;
}

export interface TransverseSpec {
  size: BarName;
  /** ระยะปลอก (สี่เหลี่ยม) หรือระยะเกลียว pitch (กลม) — ซม. */
  spacing: number;
}

export type RectFace = 'top' | 'bottom' | 'left' | 'right';

export interface RectColumnLayout {
  kind: 'rect';
  /** มุม: บนซ้าย, บนขวา, ล่างขวา, ล่างซ้าย */
  corners: Bar[];
  top: Bar[];
  bottom: Bar[];
  left: Bar[];
  right: Bar[];
  tie: TransverseSpec;
}

export interface CircleColumnLayout {
  kind: 'circle';
  bars: Bar[];
  tie: TransverseSpec;
}

export type ColumnLayout = RectColumnLayout | CircleColumnLayout;

export type ColumnFace = 'corner' | RectFace | 'ring';
