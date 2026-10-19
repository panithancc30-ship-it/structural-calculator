import type { FootingLayout } from '../footing/types';
import type { BarName } from '../rebar';

export type PileShape = 'square' | 'circle';
export type AutoMode = 'auto' | 'manual';

/** ระยะเยื้องของเสาเข็มแต่ละต้นจากตำแหน่งในแบบ (หลังตอกจริง) */
export interface PileOffset {
  dx: number;
  dy: number;
}

/**
 * ข้อมูลนำเข้าฐานรากเสาเข็ม — หน่วย: ขนาด ซม., Df ม., γs t/m³, หน่วยแรง ksc, P kg, Mx/My kg·m, Pa/Ta ตัน/ต้น
 * พิกัดจุดกำเนิดที่ศูนย์ฐานราก แกน x ตามด้าน Bx (ขวา +), แกน y ตามด้าน By (บน +)
 * My บวก → เข็มด้าน +x รับแรงมากขึ้น, Mx บวก → เข็มด้าน +y รับแรงมากขึ้น
 */
export interface PileCapInput {
  /** ชื่อชิ้นส่วนในหัวรูป — ตั้งจากชื่อรายการ ไม่ได้กรอกเอง */
  capName: string;

  /** ขนาดเสา/ตอม่อ ตามแกน x และ y */
  cx: number;
  cy: number;
  /** ระยะศูนย์เสาจากศูนย์ถ่วงกลุ่มเสาเข็ม (ตามแบบ) — เยื้องศูนย์ */
  ex: number;
  ey: number;

  pileShape: PileShape;
  /** ด้าน (สี่เหลี่ยม) หรือเส้นผ่านศูนย์กลาง (กลม) */
  pileSize: number;
  /** น้ำหนักบรรทุกปลอดภัยของเสาเข็ม (ตัน/ต้น) */
  pileCapacity: number;
  /** แรงถอนที่ยอมให้ (ตัน/ต้น) — 0 = ไม่ยอมให้เกิดแรงถอน */
  pileTension: number;

  countMode: AutoMode;
  pileCount: number;
  /** หมุนรูปแบบเข็ม 90° (เข็มแถวเดียว / สามเหลี่ยม / แถวยาว) */
  rotate: boolean;
  /** ระยะห่างเสาเข็มศูนย์ถึงศูนย์ */
  spacing: number;
  /** ระยะศูนย์เสาเข็มถึงขอบฐานราก */
  edge: number;
  /** ระยะเยื้องเข็มหลังตอก เรียงตามหมายเลขเข็ม (เก็บครบ 9 ต้น) */
  offsets: PileOffset[];

  /** ขนาดแปลน: อัตโนมัติ = กรอบเข็ม + ระยะขอบ, กำหนดเอง = Bx × By ที่กรอก */
  sizeMode: AutoMode;
  B: number;
  L: number;
  thicknessMode: AutoMode;
  t: number;
  cover: number;
  /** ระยะหัวเข็มฝังในฐานราก (เข็มกลุ่ม — เหล็กล่างวางเหนือหัวเข็ม) */
  embed: number;
  /** ระยะหัวเข็มฝังในฐานราก (เข็มต้นเดียว — หัวเข็มอยู่ในกรงเหล็กยืน) */
  embedSingle: number;
  /** ความหนาคอนกรีตหยาบ 1:3:5 และทรายรองพื้นใต้ฐานราก (ใช้เขียนแบบ) */
  lean: number;
  sand: number;

  /** ความลึกจากผิวดินถึงท้องฐานราก (ม.) */
  Df: number;
  gammaSoil: number;

  fc: number;
  fy: number;

  P: number;
  Mx: number;
  My: number;

  bar: BarName;
}

export interface PileArrangement {
  count: number;
  rotate: boolean;
}

export interface PileCapDims {
  /** ด้านตามแกน x (Bx) */
  B: number;
  /** ด้านตามแกน y (By) */
  L: number;
  t: number;
}

/**
 * เหล็กเสริมฐานรากเข็มต้นเดียวตามแบบมาตรฐาน: เหล็กยืนรอบฐาน (มุม 4 + เรียงเท่ากันทุกด้าน) งอเป็นรูปตัว U
 * ผ่านท้องฐาน งอฉากที่ผิวบน และปลอก 2 ชุดต่อชั้น (ปลอกรอบนอก + ปลอกข้าวหลามตัดยึดเหล็กกลางด้าน)
 */
export interface PileCapCage {
  size: BarName;
  /** จำนวนเหล็กยืนทั้งหมด = 4·(เส้นต่อด้าน − 1) เช่น 8, 12, 16 — ไม่มีค่า = 8 (ไฟล์เก่า) */
  count?: number;
  tie: BarName;
  /** ระยะเรียงปลอก (ซม.) */
  tieSpacing: number;
}

export interface PileCapLayout extends FootingLayout {
  /** เข็มต้นเดียวเท่านั้น — ไม่มีค่า = ใช้เหล็กตะแกรง/ตะกร้อ x, y ตามเดิม */
  cage?: PileCapCage;
}
