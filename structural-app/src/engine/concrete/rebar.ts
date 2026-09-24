/** ฐานข้อมูลเหล็กเสริมที่หาได้ในประเทศไทย (มอก. 20 เหล็กเส้นกลม, มอก. 24 เหล็กข้ออ้อย) */

export type BarName = 'RB6' | 'RB9' | 'DB10' | 'DB12' | 'DB16' | 'DB20' | 'DB25' | 'DB28' | 'DB32';

export interface RebarSpec {
  name: BarName;
  kind: 'RB' | 'DB';
  /** เส้นผ่านศูนย์กลาง (ซม.) */
  dia: number;
  /** พื้นที่หน้าตัด (ซม.²) */
  area: number;
  /** น้ำหนัก (กก./ม.) */
  weight: number;
}

function spec(name: BarName, mm: number): RebarSpec {
  const dia = mm / 10;
  return {
    name,
    kind: name.startsWith('RB') ? 'RB' : 'DB',
    dia,
    area: (Math.PI * dia * dia) / 4,
    weight: (mm * mm) / 162.2,
  };
}

export const REBARS: Record<BarName, RebarSpec> = {
  RB6: spec('RB6', 6),
  RB9: spec('RB9', 9),
  DB10: spec('DB10', 10),
  DB12: spec('DB12', 12),
  DB16: spec('DB16', 16),
  DB20: spec('DB20', 20),
  DB25: spec('DB25', 25),
  DB28: spec('DB28', 28),
  DB32: spec('DB32', 32),
};

/** เหล็กทุกขนาดที่โปรแกรมรู้จัก เรียงจากเล็กไปใหญ่ — พื้นเลือกได้ทั้ง RB และ DB */
export const ALL_BAR_SIZES: BarName[] = Object.keys(REBARS) as BarName[];

export const MAIN_BAR_SIZES: BarName[] = ['DB10', 'DB12', 'DB16', 'DB20', 'DB25', 'DB28', 'DB32'];
export const STIRRUP_BAR_SIZES: BarName[] = ['RB6', 'RB9', 'DB10', 'DB12'];

export function isBarName(value: unknown): value is BarName {
  return typeof value === 'string' && value in REBARS;
}

export interface SteelGrade {
  name: string;
  fy: number;
  kind: 'RB' | 'DB';
}

/** ชั้นคุณภาพเหล็กตาม มอก. (fy หน่วย ksc) */
export const STEEL_GRADES: SteelGrade[] = [
  { name: 'SR24', fy: 2400, kind: 'RB' },
  { name: 'SD30', fy: 3000, kind: 'DB' },
  { name: 'SD40', fy: 4000, kind: 'DB' },
  { name: 'SD50', fy: 5000, kind: 'DB' },
];
