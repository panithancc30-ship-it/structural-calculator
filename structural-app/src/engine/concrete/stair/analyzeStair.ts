import { ACI318_WSD as C, ACI318_WSD_SLAB as KS, ACI318_WSD_STAIR as K } from '../codes/aci318Wsd';
import { wsdParams, type WsdParams } from '../design/flexure';
import { worstStatus } from '../design/sectionCheck';
import { asMinRatio } from '../footing/analyzeFooting';
import { cmToM, fmt } from '../format';
import { REBARS } from '../rebar';
import type { BarRun } from '../slab/types';
import type { CalcStep, CheckItem, CheckStatus } from '../types';
import { degrees, stairProfile, stairSupport, type StairProfile } from './geometry';
import { endReaction, stairLoads, stairMoments, type StairLoads, type StairMoments } from './loads';
import type { StairBarKey, StairDims, StairInput, StairLayout, StairUsage } from './types';

export const USAGE_TH: Record<StairUsage, string> = {
  residential: 'อาคารอยู่อาศัย',
  public: 'อาคารสาธารณะ',
};

export const STAIR_BAR_TH: Record<StairBarKey, string> = {
  bottom: 'เหล็กล่าง',
  topLow: 'เหล็กบนปลายล่าง',
  topHigh: 'เหล็กบนปลายบน',
  dist: 'เหล็กกระจาย',
  step: 'เหล็กขั้นบันได',
};

/** ความหนาขั้นต่ำที่ควบคุมการโก่งตัว */
export interface MinThickness {
  required: number;
  /** ที่มาของค่า ใช้พิมพ์ลงรายการคำนวณ */
  label: string;
}

/**
 * ใช้แถวพื้นทางเดียวตันของ ACI Table 9.5(a) กับช่วงราบ L ระหว่างศูนย์กลางที่รองรับ
 * ขั้นบันไดช่วยให้แผ่นแข็งขึ้นแต่ไม่ได้นับ จึงเป็นค่าปลอดภัยไว้ก่อน
 */
export function minThickness(input: StairInput): MinThickness {
  const { L } = stairProfile(input);
  const support = stairSupport(input.endLow, input.endHigh);
  const divisor = KS.minThicknessDivisor[support];
  const factor = 0.4 + input.fy / C.minDepthFyDivisor;
  const required = Math.max(K.absMinThickness, (L / divisor) * factor);
  return { required, label: `L/${divisor} × (0.4 + fy/${C.minDepthFyDivisor.toLocaleString('en-US')})` };
}

export interface StairBarDemand {
  /** โมเมนต์ออกแบบของเหล็กชุดนี้ (kg·cm ต่อแถบกว้าง 1 ม.) — 0 = เหล็กกระจายหรือเหล็กตามแบบ */
  Mdesign: number;
  d: number;
  db: number;
  Mc: number;
  AsFlex: number;
  AsMin: number;
  AsReq: number;
  AsProv: number;
  spacing: number | null;
  sMax: number;
  clear: number;
  clearReq: number;
}

export interface StairAnalysis {
  input: StairInput;
  dims: StairDims;
  params: WsdParams;
  profile: StairProfile;
  loads: StairLoads;
  moments: StairMoments;
  hMin: MinThickness;
  bars: Record<StairBarKey, StairBarDemand>;
  /** แรงเฉือนออกแบบ หน่วยแรงเฉือน และหน่วยแรงเฉือนยอมให้ */
  V: number;
  v: number;
  vc: number;
  /** ปฏิกิริยาที่ถ่ายลงคานรองรับแต่ละปลาย (กก./ม.) */
  reactions: { low: number; high: number };
  checks: CheckItem[];
  steps: CalcStep[];
  status: CheckStatus;
}

const STRIP = 100;

const diaOf = (run: BarRun | null, fallback = 0) => (run ? REBARS[run.size].dia : fallback);

