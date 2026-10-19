import { ACI318_WSD as C, ACI318_WSD_COLUMN as KC, ACI318_WSD_FOOTING as KF, ACI318_WSD_PILECAP as K } from '../codes/aci318Wsd';
import { asMinRatio } from '../footing/analyzeFooting';
import type { Pt } from '../footing/polygon';
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
  /** ศูนย์เหล็กยืนในแปลน (มุม 4 + กลางด้าน 4) ศูนย์ฐานที่จุดกำเนิด */
  bars: Pt[];
  rho: number;
  AsV: number;
  AsVReq: number;
  /** ระยะเรียงเหล็กยืนตามผิว (มุมถึงกลางด้าน) — ด้านยาว */
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

export function analyzeCage(input: CageInput, dims: PileCapDims, cage: PileCapCage): CageAnalysis {
  const { B, L, t } = dims;
  const db = REBARS[cage.size].dia;
  const dt = REBARS[cage.tie].dia;
  const inset = input.cover + dt + db / 2;
  const ax = B / 2 - inset;
  const ay = L / 2 - inset;
  const bars = [
    { x: -ax, y: -ay }, { x: 0, y: -ay }, { x: ax, y: -ay }, { x: ax, y: 0 },
    { x: ax, y: ay }, { x: 0, y: ay }, { x: -ax, y: ay }, { x: -ax, y: 0 },
  ];
  const count = K.cageBars;
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
    db,
    dt,
    inset,
    bars,
    rho,
    AsV: count * REBARS[cage.size].area,
    AsVReq: rho * B * L,
    pitch: Math.max(ax, ay),
    sMax: Math.min(KF.maxSpacingFactor * t, KF.maxSpacing),
    clear: Math.min(ax, ay) - db,
    clearReq: Math.max(db, C.minClearSpacing),
    tieZ,
    rhoTie,
    AsTie: layers * K.cageTieLegs * REBARS[cage.tie].area,
    AsTieReq: rhoTie * Math.max(B, L) * t,
    tieSMax: Math.min(KC.tieSpacingDb * db, KC.tieSpacingDt * dt, Math.min(B, L)),
    depthAbovePile: t - input.embedSingle,
  };
}

const verticalOk = (c: CageAnalysis) => c.AsV >= c.AsVReq * (1 - 1e-6) && c.clear >= c.clearReq - 1e-9;
const tieOk = (c: CageAnalysis) => c.AsTie >= c.AsTieReq * (1 - 1e-6) && c.tieSpacing <= c.tieSMax + 1e-9;

const TIE_SPACINGS = [K.cageTieSpacing, 7.5, 5];

/**
 * เหล็กยืน: เริ่มจากขนาดที่ผู้ใช้ต้องการ ขยับขึ้นจน As ≥ ρ·Bx·By
 * ปลอก: เริ่ม RB9 @0.10 ตามแบบมาตรฐาน ลดระยะเรียงแล้วจึงเพิ่มขนาดจน As ปลอกพอ — ไม่พบใช้ค่าตั้งต้น
 */
export function autoCage(input: CageInput & Pick<PileCapInput, 'bar'>, dims: PileCapDims): PileCapCage {
  const start = Math.max(0, MAIN_BAR_SIZES.indexOf(input.bar));
  const sizes = [...MAIN_BAR_SIZES.slice(start), ...MAIN_BAR_SIZES.slice(0, start).reverse()];
  const base: PileCapCage = { size: sizes[0], tie: K.cageTie, tieSpacing: K.cageTieSpacing };
  const size = sizes.find((s) => verticalOk(analyzeCage(input, dims, { ...base, size: s }))) ?? base.size;
  const ties = STIRRUP_BAR_SIZES.slice(STIRRUP_BAR_SIZES.indexOf(K.cageTie)).flatMap((tie) => TIE_SPACINGS.map((tieSpacing) => ({ size, tie, tieSpacing })));
  return ties.find((c) => tieOk(analyzeCage(input, dims, c))) ?? { ...base, size };
}
