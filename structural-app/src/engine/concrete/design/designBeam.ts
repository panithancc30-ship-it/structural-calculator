import { ACI318_WSD as C } from '../codes/aci318Wsd';
import { MAIN_BAR_SIZES, REBARS, type BarName } from '../rebar';
import { fmt } from '../format';
import { faceArea, layoutSignature, makeLayer, newId } from '../layoutOps';
import type { BeamInput, CalcStep, CheckItem, SectionKey, SectionLayout, SideBarRow } from '../types';
import { geoBase, layerCapacity, splitIntoLayers } from './barLayout';
import { wsdParams, type WsdParams } from './flexure';
import { analyzeSection, type SectionAnalysis, type SectionContext } from './sectionCheck';
import { shearTorsionDemand } from './shearTorsion';
import { chooseStirrup, type StirrupChoice } from './stirrupConfig';

function sideRows(input: BeamInput, AsSide: number, stirrupDia: number): SideBarRow[] {
  if (AsSide <= 0) return [];
  const mainDia = REBARS[input.mainBar].dia;
  const clearHeight = input.h - 2 * (input.cover + stirrupDia) - 2 * mainDia;
  const rows = Math.max(1, Math.ceil(clearHeight / C.torsionSpacingMax) - 1);
  const candidates = MAIN_BAR_SIZES.filter((s) => REBARS[s].dia >= 1.2);
  const size: BarName = candidates.find((s) => 2 * rows * REBARS[s].area >= AsSide) ?? input.mainBar;
  const count = Math.max(rows, Math.ceil(AsSide / (2 * REBARS[size].area)));
  return Array.from({ length: count }, () => ({ id: newId('S'), size }));
}

export interface AutoLayoutResult {
  layout: SectionLayout;
  stirrup: StirrupChoice;
}

/** ออกแบบรูปแบบเหล็กอัตโนมัติ — วนซ้ำจน d, จำนวนเหล็ก และปลอก ลู่เข้า */
export function autoLayoutDetailed(input: BeamInput, key: SectionKey, ctx: SectionContext = {}): AutoLayoutResult {
  const main = input.mainBar;
  const mainSpec = REBARS[main];
  let layout: SectionLayout = {
    top: [makeLayer(2, main)],
    bottom: [makeLayer(2, main)],
    side: [],
    stirrup: { size: input.stirrupBar, count: input.stirrupMode === 'double' ? 2 : 1, spacing: 20 },
  };
  const seen = new Set<string>([layoutSignature(layout)]);
  let choice: StirrupChoice | null = null;

  for (let iter = 0; iter < 15; iter++) {
    const a = analyzeSection(input, key, layout, ctx);
    choice = chooseStirrup(input, (size) => shearTorsionDemand(input, a.params, a.dT, REBARS[size].dia));
    const stirrup = choice.spec;
    const minBars = stirrup.count === 2 ? 4 : 2;
    const need = (req: number) => (Number.isFinite(req) ? Math.ceil(req / mainSpec.area - 1e-6) : minBars);
    const nT = Math.max(minBars, need(a.req.AsTension));
    const nC = Math.max(minBars, need(a.req.AsCompression));

    const g = geoBase(input, stirrup, mainSpec.dia);
    const cap0 = layerCapacity(g, mainSpec.dia, 0);
    const capN = layerCapacity(g, mainSpec.dia, 1);
    const layersFor = (n: number) => splitIntoLayers(n, cap0, capN, minBars).map((c) => makeLayer(c, main));

    const next: SectionLayout = {
      top: layersFor(a.tensionFace === 'top' ? nT : nC),
      bottom: layersFor(a.tensionFace === 'bottom' ? nT : nC),
      side: sideRows(input, a.req.AsSide, REBARS[stirrup.size].dia),
      stirrup,
    };
    const sig = layoutSignature(next);
    if (sig === layoutSignature(layout) || seen.has(sig)) return { layout: next, stirrup: choice };
    seen.add(sig);
    layout = next;
  }
  return { layout, stirrup: choice! };
}

