import { ACI318_WSD_LEDGE as K } from '../codes/aci318Wsd';
import { REBARS } from '../rebar';
import type { LedgeBeamInput } from './types';

/** น้ำหนักคอนกรีต กก./ม.³ */
const UNIT_WEIGHT = K.concreteUnitWeight * 1000;

export interface LedgeLoads {
  /** น้ำหนักบนพื้นยื่น (กก./ตร.ม.) — ตัวพื้น, คงที่รวมปูผิว, จร, รวม */
  slabSelf: number;
  slabDead: number;
  slabLive: number;
  slabTotal: number;

  /** น้ำหนักลงคานแยกตามที่มา (กก./ม.) */
  fromSlab: number;
  tipWall: number;
  beamWall: number;
  beamSelf: number;
  other: number;
  /** น้ำหนักลงคานรวม (กก./ม.) */
  w: number;
  /** ส่วนน้ำหนักจรของ w (กก./ม.) — ใช้ตรวจเงื่อนไขสัมประสิทธิ์โมเมนต์ */
  wLive: number;

  /** แรงบิดต่อความยาวคาน (กก.·ม./ม.) จากพื้นยื่นและผนังที่ปลาย */
  torqueSlab: number;
  torqueWall: number;
  torque: number;

  divisors: { pos: number; neg: number | null };
  shearFactor: number;
  /** โมเมนต์ (กก.·ม.) */
  Mpos: number;
  Mneg: number;

  /** ความลึกประสิทธิผลโดยประมาณ ใช้หาตำแหน่งหน้าตัดวิกฤต (ซม.) */
  dCrit: number;
  /** แรงเฉือน (กก.) และแรงบิด (กก.·ม.) ที่ที่รองรับ และที่หน้าตัดวิกฤต (ห่าง d) */
  Vsupport: number;
  Tsupport: number;
  Vd: number;
  Td: number;
}

/** d โดยประมาณ = h − ระยะหุ้ม − Ø ปลอก − Ø เหล็กยืน/2 (เหล็กชั้นเดียว) */
export function criticalDepth(input: Pick<LedgeBeamInput, 'h' | 'cover' | 'stirrupBar' | 'mainBar'>): number {
  return input.h - input.cover - REBARS[input.stirrupBar].dia - REBARS[input.mainBar].dia / 2;
}

/**
 * น้ำหนักลงคานและแรงภายในของคานรับพื้นยื่น
 *
 * พื้นยื่นยาว Lc วัดจากศูนย์กลางคาน → ลงคาน w·Lc และบิดคาน w·Lc²/2 ต่อความยาว
 * ผนังที่ปลายพื้นยื่นอยู่ห่างศูนย์กลางคาน Lc → บิดคาน P·Lc
 * ปลายคานยึดไม่ให้บิด → T ที่ปลาย = t·L/2 ลดลงเป็นเส้นตรงถึงศูนย์ที่กลางช่วง
 */
export function ledgeLoads(input: LedgeBeamInput): LedgeLoads {
  const Lc = input.slabLength;
  const L = input.L;

  const slabSelf = (input.slabT / 100) * UNIT_WEIGHT;
  const slabDead = slabSelf + input.finishDL;
  const slabLive = input.LL;
  const slabTotal = slabDead + slabLive;

  const fromSlab = slabTotal * Lc;
  const tipWall = input.tipWallH * input.tipWallW;
  const beamWall = input.beamWallH * input.beamWallW;
  const beamSelf = (input.b / 100) * (input.h / 100) * UNIT_WEIGHT;
  const other = input.otherLoad;
  const w = fromSlab + tipWall + beamWall + beamSelf + other;

  const torqueSlab = (slabTotal * Lc * Lc) / 2;
  const torqueWall = tipWall * Lc;
  const torque = torqueSlab + torqueWall;

  const divisors = K.momentDivisors[input.support];
  const shearFactor = K.shearFactor[input.support];
  const Mpos = (w * L * L) / divisors.pos;
  const Mneg = divisors.neg === null ? 0 : (w * L * L) / divisors.neg;

  const dCrit = criticalDepth(input);
  const x = dCrit / 100;
  const Vsupport = shearFactor * w * L;
  const Tsupport = (torque * L) / 2;

  return {
    slabSelf, slabDead, slabLive, slabTotal,
    fromSlab, tipWall, beamWall, beamSelf, other, w,
    wLive: slabLive * Lc,
    torqueSlab, torqueWall, torque,
    divisors, shearFactor, Mpos, Mneg,
    dCrit,
    Vsupport,
    Tsupport,
    Vd: Math.max(0, Vsupport - w * x),
    Td: Math.max(0, torque * (L / 2 - x)),
  };
}
