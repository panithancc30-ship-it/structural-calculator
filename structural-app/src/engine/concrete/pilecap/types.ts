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
  projectName: string;
  capName: string;
  designer: string;

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

  thicknessMode: AutoMode;
  t: number;
  cover: number;
  /** ระยะหัวเข็มฝังในฐานราก */
  embed: number;

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