export function autoLayout(input: BeamInput, key: SectionKey, ctx: SectionContext = {}): SectionLayout {
  return autoLayoutDetailed(input, key, ctx).layout;
}

export function designBeam(input: BeamInput): Record<SectionKey, SectionLayout> {
  const A = autoLayout(input, 'A');
  const B = autoLayout(input, 'B', { bottomAsAtA: faceArea(A, 'bottom') });
  return { A, B };
}

export interface BeamAnalysis {
  params: WsdParams;
  paramSteps: CalcStep[];
  beamChecks: CheckItem[];
  A: SectionAnalysis;
  B: SectionAnalysis;
  /** คำแนะนำเหล็กปลอก (ถ้าออกแบบอัตโนมัติแล้วยังก่อสร้างยาก) */
  stirrupNotes: Record<SectionKey, string | null>;
}

export function minDepth(input: BeamInput): number {
  const factor = 0.4 + input.fy / C.minDepthFyDivisor;
  return ((input.L * 100) / C.minDepthDivisor[input.support]) * factor;
}

/**
 * ตรวจสอบคานทั้งสองหน้าตัด
 * @param sections ข้อมูลนำเข้าแยกตามหน้าตัด เมื่อ M, V, T ต่างกัน (คานรับพื้นยื่น) — ปกติใช้ input เดียวกัน
 */
export function analyzeBeam(
  input: BeamInput,
  layouts: Record<SectionKey, SectionLayout>,
  sections: Record<SectionKey, BeamInput> = { A: input, B: input },
): BeamAnalysis {
  const params = wsdParams(input.fc, input.fy, input.fyv);
  const A = analyzeSection(sections.A, 'A', layouts.A);
  const B = analyzeSection(sections.B, 'B', layouts.B, { bottomAsAtA: faceArea(layouts.A, 'bottom') });

  const hMin = minDepth(input);
  const beamChecks: CheckItem[] = [
    {
      id: 'beam-hmin',
      group: 'beam',
      label: `ความลึกขั้นต่ำ L/${C.minDepthDivisor[input.support]} (ซม.)`,
      required: `≥ ${fmt(hMin, 1)}`,
      provided: fmt(input.h, 1),
      status: input.h + 1e-6 >= hMin ? 'ok' : 'warn',
    },
  ];

  const paramSteps: CalcStep[] = [
    { label: 'Ec', formula: '15,100√f′c', value: `${fmt(params.Ec, 0)} ksc` },
    { label: 'n', formula: 'Es / Ec (ปัดเศษ)', value: `${params.n}`, print: true },
    { label: 'fc', formula: '0.45f′c', value: `${fmt(params.fcAllow, 1)} ksc`, print: true },
    { label: 'fs', formula: '0.5fy ≤ 1,700', value: `${fmt(params.fsAllow, 0)} ksc`, print: true },
    { label: 'fv', formula: '0.5fy(ปลอก) ≤ 1,700', value: `${fmt(params.fvAllow, 0)} ksc`, print: true },
    { label: 'k', formula: '1 / (1 + fs/(n·fc))', value: fmt(params.k, 3), print: true },
    { label: 'j', formula: '1 − k/3', value: fmt(params.j, 3), print: true },
    { label: 'R', formula: '½·fc·k·j', value: `${fmt(params.R, 2)} ksc`, print: true },
  ];

  const noteFor = (a: SectionAnalysis) => {
    const sec = sections[a.key];
    const choice = chooseStirrup(sec, (size) => shearTorsionDemand(sec, a.params, a.dT, REBARS[size].dia));
    return choice.constructible ? null : choice.suggestion;
  };

  return { params, paramSteps, beamChecks, A, B, stirrupNotes: { A: noteFor(A), B: noteFor(B) } };
}
