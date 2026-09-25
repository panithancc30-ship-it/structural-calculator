import { ACI318_WSD as C } from '../codes/aci318Wsd';
import { REBARS } from '../rebar';
import { fmt } from '../format';
import type { BeamInput, CalcStep, CheckItem, CheckStatus, Face, SectionKey, SectionLayout } from '../types';
import { computeGeometry, type PlacedBar, type SectionGeometry } from './barLayout';
import { designFlexure, wsdParams, type FlexureDesign, type WsdParams } from './flexure';
import { distributeAl, shearTorsionDemand, type ShearTorsionDemand } from './shearTorsion';
import { stirrupSpacing, type StirrupCapacity } from './stirrupConfig';

export interface StressResult {
  valid: boolean;
  /** ระยะแกนสะเทินจากผิวรับอัด (ซม.) */
  kd: number;
  Icr: number;
  fc: number;
  /** หน่วยแรงเหล็กรับดึงที่ centroid */
  fs: number;
  /** หน่วยแรงเหล็กรับอัดที่ centroid (null ถ้าไม่มีเหล็กในโซนอัด) */
  fsPrime: number | null;
}

/**
 * วิเคราะห์หน้าตัดแตกร้าวแบบ transformed section
 * @param bars ตำแหน่ง y วัดจากผิวรับอัด
 */
export function analyzeStresses(
  bars: { area: number; y: number }[],
  b: number,
  h: number,
  n: number,
  M: number,
  dT: number,
  dC: number | null,
): StressResult {
  const nc = C.compressionSteelFactor * n;
  const firstMoment = (c: number) =>
    bars.reduce(
      (s, bar) => (bar.y < c ? s + (nc - 1) * bar.area * (c - bar.y) : s - n * bar.area * (bar.y - c)),
      (b * c * c) / 2,
    );

  if (!bars.some((bar) => bar.y > 0.5 * h) || firstMoment(1e-6) >= 0) {
    return { valid: false, kd: 0, Icr: 0, fc: Infinity, fs: Infinity, fsPrime: null };
  }

  let lo = 0;
  let hi = h;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (firstMoment(mid) > 0) hi = mid;
    else lo = mid;
  }
  const kd = (lo + hi) / 2;
  const Icr = bars.reduce(
    (s, bar) => s + (bar.y < kd ? nc - 1 : n) * bar.area * (bar.y - kd) ** 2,
    (b * kd ** 3) / 3,
  );

  return {
    valid: true,
    kd,
    Icr,
    fc: (M * kd) / Icr,
    fs: (n * M * (dT - kd)) / Icr,
    fsPrime: dC !== null && dC < kd ? (nc * M * (kd - dC)) / Icr : null,
  };
}

export interface SectionRequirements {
  AsTension: number;
  AsCompression: number;
  AsSide: number;
  AlTop: number;
  AlBottom: number;
  AlSide: number;
  continuity: number;
}

export interface SectionAnalysis {
  key: SectionKey;
  tensionFace: Face;
  compressionFace: Face;
  params: WsdParams;
  geom: SectionGeometry;
  dT: number;
  dC: number;
  flex: FlexureDesign;
  shear: ShearTorsionDemand;
  stirrupCap: StirrupCapacity;
  stress: StressResult;
  req: SectionRequirements;
  provided: { AsTension: number; AsCompression: number; AsSide: number };
  checks: CheckItem[];
  steps: CalcStep[];
  status: CheckStatus;
}

export interface SectionContext {
  /** พื้นที่เหล็กล่างของหน้าตัด A-A (ใช้ตรวจเหล็กล่างต่อเนื่องที่ B-B) */
  bottomAsAtA?: number;
}

const FACE_TH: Record<Face, string> = { top: 'บน', bottom: 'ล่าง' };
const area = (bars: PlacedBar[]) => bars.reduce((s, bar) => s + bar.area, 0);
const centroid = (bars: PlacedBar[], yOf: (bar: PlacedBar) => number) =>
  bars.reduce((s, bar) => s + bar.area * yOf(bar), 0) / area(bars);

export function worstStatus(items: { status: CheckStatus }[]): CheckStatus {
  if (items.some((c) => c.status === 'fail')) return 'fail';
  if (items.some((c) => c.status === 'warn')) return 'warn';
  return 'ok';
}

