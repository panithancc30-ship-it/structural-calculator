import { ACI318_WSD as C, ACI318_WSD_COLUMN as KC, ACI318_WSD_FOOTING as KF, ACI318_WSD_PILECAP as K } from '../codes/aci318Wsd';
import { asMinRatio } from '../footing/analyzeFooting';
import type { Pt } from '../footing/polygon';
import { cmToM } from '../format';
import { MAIN_BAR_SIZES, REBARS, STIRRUP_BAR_SIZES, type BarName } from '../rebar';
import type { PileCapCage, PileCapDims, PileCapInput } from './types';

/** fy ของปลอก: เหล็กกลมใช้ SR24 */
const tieFy = (tie: BarName, fy: number) => (REBARS[tie].kind === 'RB' ? 2400 : fy);

export interface CageAnalysis extends PileCapCage {
  count: number;
  db: number;
  dt: number;
  /** ระยะผิวฐานถึงศูนย์เหล็กยืน */
  inset: number;
  /** เหล็กต่อด้าน (รวมมุม) */
  perSide: number;
  /** ปลอกต่อชั้น: 2 = รอบนอก + ข้าวหลามตัด, 1 = รอบนอกอย่างเดียว (เหล็กยืน 4 เส้น) */
  ties: number;
  /** ศูนย์เหล็กยืนในแปลน (มุม + เรียงเท่ากันทุกด้าน) ศูนย์ฐานที่จุดกำเนิด */
  bars: Pt[];
  rho: number;
  AsV: number;
  AsVReq: number;
  /** ระยะเรียงเหล็กยืนตามผิว — ด้านยาว */
  pitch: number;
  sMax: number;
  clear: number;
  clearReq: number;
  /** ระดับศูนย์ปลอกแต่ละชั้นจากท้องฐาน */
  tieZ: number[];
  rhoTie: number;
  /** As ปลอกที่ตัดผ่านระนาบตั้งฉากทิศ x (ต้านแรงดึงตาม x) และทิศ y */
  AsTie: number;
  AsTieReq: number;
  tieSMax: number;
  /** ความลึกคอนกรีตเหนือหัวเข็ม */
  depthAbovePile: number;
}

type CageInput = Pick<PileCapInput, 'cover' | 'fy' | 'embedSingle'>;

/** จำนวนเหล็กยืน → เส้นต่อด้าน (ปัดเป็นทวีคูณของ 4 ในช่วงที่รองรับ) */
export function cageBarCount(cage: Pick<PileCapCage, 'count'>): number {
  const n = Math.round((cage.count ?? K.cageBars) / 4) * 4;
  return Math.min(K.cageMaxBars, Math.max(K.cageMinBars, n));
}

/** ปลอก: "2ป RB9 @0.10" (รอบนอก + ข้าวหลามตัด) หรือ "1ป …" เมื่อมีเหล็กยืนแค่ที่มุม */
export const cageTieText = (c: PileCapCage) => `${cageBarCount(c) > 4 ? 2 : 1}ป ${c.tie} @${cmToM(c.tieSpacing)}`;

