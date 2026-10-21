import { ACI318_WSD as C, ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import { codeOf } from '../codes/designCode';
import { wsdParams, type WsdParams } from '../design/flexure';
import { worstStatus } from '../design/sectionCheck';
import { asMinRatio, DIR_TH } from '../footing/analyzeFooting';
import type { BarDir } from '../footing/types';
import { cmToM, fmt } from '../format';
import { REBARS } from '../rebar';
import type { CalcStep, CheckItem, CheckStatus, Face, SupportCondition } from '../types';
import { detailDepthLayout, slabDetail, topAtSupport, topSpacingAtSupport, usesDetailS1, type SlabDetail } from './detail';
import { FACES, slabGeometry, supportConditionOf, type SlabGeometry } from './geometry';
import { groundMeshMaxSpacing, groundSlab, type GroundSlab } from './ground';
import { beamReaction, slabLoads, stripDemand, type SlabLoads, type StripMoments } from './loads';
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
  /** พื้นวางบนดิน: เหล็กตะแกรง (subgrade drag) และแรงดันใต้พื้น — null สำหรับพื้นชนิดอื่น */
  ground: GroundSlab | null;
  /** พื้นทางเดียว/สองทาง: แบบขยายพื้น S1 (ทิศของรูป ระยะ L/4 และ L/5) — null สำหรับพื้นชนิดอื่น */
  detail: SlabDetail | null;
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
  ground: GroundSlab | null,
  cranked: boolean,
): SlabFaceDemand {
  const run = layout[face][dir];
  const d = geom.d[face][dir];
  const db = geom.db[face][dir];
  // As ต่ำสุดของพื้นคือเหล็กกันร้าว/อุณหภูมิคิดเต็มความหนา (7.12) ไม่ใช่ 14bd/fy ของคาน
  // พื้นวางบนดินใช้ subgrade drag แทน เพราะ ACI 318 ไม่ครอบคลุม (ดู ground.ts)
  const AsMin = ground ? ground.AsReq[dir] : asMinRatio(input.fy, codeOf(input)) * STRIP * t;
  const AsFlex = d > 0 ? Mdesign / (p.fsAllow * p.j * d) : Infinity;
  const AsReq = Math.max(AsFlex, AsMin);
  // แบบ S1: เหล็กบนที่ขอบ = คอม้าที่งอขึ้นเว้นเส้น + เสริมพิเศษ วางสลับกันที่ระยะเรียงเฉลี่ย
  const atSupport = cranked && face === 'top';
  const AsProv = atSupport ? topAtSupport(layout, dir) : run ? (STRIP / run.spacing) * REBARS[run.size].area : 0;
  const spacing = atSupport ? topSpacingAtSupport(layout, dir) : run ? run.spacing : null;
  const isMain = Mdesign > 0 || cranked;
  const sMax = ground
    ? groundMeshMaxSpacing(t)
    : Math.min((isMain ? K.maxSpacingFactor : K.tempSpacingFactor) * t, K.maxSpacing);

  return {
    Mdesign, d, db,
    isOuter: geom.isOuter[face][dir],
    Mc: p.R * STRIP * d * d,
    AsFlex, AsMin, AsReq, AsProv,
    spacing,
    sMax,
    clear: spacing !== null ? spacing - db : 0,
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
  ground: GroundSlab | null,
  detail: SlabDetail | null,
): SlabDirection {
  const { span, support, w, moments, V } = stripDemand(input, loads, dir);
  const dForShear = Math.max(geom.d.bottom[dir], geom.d.top[dir]);
  const vc = K.oneWayVcCoef * Math.sqrt(input.fc);
  const cranked = !!detail?.cranked.includes(dir);

  return {
    dir, span, support, w, moments,
    bottom: faceDemand(input, layout, geom, p, dims.t, 'bottom', dir, moments.pos, ground, cranked),
    top: faceDemand(input, layout, geom, p, dims.t, 'top', dir, Math.max(moments.negEnd, moments.negInt), ground, cranked),
    V,
    v: dForShear > 0 ? V / (STRIP * dForShear) : Infinity,
    vc,
    reaction: beamReaction(loads, dims, dir),
  };
}

export function analyzeSlab(input: SlabInput, dims: SlabDims, layout: SlabLayout): SlabAnalysis {
  const p = wsdParams(input.fc, input.fy, input.fy);
  const loads = slabLoads(input, dims.t);
  const detail = usesDetailS1(input) ? slabDetail(input, dims) : null;
  const geom = slabGeometry(input.cover, dims.t, detail ? detailDepthLayout(input, layout) : layout);
  const hMin = minThickness(input, dims);
  const ground = input.slabType === 'onGround' ? groundSlab(input, loads, p.fsAllow) : null;

  const x = directionOf(input, dims, loads, layout, geom, p, 'x', ground, detail);
  const y = directionOf(input, dims, loads, layout, geom, p, 'y', ground, detail);
  const dirs = [x, y];

  if (ground) {
    const { checks, steps } = groundChecks(input, dims, layout, loads, hMin, ground, dirs);
    return { input, dims, params: p, loads, geom, hMin, x, y, ground, detail, checks, steps, status: worstStatus(checks) };
  }
  const isCranked = (dir: BarDir) => !!detail?.cranked.includes(dir);
  // แบบ S1 มีเหล็กบนเฉพาะทิศที่มีคอม้า — เหล็กบนทิศอื่น (ไฟล์เก่าที่แก้เอง) ไม่อยู่ในแบบ จึงไม่นำมาตรวจ
  const inDetail = (dir: BarDir, face: Face) => !detail || face === 'bottom' || isCranked(dir);

  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, provided: string, status: CheckStatus) =>
    checks.push({ id: `S-${checks.length}`, group, label, required, provided, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);
  const tm = (kgcm: number) => fmt(kgcm / 100 / 1000, 3);

  // ---------- 1. การโก่งตัว / ความหนา ----------
  push('deflection', `ความหนา h — ${hMin.label} (ซม.)`, `≥ ${fmt(hMin.required, 1)}`, fmt(dims.t, 1),
    okIf(dims.t + 1e-9 >= hMin.required, 'warn'));

  // ---------- 2. ดัดและเหล็กเสริม ----------
  // ตารางวิธีที่ 2 ของพื้นสองทางไม่มีเงื่อนไขนี้
  if (!loads.twoWay) {
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
      if (!inDetail(r.dir, face) || (!layout[face][r.dir] && f.Mdesign <= 0)) continue;
      // แบบ S1: เหล็กบนที่ขอบไม่มีโมเมนต์ลบให้รับ (ขอบยึดหมุน) เป็นเหล็กตามแบบ ไม่ต้องตรวจปริมาณ
      if (isCranked(r.dir) && face === 'top' && f.Mdesign <= 0) continue;
      push('flexure', asLabel(r.dir, face, isCranked(r.dir), detail), `≥ ${fmt(f.AsReq)}`, fmt(f.AsProv),
        okIf(f.AsProv >= f.AsReq * (1 - 1e-6)));
    }
  }

  // ---------- 3. เฉือนทางเดียว ----------
  for (const r of dirs) {
    if (r.w <= 0) continue;
    push('oneWay', `v ${DIR_TH[r.dir]} ที่ผิวที่รองรับ (ksc)`, `≤ ${fmt(r.vc)}`, fmt(r.v),
      okIf(r.v <= r.vc * (1 + 1e-6)));
  }

  // ---------- 4. การจัดเหล็ก ----------
  const dMin = Math.min(...dirs.flatMap((r) => FACES.filter((f) => layout[f][r.dir] && inDetail(r.dir, f)).map((f) => r[f].d)));
  if (Number.isFinite(dMin)) {
    push('detail', 'ความลึกประสิทธิผล d (ซม.)', `≥ ${fmt(K.minEffectiveDepth, 1)}`, fmt(dMin, 1),
      okIf(dMin >= K.minEffectiveDepth - 1e-9));
  }
  push('detail', 'ระยะหุ้มคอนกรีต (ซม.)', `≥ ${fmt(K.cover, 1)}`, fmt(input.cover, 1),
    okIf(input.cover >= K.cover - 1e-9));

  for (const r of dirs) {
    for (const face of FACES) {
      const f = r[face];
      if (f.spacing === null || !inDetail(r.dir, face)) continue;
      const where = isCranked(r.dir) && face === 'top' ? `${DIR_TH[r.dir]} ผิวบนที่ขอบ (เฉลี่ย)` : `${DIR_TH[r.dir]} ผิว${FACE_TH[face]}`;
      push('detail', `ระยะเรียงเหล็ก${where} (ซม.)`, `≤ ${fmt(f.sMax, 1)}`, fmt(f.spacing, 1),
        okIf(f.spacing <= f.sMax + 1e-9));
      push('detail', `ช่องว่างเหล็ก${where} (ซม.)`, `≥ ${fmt(f.clearReq, 1)}`, fmt(f.clear, 1),
        okIf(f.clear >= f.clearReq - 1e-9));
    }
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
  if (loads.twoWay) {
    const disc = loads.twoWay.caseNo - 1;
    steps.push({
      label: 'พื้นสองทาง วิธีที่ 2',
      formula: `m = S/L, กรณี ${loads.twoWay.caseNo} (ขอบไม่ต่อเนื่อง ${disc} ด้าน)`,
      value: `m = ${fmt(loads.twoWay.m, 2)}`,
      print: true,
    });
  }

  for (const r of dirs) {
    if (r.w <= 0) continue;
    const d = r.moments.divisors;
    const c = r.moments.coefs;
    const parts = c
      ? [
          c.pos !== null ? `M+ = ${fmt(c.pos, 3)}·w·S²` : null,
          c.negEnd !== null ? `M−ขอบไม่ต่อเนื่อง = ${fmt(c.negEnd, 3)}·w·S²` : null,
          c.negInt !== null ? `M−ขอบต่อเนื่อง = ${fmt(c.negInt, 3)}·w·S²` : null,
        ]
      : [
          d.pos !== null ? `M+ = w·L²/${d.pos}` : null,
          d.negEnd !== null ? `M−ริม = w·L²/${d.negEnd}` : null,
          d.negInt !== null ? `M−ใน = w·L²/${d.negInt}` : null,
        ];
    const L = c ? `S = ${fmt(Math.min(dims.lx, dims.ly) / 100, 2)} ม.` : `L = ${fmt(r.span / 100, 2)} ม.`;
    steps.push({
      label: `โมเมนต์${DIR_TH[r.dir]}`,
      formula: `${parts.filter(Boolean).join(', ')} (${L})`,
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
      formula: loads.twoWay
        ? loads.shortDir === r.dir ? 'w·S/3·(3 − m²)/2 (คานด้านยาว)' : 'w·S/3 (คานด้านสั้น)'
        : 'w·L/2 ต่อความยาวคาน 1 ม.',
      value: `${fmt(r.reaction, 0)} กก./ม.`,
      print: true,
    });
  }

  if (detail) {
    steps.push(...detailSteps(layout, detail, dirs));
  } else {
    for (const r of dirs) {
      for (const face of FACES) {
        const run = layout[face][r.dir];
        if (!run) continue;
        const f = r[face];
        steps.push({
          label: `เหล็ก${DIR_TH[r.dir]} ผิว${FACE_TH[face]}`,
          formula: `As ต้องการ max(M/(fs·j·d), ρ·b·t) = ${fmt(f.AsReq)} ซม.²/ม.`,
          value: `${run.size} @ ${cmToM(run.spacing)} (${fmt(f.AsProv)} ซม.²/ม.)`,
          print: true,
        });
      }
    }
  }

  return { input, dims, params: p, loads, geom, hMin, x, y, ground, detail, checks, steps, status: worstStatus(checks) };
}

/** ชื่อรายการตรวจ As — แบบ S1 บอกว่าเป็นเหล็กชุดใดในแบบ */
function asLabel(dir: BarDir, face: Face, cranked: boolean, detail: SlabDetail | null): string {
  const unit = '(ซม.²/ม.)';
  if (!detail) return `As ${DIR_TH[dir]} ผิว${FACE_TH[face]} ${unit}`;
  if (!cranked) return `As ${DIR_TH[dir]} — เหล็กกันร้าว ${unit}`;
  return face === 'bottom'
    ? `As+ ${DIR_TH[dir]} กลางช่วง — คอม้าเว้นเส้น ${unit}`
    : `As− ${DIR_TH[dir]} ที่ขอบ = คอม้า/2 + เสริมพิเศษ ${unit}`;
}

/** ขั้นตอนคำนวณเหล็กตามแบบขยายพื้น S1 */
function detailSteps(layout: SlabLayout, detail: SlabDetail, dirs: SlabDirection[]): CalcStep[] {
  const m = (cm: number) => fmt(cm / 100, 2);
  const runText = (run: SlabLayout['top']['x']) => (run ? `${run.size} @ ${cmToM(run.spacing)}` : '—');
  const steps: CalcStep[] = [
    {
      label: 'ระยะตัดเหล็ก (แบบ S1)',
      formula: `เสริมพิเศษยื่น L/4, คอม้างอขึ้นที่ L/5 จากศูนย์กลางคาน (L = ช่วงสั้น ${m(detail.L)} ม.)`,
      value: `L/4 = ${m(detail.cutoff)}, L/5 = ${m(detail.bend)} ม.`,
      print: true,
    },
  ];
  for (const r of dirs) {
    const run = layout.bottom[r.dir];
    if (!detail.cranked.includes(r.dir)) {
      if (!run) continue;
      steps.push({
        label: `เหล็กกันร้าว${DIR_TH[r.dir]}`,
        formula: `As ต้องการ ρ·b·t = ${fmt(r.bottom.AsReq)} ซม.²/ม.`,
        value: `${runText(run)} (${fmt(r.bottom.AsProv)} ซม.²/ม.)`,
        print: true,
      });
      continue;
    }
    steps.push({
      label: `คอม้าเว้นเส้น${DIR_TH[r.dir]}`,
      formula: `As+ ต้องการ max(M+/(fs·j·d), ρ·b·t) = ${fmt(r.bottom.AsReq)} ซม.²/ม.`,
      value: `${runText(run)} (${fmt(r.bottom.AsProv)} ซม.²/ม.)`,
      print: true,
    });
    const need = r.top.Mdesign > 0 ? `As− ต้องการ ${fmt(r.top.AsReq)} ซม.²/ม., ` : '';
    steps.push({
      label: `เหล็กบนที่ขอบ${DIR_TH[r.dir]}`,
      formula: `${need}คอม้า/2 + เสริมพิเศษ ${runText(layout.top[r.dir])}`,
      value: `${fmt(r.top.AsProv)} ซม.²/ม.`,
      print: true,
    });
  }
  return steps;
}

/**
 * รายการตรวจสอบพื้นวางบนดิน (แบบขยายพื้น GS) — สามเรื่องที่ต้องตอบ: ความหนา เหล็กเสริม และรับน้ำหนักได้หรือไม่
 * ไม่มีดัดและเฉือนจากน้ำหนักแผ่ เพราะน้ำหนักลงทรายรองพื้นโดยตรง (ดู ground.ts)
 */
function groundChecks(
  input: SlabInput,
  dims: SlabDims,
  layout: SlabLayout,
  loads: SlabLoads,
  hMin: MinThickness,
  g: GroundSlab,
  dirs: SlabDirection[],
): { checks: CheckItem[]; steps: CalcStep[] } {
  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, provided: string, status: CheckStatus) =>
    checks.push({ id: `S-${checks.length}`, group, label, required, provided, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);
  const m = (cm: number) => fmt(cm / 100, 2);

  // ---------- 1. ความหนา ----------
  push('thickness', `ความหนา h — ${hMin.label} (ซม.)`, `≥ ${fmt(hMin.required, 1)}`, fmt(dims.t, 1),
    okIf(dims.t + 1e-9 >= hMin.required, 'warn'));

  // ---------- 2. เหล็กเสริม (ตะแกรงชั้นเดียว) ----------
  for (const r of dirs) {
    const f = r.bottom;
    push('reinforcement', `As ${DIR_TH[r.dir]} = F·L·W/(2fs), L = ${m(g.L[r.dir])} ม. (ซม.²/ม.)`, `≥ ${fmt(f.AsReq)}`,
      fmt(f.AsProv), okIf(f.AsProv >= f.AsReq * (1 - 1e-6)));
  }
  for (const r of dirs) {
    const f = r.bottom;
    if (f.spacing === null) continue;
    push('reinforcement', `ระยะเรียงเหล็ก${DIR_TH[r.dir]} (ซม.)`, `≤ ${fmt(f.sMax, 1)}`, fmt(f.spacing, 1),
      okIf(f.spacing <= f.sMax + 1e-9));
    push('reinforcement', `ช่องว่างเหล็ก${DIR_TH[r.dir]} (ซม.)`, `≥ ${fmt(f.clearReq, 1)}`, fmt(f.clear, 1),
      okIf(f.clear >= f.clearReq - 1e-9));
  }
  push('reinforcement', 'ระยะหุ้มคอนกรีตด้านทรายรองพื้น (ซม.)', `≥ ${fmt(K.coverOnGround, 1)}`, fmt(input.cover, 1),
    okIf(input.cover >= K.coverOnGround - 1e-9));

  // ---------- 3. การรับน้ำหนัก ----------
  push('capacity', 'แรงดันใต้พื้น q = น้ำหนักคงที่ + จร (t/m²)', `≤ qa ${fmt(g.qa)}`, fmt(g.q),
    okIf(g.q <= g.qa * (1 + 1e-6)));
  // ที่พักอาศัยไม่มีล้อรถ — ส่วนที่จอดรถและโกดังมีน้ำหนักกระทำเป็นจุดที่ต้องใช้ค่า k ของดินตรวจแยก
  if (input.usage !== 'light') {
    push('capacity', 'น้ำหนักล้อรถ / น้ำหนักกระทำเป็นจุด', 'ต้องตรวจแยก', 'ยังไม่ได้ตรวจ', 'warn');
  }

  // ---------- ขั้นตอนคำนวณ ----------
  const steps: CalcStep[] = [
    { label: 'น้ำหนักตัวพื้น', formula: `${fmt(dims.t, 1)} ซม. × 2,400 กก./ลบ.ม.`, value: `${fmt(loads.wSelf, 0)} กก./ตร.ม.`, print: true },
    { label: 'W น้ำหนักคงที่', formula: 'ตัวพื้น + วัสดุปูผิว', value: `${fmt(g.W, 0)} กก./ตร.ม.`, print: true },
    { label: 'h ขั้นต่ำ', formula: hMin.label, value: `${fmt(hMin.required, 1)} ซม.`, print: true },
    { label: 'fs', formula: '0.5fy ≤ 1,700 ksc', value: `${fmt(g.fs, 0)} ksc`, print: true },
  ];
  for (const r of dirs) {
    steps.push({
      label: `As ${DIR_TH[r.dir]}`,
      formula: `F·L·W/(2fs) = ${fmt(g.F, 1)} × ${m(g.L[r.dir])} × ${fmt(g.W, 0)} / (2 × ${fmt(g.fs, 0)})`,
      value: `${fmt(g.AsReq[r.dir])} ซม.²/ม.`,
      print: true,
    });
  }
  for (const r of dirs) {
    const run = layout.bottom[r.dir];
    if (!run) continue;
    steps.push({
      label: `เหล็ก${DIR_TH[r.dir]}`,
      formula: `As ต้องการ ${fmt(r.bottom.AsReq)} ซม.²/ม.`,
      value: `${run.size} @ ${cmToM(run.spacing)} (${fmt(r.bottom.AsProv)} ซม.²/ม.)`,
      print: true,
    });
  }
  steps.push(
    {
      label: 'แรงดันใต้พื้น',
      formula: `q = (W + จร)/1,000 = (${fmt(g.W, 0)} + ${fmt(loads.wLive, 0)})/1,000`,
      value: `${fmt(g.q)} t/m² (qa ${fmt(g.qa)})`,
      print: true,
    },
    {
      label: 'จรที่รับได้',
      formula: `qa − W = ${fmt(g.qa * 1000, 0)} − ${fmt(g.W, 0)}`,
      value: `${fmt(g.liveCapacity, 0)} กก./ตร.ม.`,
      print: true,
    },
  );

  return { checks, steps };
}