function barDemand(
  input: StairInput,
  p: WsdParams,
  t: number,
  run: BarRun | null,
  Mdesign: number,
  /** เส้นผ่านศูนย์กลางของเหล็กที่วางชิดผิวคอนกรีตกว่า (เหล็กกระจายวางถัดจากเหล็กหลัก) */
  behind: number,
  kind: 'main' | 'temp' | 'nominal',
): StairBarDemand {
  const db = diaOf(run);
  const d = t - input.cover - behind - db / 2;
  // As ต่ำสุดของแผ่นพื้นคือเหล็กกันร้าวคิดเต็มความหนา (7.12) เหมือนโมดูลพื้น
  const AsMin = kind === 'nominal' ? 0 : asMinRatio(input.fy) * STRIP * t;
  const AsFlex = Mdesign > 0 ? (d > 0 ? Mdesign / (p.fsAllow * p.j * d) : Infinity) : 0;
  const AsReq = Math.max(AsFlex, AsMin);
  const AsProv = run ? (STRIP / run.spacing) * REBARS[run.size].area : 0;
  const sMax = Math.min((kind === 'main' ? KS.maxSpacingFactor : KS.tempSpacingFactor) * t, KS.maxSpacing);
  return {
    Mdesign, d, db,
    Mc: p.R * STRIP * d * d,
    AsFlex, AsMin, AsReq, AsProv,
    spacing: run ? run.spacing : null,
    sMax,
    clear: run ? run.spacing - db : 0,
    clearReq: Math.max(db, C.minClearSpacing),
  };
}