export function analyzeCage(input: CageInput, dims: PileCapDims, cage: PileCapCage): CageAnalysis {
  const { B, L, t } = dims;
  const db = REBARS[cage.size].dia;
  const dt = REBARS[cage.tie].dia;
  const inset = input.cover + dt + db / 2;
  const ax = B / 2 - inset;
  const ay = L / 2 - inset;
  const count = cageBarCount(cage);
  const perSide = count / 4 + 1;
  const at = (a: number, i: number) => -a + (2 * a * i) / (perSide - 1);
  // เรียงรอบฐาน: ด้านล่าง (ซ้าย → ขวา) ด้านขวา ด้านบน (ขวา → ซ้าย) ด้านซ้าย ไม่ซ้ำมุม
  const bars: Pt[] = [];
  for (let i = 0; i < perSide - 1; i++) bars.push({ x: at(ax, i), y: -ay });
  for (let i = 0; i < perSide - 1; i++) bars.push({ x: ax, y: at(ay, i) });
  for (let i = 0; i < perSide - 1; i++) bars.push({ x: -at(ax, i), y: ay });
  for (let i = 0; i < perSide - 1; i++) bars.push({ x: -ax, y: -at(ay, i) });
  const ties = count > 4 ? 2 : 1;
  const rho = asMinRatio(input.fy);
  // ปลอกอยู่ระหว่างขาล่างของเหล็กยืน (ท้องฐาน) กับขอฉากที่ผิวบน เรียงเท่ากันกึ่งกลางความหนา
  const z1 = input.cover + db + dt / 2;
  const z2 = t - input.cover - db - dt / 2;
  const layers = z2 > z1 ? Math.floor((z2 - z1) / cage.tieSpacing + 1e-9) + 1 : 1;
  const start = (z1 + z2) / 2 - ((layers - 1) * cage.tieSpacing) / 2;
  const tieZ = Array.from({ length: layers }, (_, i) => start + i * cage.tieSpacing);
  const rhoTie = asMinRatio(tieFy(cage.tie, input.fy));
  return {
    ...cage,
    count,
    perSide,
    ties,
    db,
    dt,
    inset,
    bars,
    rho,
    AsV: count * REBARS[cage.size].area,
    AsVReq: rho * B * L,
    pitch: (2 * Math.max(ax, ay)) / (perSide - 1),
    sMax: Math.min(KF.maxSpacingFactor * t, KF.maxSpacing),
    clear: (2 * Math.min(ax, ay)) / (perSide - 1) - db,
    clearReq: Math.max(db, C.minClearSpacing),
    tieZ,
    rhoTie,
    AsTie: layers * (ties === 2 ? K.cageTieLegs : 2) * REBARS[cage.tie].area,
    AsTieReq: rhoTie * Math.max(B, L) * t,
    tieSMax: Math.min(KC.tieSpacingDb * db, KC.tieSpacingDt * dt, Math.min(B, L)),
    depthAbovePile: t - input.embedSingle,
  };
}

const verticalOk = (c: CageAnalysis) => c.AsV >= c.AsVReq * (1 - 1e-6) && c.clear >= c.clearReq - 1e-9 && c.pitch <= c.sMax + 1e-9;
const tieOk = (c: CageAnalysis) => c.AsTie >= c.AsTieReq * (1 - 1e-6) && c.tieSpacing <= c.tieSMax + 1e-9;

const TIE_SPACINGS = [K.cageTieSpacing, 7.5, 5];

/**
 * เหล็กยืน: 8 เส้นตามแบบมาตรฐาน — ฐานใหญ่จนระยะเรียงเกินเพิ่มทีละ 4 เส้น; ขนาดเริ่มจากที่ผู้ใช้ต้องการ ขยับขึ้นจน As ≥ ρ·Bx·By
 * ปลอก: เริ่ม RB9 @0.10 ตามแบบมาตรฐาน ลดระยะเรียงแล้วจึงเพิ่มขนาดจน As ปลอกพอ — ไม่พบใช้ค่าตั้งต้น
 */
export function autoCage(input: CageInput & Pick<PileCapInput, 'bar'>, dims: PileCapDims): PileCapCage {
  const start = Math.max(0, MAIN_BAR_SIZES.indexOf(input.bar));
  const sizes = [...MAIN_BAR_SIZES.slice(start), ...MAIN_BAR_SIZES.slice(0, start).reverse()];
  const base: PileCapCage = { size: sizes[0], count: K.cageBars, tie: K.cageTie, tieSpacing: K.cageTieSpacing };
  const counts = Array.from({ length: (K.cageMaxBars - K.cageBars) / 4 + 1 }, (_, i) => K.cageBars + 4 * i);
  const vertical =
    counts.flatMap((count) => sizes.map((size) => ({ ...base, size, count }))).find((c) => verticalOk(analyzeCage(input, dims, c))) ?? base;
  const ties = STIRRUP_BAR_SIZES.slice(STIRRUP_BAR_SIZES.indexOf(K.cageTie)).flatMap((tie) => TIE_SPACINGS.map((tieSpacing) => ({ ...vertical, tie, tieSpacing })));
  return ties.find((c) => tieOk(analyzeCage(input, dims, c))) ?? vertical;
}