/** วิเคราะห์ + ตรวจสอบหน้าตัดจาก layout เหล็กที่วางจริง */
export function analyzeSection(
  input: BeamInput,
  key: SectionKey,
  layout: SectionLayout,
  ctx: SectionContext = {},
): SectionAnalysis {
  const p = wsdParams(input.fc, input.fy, input.fyv);
  const geom = computeGeometry(input, layout);
  const { b, h, cover } = input;
  const tensionFace: Face = key === 'A' ? 'bottom' : 'top';
  const compressionFace: Face = key === 'A' ? 'top' : 'bottom';
  const yFromComp = (bar: PlacedBar) => (key === 'A' ? bar.y : h - bar.y);

  const ds = geom.outer.ds;
  const mainDia = REBARS[input.mainBar].dia;
  const tBars = geom.bars.filter((bar) => bar.face === tensionFace);
  const cBars = geom.bars.filter((bar) => bar.face === compressionFace);
  const sBars = geom.bars.filter((bar) => bar.face === 'side');
  const dT = tBars.length ? centroid(tBars, yFromComp) : h - cover - ds - mainDia / 2;
  const dC = cBars.length ? centroid(cBars, yFromComp) : cover + ds + mainDia / 2;

  const M = Math.abs(input.M) * 100;
  const flex = designFlexure(p, b, dT, dC, M);
  const shear = shearTorsionDemand(input, p, dT, ds);
  const stirrupCap = stirrupSpacing(shear, layout.stirrup.size, layout.stirrup.count, b, input.fyv);
  const al = distributeAl(shear.Al, h);
  const alOf = (face: Face) => (face === 'top' ? al.top : al.bottom);

  const continuity =
    key === 'B' && ctx.bottomAsAtA ? C.continuityRatio[input.support] * ctx.bottomAsAtA : 0;
  const req: SectionRequirements = {
    AsTension: flex.AsReq + alOf(tensionFace),
    AsCompression: Math.max(flex.AsPrimeReq + alOf(compressionFace), continuity),
    AsSide: al.side,
    AlTop: al.top,
    AlBottom: al.bottom,
    AlSide: al.side,
    continuity,
  };
  const provided = { AsTension: area(tBars), AsCompression: area(cBars), AsSide: area(sBars) };

  const stress = analyzeStresses(
    geom.bars.map((bar) => ({ area: bar.area, y: yFromComp(bar) })),
    b, h, p.n, M, dT,
    cBars.length ? dC : null,
  );

  // ---------- รายการตรวจสอบ ----------
  const checks: CheckItem[] = [];
  const push = (group: CheckItem['group'], label: string, required: string, providedText: string, status: CheckStatus) =>
    checks.push({ id: `${key}-${checks.length}`, group, label, required, provided: providedText, status });
  const okIf = (cond: boolean, otherwise: CheckStatus = 'fail'): CheckStatus => (cond ? 'ok' : otherwise);
  const tol = 1e-6;

  push('flexure', `As รับดึง (${FACE_TH[tensionFace]})`, `≥ ${fmt(req.AsTension)}`, fmt(provided.AsTension),
    okIf(provided.AsTension + tol >= req.AsTension));
  push('flexure', `As รับอัด (${FACE_TH[compressionFace]})`,
    Number.isFinite(req.AsCompression) ? `≥ ${fmt(req.AsCompression)}` : 'หน้าตัดเล็กเกินไป',
    fmt(provided.AsCompression), okIf(provided.AsCompression + tol >= req.AsCompression));
  push('flexure', 'fc คอนกรีต (ksc)', `≤ ${fmt(p.fcAllow, 1)}`, stress.valid ? fmt(stress.fc, 1) : '—',
    okIf(stress.valid && stress.fc <= p.fcAllow * 1.001));
  push('flexure', 'fs เหล็กรับดึง (ksc)', `≤ ${fmt(p.fsAllow, 0)}`, stress.valid ? fmt(stress.fs, 0) : '—',
    okIf(stress.valid && stress.fs <= p.fsAllow * 1.001));
  if (stress.fsPrime !== null) {
    push('flexure', "fs′ เหล็กรับอัด (ksc)", `≤ ${fmt(p.fsAllow, 0)}`, fmt(stress.fsPrime, 0),
      okIf(stress.fsPrime <= p.fsAllow * 1.001));
  }

  for (const sp of geom.spacing) {
    push('detail', `ช่องว่างเหล็ก${FACE_TH[sp.face]} ชั้น ${sp.layer + 1} (ซม.)`, `≥ ${fmt(sp.required, 1)}`,
      fmt(sp.minClear, 1), okIf(sp.ok));
  }
  if (req.AsSide > 0 || sBars.length > 0) {
    push('detail', 'เหล็กข้างรับแรงบิด (ซม.²)', `≥ ${fmt(req.AsSide)}`, fmt(provided.AsSide),
      okIf(provided.AsSide + tol >= req.AsSide));
  }
  if (!geom.innerAnchorsOk) {
    push('detail', 'เหล็กมุมปลอกใน (ชั้นแรก บน/ล่าง)', '≥ 4 เส้น',
      `${layout.top[0]?.bars.length ?? 0} / ${layout.bottom[0]?.bars.length ?? 0}`, 'fail');
  }

  const s = layout.stirrup.spacing;
  push('shear', 'v (ksc)', `≤ ${fmt(shear.vMax)}`, fmt(shear.v), okIf(shear.shearSectionOk));
  if (!shear.torsionNeglected) {
    push('shear', 'vt (ksc)', `≤ ${fmt(shear.vtMax)}`, fmt(shear.vt), okIf(shear.torsionSectionOk));
  }
  push('shear', 'ระยะปลอกตามกำลัง (ซม.)', Number.isFinite(stirrupCap.sStrength) ? `≤ ${fmt(stirrupCap.sStrength, 1)}` : 'ไม่จำกัด',
    fmt(s, 1), okIf(s <= stirrupCap.sStrength + tol));
  push('shear', 'ระยะปลอกสูงสุด s max (ซม.)', `≤ ${fmt(stirrupCap.sMax, 1)}`, fmt(s, 1), okIf(s <= stirrupCap.sMax + tol));
  push('shear', 'ปริมาณปลอกขั้นต่ำ (ซม.)', `s ≤ ${fmt(stirrupCap.sAreaMin, 1)}`, fmt(s, 1), okIf(s <= stirrupCap.sAreaMin + tol));
  push('shear', 'ระยะปลอกก่อสร้างสะดวก (ซม.)', `≥ ${fmt(input.sMin, 1)}`, fmt(s, 1), okIf(s + tol >= input.sMin, 'warn'));

  // ---------- ขั้นตอนคำนวณ ----------
  const steps: CalcStep[] = [
    { label: 'd', formula: 'ระยะผิวอัด → centroid เหล็กรับดึง', value: `${fmt(dT)} ซม.`, print: true },
    { label: 'Mc', formula: 'R·b·d²', value: `${fmt(flex.Mc / 100, 0)} kg·m`, print: true },
  ];
  if (!flex.doubly) {
    steps.push({ label: 'As', formula: 'M ≤ Mc → M / (fs·j·d)', value: `${fmt(flex.AsFlex)} ซม.²`, print: true });
  } else {
    steps.push(
      { label: "d′", formula: 'ระยะผิวอัด → centroid เหล็กรับอัด', value: `${fmt(dC)} ซม.` },
      { label: 'As', formula: 'M > Mc → Mc/(fs·j·d) + (M−Mc)/(fs·(d−d′))', value: `${fmt(flex.AsFlex)} ซม.²`, print: true },
      { label: "fs′", formula: "2fs(k − d′/d)/(1−k) ≤ fs", value: `${fmt(flex.fsPrime, 0)} ksc` },
      { label: "A′s", formula: "(M−Mc) / (fs′·(d−d′))", value: `${fmt(flex.AsPrimeReq)} ซม.²`, print: true },
    );
  }
  steps.push(
    { label: 'As,min', formula: '14·b·d / fy', value: `${fmt(flex.AsMin)} ซม.²` },
    { label: 'v', formula: 'V / (b·d)', value: `${fmt(shear.v)} ksc`, print: true },
    { label: 'vt', formula: '3T / Σx²y', value: `${fmt(shear.vt)} ksc`, print: true },
  );
  if (shear.torsionNeglected) {
    steps.push({ label: 'แรงบิด', formula: `vt ≤ 0.22√f′c = ${fmt(shear.vtNeglectLimit)}`, value: 'ละเลยได้', print: true });
    steps.push({ label: 'vc', formula: '0.29√f′c', value: `${fmt(shear.vc)} ksc`, print: true });
  } else {
    steps.push(
      { label: 'vc', formula: '0.29√f′c / √(1+(vt/1.2v)²)', value: `${fmt(shear.vc)} ksc`, print: true },
      { label: 'vtc', formula: '0.35√f′c / √(1+(1.2v/vt)²)', value: `${fmt(shear.vtc)} ksc`, print: true },
      { label: 'At/s', formula: '(vt−vtc)·Σx²y / (3·αt·x1·y1·fv)', value: `${fmt(shear.ats, 4)} ซม.²/ซม.` },
      { label: 'Al', formula: 'max(2At(x1+y1)/s, Al,min)', value: `${fmt(shear.Al)} ซม.²`, print: true },
    );
  }
  steps.push(
    { label: 'Av/s', formula: '(v − vc)·b / fv', value: `${fmt(shear.avs, 4)} ซม.²/ซม.` },
    {
      label: 's ต้องการ',
      formula: layout.stirrup.count === 1 ? '2Ab / (Av/s + 2At/s)' : '4Ab / (Av/s + 4At/s)',
      value: Number.isFinite(stirrupCap.sStrength) ? `${fmt(stirrupCap.sStrength, 1)} ซม.` : 'ไม่จำกัด',
      print: true,
    },
    { label: 'kd', formula: 'แกนสะเทิน (transformed section)', value: stress.valid ? `${fmt(stress.kd)} ซม.` : '—' },
  );

  return {
    key, tensionFace, compressionFace, params: p, geom, dT, dC, flex, shear, stirrupCap, stress,
    req, provided, checks, steps, status: worstStatus(checks),
  };
}
