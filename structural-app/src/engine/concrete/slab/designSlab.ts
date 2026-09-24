import { ACI318_WSD as C, ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import { wsdParams } from '../design/flexure';
import { asMinRatio } from '../footing/analyzeFooting';
import type { BarDir } from '../footing/types';
import { ALL_BAR_SIZES, REBARS, type BarName } from '../rebar';
import type { Face } from '../types';
import { minThickness } from './analyzeSlab';
import { DIRS, FACES, slabGeometry, spanOf, supportConditionOf } from './geometry';
import { slabLoads, stripMoments, stripShear } from './loads';
import type { BarRun, SlabDims, SlabInput, SlabLayout } from './types';

const STRIP = 100;

const ceilStep = (v: number) => Math.ceil(v / K.sizeStep - 1e-9) * K.sizeStep;

/**
 * โมเมนต์และแรงเฉือนของแถบแต่ละทิศที่ความหนาหนึ่ง ๆ
 * แยกออกมาเพราะทั้งการหาความหนาและการเลือกเหล็กต้องใช้ชุดเดียวกัน
 */
function demandAt(input: SlabInput, t: number) {
  const loads = slabLoads(input, t);
  const flexural = input.slabType !== 'onGround';
  return DIRS.map((dir) => {
    const span = spanOf({ lx: input.lx, ly: input.ly }, dir);
    const support = supportConditionOf(input, dir);
    const w = loads.share[dir];
    const active = flexural && w > 0;
    const m = active
      ? stripMoments(w, span, support)
      : { pos: 0, negEnd: 0, negInt: 0, divisors: { pos: null, negEnd: null, negInt: null } };
    return {
      dir,
      M: { bottom: m.pos, top: Math.max(m.negEnd, m.negInt) } as Record<Face, number>,
      V: active ? stripShear(w, span, support) : 0,
    };
  });
}

/** ความหนานี้ผ่านเกณฑ์คอนกรีต (โมเมนต์ที่รับได้ และเฉือนทางเดียว) หรือไม่ */
function thicknessOk(input: SlabInput, t: number): boolean {
  if (t < minThickness(input, { lx: input.lx, ly: input.ly }).required - 1e-9) return false;
  // พื้นวางบนดินถ่ายน้ำหนักลงดินโดยตรง ไม่มีโมเมนต์ดัดให้ตรวจ ความหนาจึงคุมด้วยการใช้งานอย่างเดียว
  if (input.slabType === 'onGround') return true;

  const p = wsdParams(input.fc, input.fy, input.fy);
  // ประมาณความลึกประสิทธิผลด้วยเหล็กที่ผู้ใช้เลือก ชั้นนอกสุดของผิวนั้น
  const dia = REBARS[input.bar].dia;
  const d = t - input.cover - dia / 2;
  if (d < K.minEffectiveDepth) return false;

  const vc = K.oneWayVcCoef * Math.sqrt(input.fc);
  for (const { M, V } of demandAt(input, t)) {
    const Mmax = Math.max(M.bottom, M.top);
    if (Mmax > p.R * STRIP * d * d * (1 + 1e-9)) return false;
    if (V / (STRIP * d) > vc * (1 + 1e-9)) return false;
  }
  return true;
}

let cache: { key: string; dims: SlabDims } | null = null;

/** หาความหนาที่บางที่สุดที่ยังผ่านทุกเกณฑ์ */
export function autoSlabDims(input: SlabInput): SlabDims {
  const key = JSON.stringify(input);
  if (cache?.key === key) return cache.dims;

  const start = ceilStep(Math.max(K.absMinThickness[input.slabType], minThickness(input, input).required));
  let t = start;
  // ช่วงค้นหาสั้น (8–40 ซม. ทีละ 2.5) จึงไล่ตรงไปข้างหน้าได้ ไม่ต้องแบ่งครึ่ง
  while (t < K.autoMaxThickness && !thicknessOk(input, t)) t += K.sizeStep;

  const dims: SlabDims = { lx: input.lx, ly: input.ly, t };
  cache = { key, dims };
  return dims;
}

export function slabDims(input: SlabInput): SlabDims {
  return input.thicknessMode === 'manual'
    ? { lx: input.lx, ly: input.ly, t: input.t }
    : autoSlabDims(input);
}

/** ปัดระยะเรียงลงให้เป็นพหุคูณของโมดูลก่อสร้าง */
const floorSpacing = (s: number) => Math.floor(s / K.spacingStep + 1e-9) * K.spacingStep;

/**
 * เลือกขนาดและระยะเรียงของเหล็กหนึ่งชุด
 *
 * ไล่จากขนาดที่ผู้ใช้เลือกขึ้นไปก่อน แล้ววนกลับลงมา — แบบเดียวกับ pick() ของฐานราก
 * ระยะเรียงปัดลงเสมอ เพื่อให้ As ที่ใส่จริงไม่น้อยกว่าที่ต้องการ
 */
export function pickRun(
  candidates: BarName[],
  AsReq: number,
  sMax: number,
  tForDepth: { t: number; cover: number; behind: number; fsjRequired: ((d: number) => number) | null; minDepth: number },
): BarRun | null {
  if (AsReq <= 0) return null;
  let fallback: BarRun | null = null;

  for (const size of candidates) {
    const { dia, area } = REBARS[size];
    // As ที่ต้องการขึ้นกับ d ซึ่งขึ้นกับขนาดเหล็ก จึงคำนวณใหม่ทุกขนาด
    const d = tForDepth.t - tForDepth.cover - tForDepth.behind - dia / 2;
    if (d < tForDepth.minDepth) continue;
    const need = Math.max(AsReq, tForDepth.fsjRequired ? tForDepth.fsjRequired(d) : 0);
    if (need <= 0) continue;

    const raw = (STRIP * area) / need;
    const spacing = Math.min(floorSpacing(raw), sMax);
    if (spacing < K.minSpacing) continue;
    // ช่องว่างระหว่างเหล็กต้องพอเทคอนกรีต
    if (spacing - dia < Math.max(dia, C.minClearSpacing) - 1e-9) continue;

    const run = { size, spacing };
    fallback ??= run;
    return run;
  }
  return fallback;
}

/** ไล่จากขนาดที่ผู้ใช้เลือกขึ้นไปก่อน แล้ววนกลับลงมา — รายการมีทั้งเหล็กกลม RB และเหล็กข้ออ้อย DB */
export function candidatesFrom(pick: BarName): BarName[] {
  const start = Math.max(0, ALL_BAR_SIZES.indexOf(pick));
  return [...ALL_BAR_SIZES.slice(start), ...ALL_BAR_SIZES.slice(0, start).reverse()];
}

/** จัดเหล็กทั้งสองผิวสองทิศให้อัตโนมัติ */
export function autoSlabLayout(input: SlabInput, dims: SlabDims): SlabLayout {
  const p = wsdParams(input.fc, input.fy, input.fy);
  const demands = demandAt(input, dims.t);
  const rho = asMinRatio(input.fy);
  const flexural = input.slabType !== 'onGround';
  const AsTemp = rho * STRIP * dims.t;

  const mainCandidates = candidatesFrom(input.bar);
  const tempCandidates = candidatesFrom(input.tempBar);

  // ทิศที่รับโมเมนต์มากกว่าได้อยู่ชั้นนอก (d มากกว่า) ของแต่ละผิว
  const outerLayer = {} as Record<Face, BarDir>;
  for (const face of FACES) {
    const [mx, my] = DIRS.map((dir) => demands.find((x) => x.dir === dir)!.M[face]);
    outerLayer[face] = mx >= my ? 'x' : 'y';
  }

  const bottom = { x: null, y: null } as Record<BarDir, BarRun | null>;
  const top = { x: null, y: null } as Record<BarDir, BarRun | null>;

  for (const face of FACES) {
    const target = face === 'bottom' ? bottom : top;
    for (const dir of DIRS) {
      const M = demands.find((x) => x.dir === dir)!.M[face];
      const outer = outerLayer[face] === dir;
      const behindDia = outer ? 0 : REBARS[input.bar].dia;

      if (M > 0) {
        target[dir] = pickRun(mainCandidates, 1, Math.min(K.maxSpacingFactor * dims.t, K.maxSpacing), {
          t: dims.t,
          cover: input.cover,
          behind: behindDia,
          fsjRequired: (d) => Math.max(M / (p.fsAllow * p.j * d), AsTemp),
          minDepth: K.minEffectiveDepth,
        });
        continue;
      }

      // ไม่มีโมเมนต์ → เหล็กกันร้าว/เหล็กกระจาย
      // ใส่ที่ผิวล่างเสมอ และใส่ผิวใดก็ตามที่อีกทิศมีเหล็กรับดัดอยู่ (เหล็กกระจายต้องอยู่ผิวเดียวกัน)
      // พื้นวางบนดินใช้ตะแกรงชั้นเดียวตามงานจริง ถ้าใส่สองผิวด้วยระยะหุ้มหล่อติดดิน 7.5 ซม.
      // เหล็กสองผิวจะไขว้กันในพื้นบาง
      const otherDirHasMain = demands.find((x) => x.dir !== dir)!.M[face] > 0;
      const needTemp = face === 'bottom' || otherDirHasMain;
      target[dir] = needTemp
        ? pickRun(tempCandidates, AsTemp, Math.min(K.tempSpacingFactor * dims.t, K.maxSpacing), {
            t: dims.t,
            cover: input.cover,
            behind: behindDia,
            fsjRequired: null,
            minDepth: flexural ? K.minEffectiveDepth : 0,
          })
        : null;
    }
  }

  const layout: SlabLayout = { bottom, top, outerLayer };
  // ปรับชั้นนอกให้ตรงกับเหล็กที่ใส่จริง เผื่อผิวใดมีเหล็กทิศเดียว
  for (const face of FACES) {
    const runs = layout[face];
    if (!runs[outerLayer[face]] && runs[outerLayer[face] === 'x' ? 'y' : 'x']) {
      layout.outerLayer[face] = outerLayer[face] === 'x' ? 'y' : 'x';
    }
  }
  // ให้ความลึกประสิทธิผลคำนวณได้เสมอ แม้ผิวใดยังไม่มีเหล็ก
  slabGeometry(input.cover, dims.t, layout);
  return layout;
}