export function analyzeStair(input: StairInput, dims: StairDims, layout: StairLayout): StairAnalysis {
  const { t } = dims;
  const p = wsdParams(input.fc, input.fy, input.fy);
  const profile = stairProfile(input);
  const loads = stairLoads(input, t);
  const moments = stairMoments(loads.wEq, profile.L, input.endLow, input.endHigh);
  const hMin = minThickness(input);

  const bars: Record<StairBarKey, StairBarDemand> = {
    bottom: barDemand(input, p, t, layout.bottom, moments.pos, 0, 'main'),
    topLow: barDemand(input, p, t, layout.topLow, moments.negLow, 0, 'main'),
    topHigh: barDemand(input, p, t, layout.topHigh, moments.negHigh, 0, 'main'),
    dist: barDemand(input, p, t, layout.dist, 0, diaOf(layout.bottom), 'temp'),
    step: barDemand(input, p, t, layout.step, 0, 0, 'nominal'),
  };

  const reactions = {
    low: endReaction(loads.statics.Rlow, input.endLow),
    high: endReaction(loads.statics.Rhigh, input.endHigh),
  };
  const V = Math.max(reactions.low, reactions.high);
  const dForShear = Math.max(bars.bottom.d, bars.topLow.d, bars.topHigh.d);
  const v = dForShear > 0 ? V / (STRIP * dForShear) : Infinity;
  const vc = KS.oneWayVcCoef * Math.sqrt(input.fc);

  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, provided: string, status: CheckStatus) =>
    checks.push({ id: `ST-${checks.length}`, group, label, required, provided, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);
  const tm = (kgcm: number) => fmt(kgcm / 100 / 1000, 3);
  const m2 = (cm: number) => fmt(cm / 100, 2);

  // ---------- 1. ขนาดขั้นบันได — เกณฑ์ใช้งาน ไม่ผ่านเป็นคำเตือน ----------
  const use = input.usage;
  const stride = 2 * input.riser + input.tread;
  push('geometry', `ลูกตั้ง R — ${USAGE_TH[use]} (ซม.)`, `≤ ${fmt(K.riserMax[use], 1)}`, fmt(input.riser, 1),
    okIf(input.riser <= K.riserMax[use] + 1e-9, 'warn'));
  push('geometry', `ลูกนอน T — ${USAGE_TH[use]} (ซม.)`, `≥ ${fmt(K.treadMin[use], 1)}`, fmt(input.tread, 1),
    okIf(input.tread >= K.treadMin[use] - 1e-9, 'warn'));
  push('geometry', 'ความสูงช่วงบันได N·R (ม.)', `≤ ${m2(K.flightRiseMax[use])}`, m2(profile.rise),
    okIf(profile.rise <= K.flightRiseMax[use] + 1e-9, 'warn'));
  push('geometry', 'ความกว้างบันได (ม.)', `≥ ${m2(K.widthMin[use])}`, m2(input.width),
    okIf(input.width >= K.widthMin[use] - 1e-9, 'warn'));
  push('geometry', 'ระยะก้าว 2R + T (ซม.)', `${K.strideMin} – ${K.strideMax}`, fmt(stride, 1),
    okIf(stride >= K.strideMin - 1e-9 && stride <= K.strideMax + 1e-9, 'warn'));

  // ---------- 2. การโก่งตัว / ความหนา ----------
  push('deflection', `ความหนาท้องบันได h — ${hMin.label} (ซม.)`, `≥ ${fmt(hMin.required, 1)}`, fmt(t, 1),
    okIf(t + 1e-9 >= hMin.required, 'warn'));

  // ---------- 3. ดัดและเหล็กเสริม ----------
  push('flexure', `น้ำหนักจร ≤ ${KS.liveToDeadLimit}×น้ำหนักคงที่ (เงื่อนไขใช้สัมประสิทธิ์ 8.3.3)`,
    `≤ ${fmt(KS.liveToDeadLimit * loads.deadFlight, 0)} กก./ตร.ม.`, fmt(loads.live, 0),
    okIf(loads.live <= KS.liveToDeadLimit * loads.deadFlight + 1e-9, 'warn'));

  const flexural: Array<[StairBarKey, string]> = [
    ['bottom', 'M+ กลางช่วง'],
    ['topLow', 'M− ปลายล่าง'],
    ['topHigh', 'M− ปลายบน'],
  ];
  for (const [key, label] of flexural) {
    const b = bars[key];
    push('flexure', `${label} ≤ R·b·d² (t·m/ม.)`, `≤ ${tm(b.Mc)}`, tm(b.Mdesign), okIf(b.Mdesign <= b.Mc * (1 + 1e-6)));
  }
  for (const key of ['bottom', 'topLow', 'topHigh', 'dist'] as StairBarKey[]) {
    const b = bars[key];
    push('flexure', `As ${STAIR_BAR_TH[key]} (ซม.²/ม.)`, `≥ ${fmt(b.AsReq)}`, fmt(b.AsProv),
      okIf(b.AsProv >= b.AsReq * (1 - 1e-6)));
  }

  // ---------- 4. เฉือนทางเดียว ----------
  push('oneWay', 'v ที่ปลายรองรับ (ksc)', `≤ ${fmt(vc)}`, fmt(v), okIf(v <= vc * (1 + 1e-6)));

  // ---------- 5. การจัดเหล็ก ----------
  const depths = (['bottom', 'topLow', 'topHigh'] as StairBarKey[]).filter((k) => layout[k]).map((k) => bars[k].d);
  if (depths.length > 0) {
    const dMin = Math.min(...depths);
    push('detail', 'ความลึกประสิทธิผล d (ซม.)', `≥ ${fmt(KS.minEffectiveDepth, 1)}`, fmt(dMin, 1),
      okIf(dMin >= KS.minEffectiveDepth - 1e-9));
  }
  push('detail', 'ระยะหุ้มคอนกรีต (ซม.)', `≥ ${fmt(KS.cover, 1)}`, fmt(input.cover, 1),
    okIf(input.cover >= KS.cover - 1e-9));
  const placedBars = (['bottom', 'topLow', 'topHigh', 'dist'] as StairBarKey[]).filter((k) => bars[k].spacing !== null);
  for (const key of placedBars) {
    const b = bars[key];
    push('detail', `ระยะเรียง${STAIR_BAR_TH[key]} (ซม.)`, `≤ ${fmt(b.sMax, 1)}`, fmt(b.spacing!, 1),
      okIf(b.spacing! <= b.sMax + 1e-9));
  }
  // ช่องว่างระหว่างเหล็กรวมเป็นแถวเดียว — ทุกชุดใช้เกณฑ์ max(db, 2.5 ซม.) และมักห่างเกินเกณฑ์มาก
  // รายงานชุดที่วิกฤตที่สุด (ช่องว่างเทียบเกณฑ์น้อยที่สุด) เพื่อให้หน้ารายงานพอดีหนึ่งหน้า
  if (placedBars.length > 0) {
    const worst = placedBars
      .map((k) => bars[k])
      .reduce((w, b) => (b.clear - b.clearReq < w.clear - w.clearReq ? b : w));
    push('detail', 'ช่องว่างระหว่างเหล็ก ชุดที่แคบสุด (ซม.)', `≥ ${fmt(worst.clearReq, 1)}`, fmt(worst.clear, 1),
      okIf(worst.clear >= worst.clearReq - 1e-9));
  }

  // ---------- ขั้นตอนคำนวณ ----------
  const { statics } = loads;
  const anyContinuous = input.endLow === 'continuous' || input.endHigh === 'continuous';
  const steps: CalcStep[] = [
    {
      label: 'มุมลาด θ',
      formula: `tan⁻¹(R/T) = tan⁻¹(${fmt(input.riser, 1)}/${fmt(input.tread, 1)})`,
      value: `${fmt(degrees(profile.theta), 1)}° (cos θ = ${fmt(profile.cos, 3)})`,
      print: true,
    },
    {
      label: 'ช่วงราบ L',
      formula: `${m2(input.landingLow)} + ${input.risers - 1}×${m2(input.tread)} + ${m2(input.landingHigh)}`,
      value: `${m2(profile.L)} ม.`,
      print: true,
    },
    {
      label: 'w ช่วงลาด',
      formula: `2,400×(t/cosθ + R/2) + ปูผิว + จร = ${fmt(loads.wWaist, 0)} + ${fmt(loads.wSteps, 0)} + ${fmt(loads.finish, 0)} + ${fmt(loads.live, 0)}`,
      value: `${fmt(loads.wFlight, 0)} กก./ตร.ม.`,
      print: true,
    },
    {
      label: 'w ส่วนราบ',
      formula: `2,400×t + ปูผิว + จร = ${fmt(loads.wSlab, 0)} + ${fmt(loads.finish, 0)} + ${fmt(loads.live, 0)}`,
      value: `${fmt(loads.wLanding, 0)} กก./ตร.ม.`,
      print: true,
    },
    {
      label: 'M ช่วงยึดหมุน',
      formula: `สถิตศาสตร์ของน้ำหนักแผ่เป็นช่วง V = 0 ที่ x = ${m2(statics.xMax)} ม.`,
      value: `${tm(statics.Mmax)} t·m/ม.`,
      print: true,
    },
    {
      label: 'w เทียบเท่า',
      formula: '8·M/L² (ให้โมเมนต์ช่วงยึดหมุนเท่ากัน)',
      value: `${fmt(loads.wEq, 0)} กก./ตร.ม.`,
      print: true,
    },
    {
      label: 'โมเมนต์ออกแบบ',
      formula:
        `M+ = w·L²/${moments.divisors.pos}, ` +
        `M−ล่าง = w·L²/${moments.divisors.negLow}, M−บน = w·L²/${moments.divisors.negHigh}`,
      value: `${tm(moments.pos)} · ${tm(moments.negLow)} · ${tm(moments.negHigh)} t·m/ม.`,
      print: true,
    },
    {
      label: 'n, k, j, R',
      formula: 'fc = 0.45f′c, fs = 0.5fy ≤ 1,700',
      value: `${p.n}, ${fmt(p.k, 3)}, ${fmt(p.j, 3)}, ${fmt(p.R, 2)} ksc`,
      print: true,
    },
    { label: 'h ขั้นต่ำ', formula: hMin.label, value: `${fmt(hMin.required, 1)} ซม.`, print: true },
    {
      label: 'เฉือน',
      formula: `v = V/(b·d), vc = 0.29√f′c${anyContinuous ? ' (ปลายต่อเนื่อง V×1.15)' : ''}`,
      value: `${fmt(v, 2)} / ${fmt(vc, 2)} ksc`,
      print: true,
    },
    {
      label: 'ปฏิกิริยาลงคาน',
      formula: 'ต่อความยาวคานรองรับ 1 ม.',
      value: `ล่าง ${fmt(reactions.low, 0)} · บน ${fmt(reactions.high, 0)} กก./ม.`,
      print: true,
    },
  ];

  for (const key of ['bottom', 'topLow', 'topHigh', 'dist'] as StairBarKey[]) {
    const run = layout[key];
    if (!run) continue;
    const b = bars[key];
    steps.push({
      label: STAIR_BAR_TH[key],
      formula:
        key === 'dist'
          ? `As ต้องการ ρ·b·t = ${fmt(b.AsReq)} ซม.²/ม.`
          : `As ต้องการ max(M/(fs·j·d), ρ·b·t) = ${fmt(b.AsReq)} ซม.²/ม.`,
      value: `${run.size} @ ${fmt(run.spacing / 100, 2)} (${fmt(b.AsProv)} ซม.²/ม.)`,
      print: true,
    });
  }
  if (layout.step) {
    steps.push({
      label: STAIR_BAR_TH.step,
      formula: 'ตามแบบมาตรฐาน ไม่ได้คำนวณ',
      value: `${layout.step.size} @${cmToM(layout.step.spacing)} + ${layout.step.size} ทุกมุม`,
      print: true,
    });
  }

  return {
    input, dims, params: p, profile, loads, moments, hMin, bars,
    V, v, vc, reactions, checks, steps, status: worstStatus(checks),
  };
}
