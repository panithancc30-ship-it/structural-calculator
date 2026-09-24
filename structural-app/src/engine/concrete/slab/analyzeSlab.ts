import { ACI318_WSD as C, ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import { wsdParams, type WsdParams } from '../design/flexure';
import { worstStatus } from '../design/sectionCheck';
import { asMinRatio, DIR_TH } from '../footing/analyzeFooting';
import type { BarDir } from '../footing/types';
import { fmt } from '../format';
import { REBARS } from '../rebar';
import type { CalcStep, CheckItem, CheckStatus, Face, SupportCondition } from '../types';
import { FACES, slabGeometry, spanOf, supportConditionOf, type SlabGeometry } from './geometry';
import { beamReaction, slabLoads, stripMoments, stripShear, type SlabLoads, type StripMoments } from './loads';
import type { SlabDims, SlabInput, SlabLayout } from './types';

const FACE_TH: Record<Face, string> = { bottom: 'ล่าง', top: 'บน' };

/** ความหนาขั้นต่ำที่ควบคุมการโก่งตัว */
export interface MinThickness {
  required: number;
  /** ที่มาของค่า ใช้พิมพ์ลงรายการคำนวณ */
  label: string;
}

export function minThickness(input: SlabInput, dims: Pick<SlabDims, 'lx' | 'ly'>): MinThickness {
  const floor = K.absMinThickness[input.slabType];

  if (input.slabType === 'onGround') {
    const required = Math.max(floor, K.onGroundMinThickness[input.usage]);
    return { required, label: `ความหนาขั้นต่ำตามการใช้งาน (${fmt(required, 1)} ซม.)` };
  }

  if (input.slabType === 'twoWay') {
    const perimeter = 2 * (dims.lx + dims.ly);
    const required = Math.max(floor, perimeter / K.twoWayPerimeterDivisor, K.twoWayMinThickness);
    return { required, label: `เส้นรอบรูป/${K.twoWayPerimeterDivisor} (${fmt(perimeter / 100, 2)} ม.)` };
  }

  // ทางเดียวและพื้นยื่น — ใช้แถวพื้นตันของ Table 9.5(a) กับช่วงที่รับน้ำหนัก
  const support = supportConditionOf(input, 'x');
  const divisor = K.minThicknessDivisor[support];
  const factor = 0.4 + input.fy / C.minDepthFyDivisor;
  const required = Math.max(floor, ((input.lx / divisor) * factor));
  return { required, label: `L/${divisor} × (0.4 + fy/${C.minDepthFyDivisor.toLocaleString('en-US')})` };
}

export interface SlabFaceDemand {
  /** โมเมนต์ออกแบบของผิวนี้ (kg·cm ต่อความกว้าง 1 ม.) */
  Mdesign: number;
  d: number;
  db: number;
  isOuter: boolean;
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

export interface SlabDirection {
  dir: BarDir;
  span: number;
  support: SupportCondition;
  /** น้ำหนักที่แถบทิศนี้รับ (กก./ตร.ม.) */
  w: number;
  moments: StripMoments;
  bottom: SlabFaceDemand;
  top: SlabFaceDemand;
  /** แรงเฉือนและหน่วยแรงเฉือนของแถบ */
  V: number;
  v: number;
  vc: number;
  /** ปฏิกิริยาที่ถ่ายลงคานรองรับ (กก./ม.) */
  reaction: number;
}

export interface SlabAnalysis {
  input: SlabInput;
  dims: SlabDims;
  params: WsdParams;
  loads: SlabLoads;
  geom: SlabGeometry;
  hMin: MinThickness;
  x: SlabDirection;
  y: SlabDirection;
  checks: CheckItem[];
  steps: CalcStep[];
  status: CheckStatus;
}

/** ความกว้างของแถบออกแบบ — พื้นคิดต่อความกว้าง 1 ม. เสมอ */
const STRIP = 100;

function faceDemand(
  input: SlabInput,
  layout: SlabLayout,
  geom: SlabGeometry,
  p: WsdParams,
  t: number,
  face: Face,
  dir: BarDir,
  Mdesign: number,
): SlabFaceDemand {
  const run = layout[face][dir];
  const d = geom.d[face][dir];
  const db = geom.db[face][dir];
  // As ต่ำสุดของพื้นคือเหล็กกันร้าว/อุณหภูมิคิดเต็มความหนา (7.12) ไม่ใช่ 14bd/fy ของคาน
  const AsMin = asMinRatio(input.fy) * STRIP * t;
  const AsFlex = d > 0 ? Mdesign / (p.fsAllow * p.j * d) : Infinity;
  const AsReq = Math.max(AsFlex, AsMin);
  const AsProv = run ? (STRIP / run.spacing) * REBARS[run.size].area : 0;
  const isMain = Mdesign > 0;
  const sMax = Math.min((isMain ? K.maxSpacingFactor : K.tempSpacingFactor) * t, K.maxSpacing);

  return {
    Mdesign, d, db,
    isOuter: geom.isOuter[face][dir],
    Mc: p.R * STRIP * d * d,
    AsFlex, AsMin, AsReq, AsProv,
    spacing: run ? run.spacing : null,
    sMax,
    clear: run ? run.spacing - db : 0,
    clearReq: Math.max(db, C.minClearSpacing),
  };
}

function directionOf(
  input: SlabInput,
  dims: SlabDims,
  loads: SlabLoads,
  layout: SlabLayout,
  geom: SlabGeometry,
  p: WsdParams,
  dir: BarDir,
): SlabDirection {
  const span = spanOf(dims, dir);
  const support = supportConditionOf(input, dir);
  const w = loads.share[dir];
  const flexural = input.slabType !== 'onGround' && w > 0;
  const moments = flexural
    ? stripMoments(w, span, support)
    : { pos: 0, negEnd: 0, negInt: 0, divisors: { pos: null, negEnd: null, negInt: null } };

  const V = flexural ? stripShear(w, span, support) : 0;
  const dForShear = Math.max(geom.d.bottom[dir], geom.d.top[dir]);
  const vc = K.oneWayVcCoef * Math.sqrt(input.fc);

  return {
    dir, span, support, w, moments,
    bottom: faceDemand(input, layout, geom, p, dims.t, 'bottom', dir, moments.pos),
    top: faceDemand(input, layout, geom, p, dims.t, 'top', dir, Math.max(moments.negEnd, moments.negInt)),
    V,
    v: dForShear > 0 ? V / (STRIP * dForShear) : Infinity,
    vc,
    reaction: beamReaction(loads, dims, dir),
  };
}

export function analyzeSlab(input: SlabInput, dims: SlabDims, layout: SlabLayout): SlabAnalysis {
  const p = wsdParams(input.fc, input.fy, input.fy);
  const loads = slabLoads(input, dims.t);
  const geom = slabGeometry(input.cover, dims.t, layout);
  const hMin = minThickness(input, dims);

  const x = directionOf(input, dims, loads, layout, geom, p, 'x');
  const y = directionOf(input, dims, loads, layout, geom, p, 'y');
  const dirs = [x, y];

  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, provided: string, status: CheckStatus) =>
    checks.push({ id: `S-${checks.length}`, group, label, required, provided, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);
  const tm = (kgcm: number) => fmt(kgcm / 100 / 1000, 3);

  // ---------- 1. การโก่งตัว / ความหนา ----------
  push('deflection', `ความหนา h — ${hMin.label} (ซม.)`, `≥ ${fmt(hMin.required, 1)}`, fmt(dims.t, 1),
    okIf(dims.t + 1e-9 >= hMin.required, 'warn'));

  // ---------- 2. ดัดและเหล็กเสริม ----------
  if (input.slabType !== 'onGround') {
    const ll = loads.wLive;
    const dl = loads.wDead;
    push('flexure', `น้ำหนักจร ≤ ${K.liveToDeadLimit}×น้ำหนักคงที่ (เงื่อนไขใช้สัมประสิทธิ์ 8.3.3)`,
      `≤ ${fmt(K.liveToDeadLimit * dl, 0)} กก./ตร.ม.`, fmt(ll, 0),
      okIf(ll <= K.liveToDeadLimit * dl + 1e-9, 'warn'));

    for (const r of dirs) {
      for (const face of FACES) {
        const f = r[face];
        if (f.Mdesign <= 0) continue;
        push('flexure', `M ${DIR_TH[r.dir]} ผิว${FACE_TH[face]} ≤ R·b·d² (t·m/ม.)`, `≤ ${tm(f.Mc)}`, tm(f.Mdesign),
          okIf(f.Mdesign <= f.Mc * (1 + 1e-6)));
      }
    }
  }

  for (const r of dirs) {
    for (const face of FACES) {
      const f = r[face];
      if (!layout[face][r.dir] && f.Mdesign <= 0) continue;
      push('flexure', `As ${DIR_TH[r.dir]} ผิว${FACE_TH[face]} (ซม.²/ม.)`, `≥ ${fmt(f.AsReq)}`, fmt(f.AsProv),
        okIf(f.AsProv >= f.AsReq * (1 - 1e-6)));
    }
  }

  // ---------- 3. เฉือนทางเดียว ----------
  if (input.slabType !== 'onGround') {
    for (const r of dirs) {
      if (r.w <= 0) continue;
      push('oneWay', `v ${DIR_TH[r.dir]} ที่ผิวที่รองรับ (ksc)`, `≤ ${fmt(r.vc)}`, fmt(r.v),
        okIf(r.v <= r.vc * (1 + 1e-6)));
    }
  }

  // ---------- 4. การจัดเหล็ก ----------
  const dMin = Math.min(...dirs.flatMap((r) => FACES.filter((f) => layout[f][r.dir]).map((f) => r[f].d)));
  if (Number.isFinite(dMin) && input.slabType !== 'onGround') {
    push('detail', 'ความลึกประสิทธิผล d (ซม.)', `≥ ${fmt(K.minEffectiveDepth, 1)}`, fmt(dMin, 1),
      okIf(dMin >= K.minEffectiveDepth - 1e-9));
  }
  const coverMin = input.slabType === 'onGround' ? K.coverOnGround : K.cover;
  push('detail', 'ระยะหุ้มคอนกรีต (ซม.)', `≥ ${fmt(coverMin, 1)}`, fmt(input.cover, 1),
    okIf(input.cover >= coverMin - 1e-9));

  for (const r of dirs) {
    for (const face of FACES) {
      const f = r[face];
      if (f.spacing === null) continue;
      push('detail', `ระยะเรียงเหล็ก${DIR_TH[r.dir]} ผิว${FACE_TH[face]} (ซม.)`, `≤ ${fmt(f.sMax, 1)}`, fmt(f.spacing, 1),
        okIf(f.spacing <= f.sMax + 1e-9));
      push('detail', `ช่องว่างเหล็ก${DIR_TH[r.dir]} ผิว${FACE_TH[face]} (ซม.)`, `≥ ${fmt(f.clearReq, 1)}`, fmt(f.clear, 1),
        okIf(f.clear >= f.clearReq - 1e-9));
    }
  }

  if (input.slabType === 'onGround') {
    push('detail', 'น้ำหนักกระทำเป็นจุด / ล้อรถ', 'ต้องตรวจแยก', 'ยังไม่ได้ตรวจ', 'warn');
  }

  // ---------- ขั้นตอนคำนวณ ----------
  const steps: CalcStep[] = [
    { label: 'น้ำหนักตัวพื้น', formula: `${fmt(dims.t, 1)} ซม. × 2,400 กก./ลบ.ม.`, value: `${fmt(loads.wSelf, 0)} กก./ตร.ม.`, print: true },
    { label: 'w ใช้งาน', formula: 'ตัวพื้น + วัสดุปูผิว + จร', value: `${fmt(loads.w, 0)} กก./ตร.ม.`, print: true },
    { label: 'n, k, j, R', formula: 'fc = 0.45f′c, fs = 0.5fy ≤ 1,700', value: `${p.n}, ${fmt(p.k, 3)}, ${fmt(p.j, 3)}, ${fmt(p.R, 2)} ksc`, print: true },
    { label: 'h ขั้นต่ำ', formula: hMin.label, value: `${fmt(hMin.required, 1)} ซม.`, print: true },
  ];

  if (loads.splitRatio !== null) {
    steps.push({
      label: 'แบ่งน้ำหนักสองทาง',
      formula: 'wx = w·ly⁴/(lx⁴+ly⁴) (Rankine–Grashof)',
      value: `wx ${fmt(loads.share.x, 0)}, wy ${fmt(loads.share.y, 0)} กก./ตร.ม.`,
      print: true,
    });
  }

  for (const r of dirs) {
    if (r.w <= 0 || input.slabType === 'onGround') continue;
    const d = r.moments.divisors;
    const parts = [
      d.pos !== null ? `M+ = w·L²/${d.pos}` : null,
      d.negEnd !== null ? `M−ริม = w·L²/${d.negEnd}` : null,
      d.negInt !== null ? `M−ใน = w·L²/${d.negInt}` : null,
    ].filter(Boolean);
    steps.push({
      label: `โมเมนต์${DIR_TH[r.dir]}`,
      formula: `${parts.join(', ')} (L = ${fmt(r.span / 100, 2)} ม.)`,
      value: `${tm(r.moments.pos)} / ${tm(Math.max(r.moments.negEnd, r.moments.negInt))} t·m/ม.`,
      print: true,
    });
    steps.push({
      label: `เฉือน${DIR_TH[r.dir]}`,
      formula: 'v = V/(b·d), vc = 0.29√f′c',
      value: `${fmt(r.v, 2)} / ${fmt(r.vc, 2)} ksc`,
      print: true,
    });
    steps.push({
      label: `ปฏิกิริยาลงคาน${DIR_TH[r.dir]}`,
      formula: 'w·L/2 ต่อความยาวคาน 1 ม.',
      value: `${fmt(r.reaction, 0)} กก./ม.`,
      print: true,
    });
  }

  for (const r of dirs) {
    for (const face of FACES) {
      const run = layout[face][r.dir];
      if (!run) continue;
      const f = r[face];
      steps.push({
        label: `เหล็ก${DIR_TH[r.dir]} ผิว${FACE_TH[face]}`,
        formula: `As ต้องการ max(M/(fs·j·d), ρ·b·t) = ${fmt(f.AsReq)} ซม.²/ม.`,
        value: `${run.size} @ ${fmt(run.spacing / 100, 2)} (${fmt(f.AsProv)} ซม.²/ม.)`,
        print: true,
      });
    }
  }

  return { input, dims, params: p, loads, geom, hMin, x, y, checks, steps, status: worstStatus(checks) };
}
