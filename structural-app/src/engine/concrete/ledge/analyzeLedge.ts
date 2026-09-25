import { ACI318_WSD_LEDGE as K } from '../codes/aci318Wsd';
import { analyzeBeam, autoLayout, type BeamAnalysis } from '../design/designBeam';
import { worstStatus } from '../design/sectionCheck';
import { fmt } from '../format';
import { faceArea } from '../layoutOps';
import type { BeamInput, CalcStep, CheckItem, CheckStatus, SectionKey, SectionLayout } from '../types';
import { ledgeLoads, type LedgeLoads } from './loads';
import type { LedgeBeamInput } from './types';

export type LedgeLayouts = Record<SectionKey, SectionLayout>;

/**
 * ข้อมูลนำเข้าของหน้าตัดคานที่ใช้ออกแบบ
 * A-A กลางคานรับ M+, B-B ใกล้เสารับ M− — ทั้งสองหน้าตัดใช้ V และ T ที่หน้าตัดวิกฤต (ปลอดภัยไว้ก่อน)
 */
export function ledgeSectionInputs(input: LedgeBeamInput, loads: LedgeLoads): Record<SectionKey, BeamInput> {
  const base: Omit<BeamInput, 'M'> = {
    b: input.b,
    h: input.h,
    L: input.L,
    cover: input.cover,
    fc: input.fc,
    fy: input.fy,
    fyv: input.fyv,
    V: loads.Vd,
    T: loads.Td,
    mainBar: input.mainBar,
    stirrupBar: input.stirrupBar,
    stirrupMode: input.stirrupMode,
    sMin: input.sMin,
    support: input.support,
    torsionMethod: 'eit',
  };
  return { A: { ...base, M: loads.Mpos }, B: { ...base, M: loads.Mneg } };
}

/** ออกแบบเหล็กอัตโนมัติของหน้าตัดที่ไม่ได้แก้เอง (B-B ขึ้นกับเหล็กล่างของ A-A) */
export function designLedge(
  input: LedgeBeamInput,
  prev: LedgeLayouts | null = null,
  edited: Record<SectionKey, boolean> = { A: false, B: false },
): LedgeLayouts {
  const sections = ledgeSectionInputs(input, ledgeLoads(input));
  const A = edited.A && prev ? prev.A : autoLayout(sections.A, 'A');
  const B = edited.B && prev ? prev.B : autoLayout(sections.B, 'B', { bottomAsAtA: faceArea(A, 'bottom') });
  return { A, B };
}

export interface LedgeAnalysis extends BeamAnalysis {
  loads: LedgeLoads;
  sections: Record<SectionKey, BeamInput>;
  /** ที่มาของน้ำหนักและแรงภายใน */
  loadSteps: CalcStep[];
  /** รายการตรวจสอบทั้งหมด (A-A, B-B และของคาน) */
  checks: CheckItem[];
  status: CheckStatus;
}

const num = (v: number, digits = 0) => fmt(v, digits);

function loadSteps(input: LedgeBeamInput, l: LedgeLoads): CalcStep[] {
  const steps: CalcStep[] = [
    {
      label: 'ws พื้นยื่น',
      formula: `2,400×${fmt(input.slabT / 100, 2)} + ${num(input.finishDL)} + ${num(input.LL)}`,
      value: `${num(l.slabTotal)} กก./ตร.ม.`,
      print: true,
    },
    {
      label: 'จากพื้นยื่น',
      formula: `ws·Lc = ${num(l.slabTotal)}×${fmt(input.slabLength, 2)}`,
      value: `${num(l.fromSlab)} กก./ม.`,
    },
  ];
  if (l.tipWall > 0) {
    steps.push({
      label: 'P ผนังปลายพื้น',
      formula: `${fmt(input.tipWallH, 2)} ม. × ${num(input.tipWallW)}`,
      value: `${num(l.tipWall)} กก./ม.`,
    });
  }
  if (l.beamWall > 0) {
    steps.push({
      label: 'ผนังบนคาน',
      formula: `${fmt(input.beamWallH, 2)} ม. × ${num(input.beamWallW)}`,
      value: `${num(l.beamWall)} กก./ม.`,
    });
  }
  steps.push({
    label: 'น้ำหนักคาน',
    formula: `2,400×${fmt(input.b / 100, 2)}×${fmt(input.h / 100, 2)}`,
    value: `${num(l.beamSelf)} กก./ม.`,
  });
  if (l.other > 0) {
    steps.push({ label: 'น้ำหนักอื่น', formula: 'ลงคานโดยตรง', value: `${num(l.other)} กก./ม.` });
  }

  const { pos, neg } = l.divisors;
  steps.push(
    { label: 'w', formula: 'น้ำหนักลงคานรวม', value: `${num(l.w)} กก./ม.`, print: true },
    {
      label: 't',
      formula: l.tipWall > 0 ? 'ws·Lc²/2 + P·Lc' : 'ws·Lc²/2',
      value: `${num(l.torque)} kg·m/m`,
      print: true,
    },
    neg === null
      ? { label: 'M+ / M−', formula: `w·L²/${pos} · ช่วงเดียวไม่มี M−`, value: `${num(l.Mpos)} / 0 kg·m`, print: true }
      : {
          label: 'M+ / M−',
          formula: `w·L²/${pos} · w·L²/${neg}`,
          value: `${num(l.Mpos)} / ${num(l.Mneg)} kg·m`,
          print: true,
        },
    { label: 'd', formula: 'h − covering − Ø ปลอก − Ø เหล็กยืน/2', value: `${fmt(l.dCrit, 1)} ซม.` },
    { label: 'V', formula: `${fmt(l.shearFactor, 3)}·w·L`, value: `${num(l.Vsupport)} kg` },
    { label: 'Vd', formula: 'V − w·d (ห่างที่รองรับ d)', value: `${num(l.Vd)} kg`, print: true },
    { label: 'T', formula: 't·L/2 (ปลายยึดไม่ให้บิด)', value: `${num(l.Tsupport)} kg·m` },
    { label: 'Td', formula: 't·(L/2 − d)', value: `${num(l.Td)} kg·m`, print: true },
  );
  return steps;
}

export function analyzeLedgeBeam(input: LedgeBeamInput, layouts: LedgeLayouts): LedgeAnalysis {
  const loads = ledgeLoads(input);
  const sections = ledgeSectionInputs(input, loads);
  const beam = analyzeBeam(sections.A, layouts, sections);

  const beamChecks = [...beam.beamChecks];
  if (loads.divisors.neg !== null) {
    const limit = K.liveToDeadLimit * (loads.w - loads.wLive);
    beamChecks.push({
      id: 'beam-ll-dl',
      group: 'beam',
      label: `น้ำหนักจร ≤ ${K.liveToDeadLimit} × คงที่ (สัมประสิทธิ์โมเมนต์) กก./ม.`,
      required: `≤ ${num(limit)}`,
      provided: num(loads.wLive),
      status: loads.wLive <= limit + 1e-6 ? 'ok' : 'warn',
    });
  }

  const checks = [...beam.A.checks, ...beam.B.checks, ...beamChecks];
  return {
    ...beam,
    beamChecks,
    loads,
    sections,
    loadSteps: loadSteps(input, loads),
    checks,
    status: worstStatus(checks),
  };
}
