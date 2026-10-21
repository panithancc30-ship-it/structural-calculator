import { ACI318_WSD_SLAB as K } from '../codes/aci318Wsd';
import { otherDir } from '../footing/geometry';
import type { BarDir } from '../footing/types';
import { REBARS } from '../rebar';
import type { BarRun, SlabDims, SlabInput, SlabLayout } from './types';

/**
 * แบบขยายพื้น S1 — พื้นทางเดียวและพื้นสองทางออกแบบและเขียนแบบตามรูปนี้รูปเดียว
 *
 * รูปตัดตามช่วงสั้น (Short Span) ระหว่างศูนย์กลางคาน:
 * - เหล็กคอม้าเว้นเส้น: อยู่ล่างกลางช่วงครบทุกเส้น ทุกเส้นเว้นเส้นงอขึ้นที่ L/5 จากศูนย์กลางคาน
 *   แล้ววิ่งผ่านคานไปเป็นเหล็กบน → As+ กลางช่วงได้เต็มชุด เหล็กบนที่ขอบได้ครึ่งชุด
 * - เหล็กเสริมพิเศษ: เหล็กบนที่ขอบ ยื่น L/4 จากศูนย์กลางคาน → As− ที่ขอบ = คอม้า/2 + เสริมพิเศษ
 * - เหล็กทิศตั้งฉาก (เห็นเป็นจุด): พื้นทางเดียวเป็นเหล็กกันร้าว ส่วนพื้นสองทางเป็นเหล็กด้านยาว
 *   ที่เสริมแบบเดียวกัน (คอม้าเว้นเส้น และใช้เหล็กเสริมพิเศษชุดเดียวกับด้านสั้น)
 */
export const usesDetailS1 = (input: Pick<SlabInput, 'slabType'>) =>
  input.slabType === 'oneWay' || input.slabType === 'twoWay';

/** ทิศของรูปตัดในแบบ (ช่วงสั้น) — พื้นทางเดียวพาดทิศ x เสมอ */
export function detailDir(input: Pick<SlabInput, 'slabType' | 'lx' | 'ly'>): BarDir {
  return input.slabType === 'twoWay' && input.ly < input.lx ? 'y' : 'x';
}

/** ทิศที่เสริมคอม้าเว้นเส้น + เสริมพิเศษ — พื้นสองทางทั้งสองทิศ พื้นทางเดียวเฉพาะทิศที่พาด */
export const crankDirs = (input: Pick<SlabInput, 'slabType'>): BarDir[] =>
  input.slabType === 'twoWay' ? ['x', 'y'] : ['x'];

export interface SlabDetail {
  /** ทิศของรูปตัด (เส้นในรูป) และทิศที่เห็นเป็นจุด */
  dir: BarDir;
  cross: BarDir;
  cranked: BarDir[];
  /** L ของระยะตัดเหล็กในแบบ = ช่วงสั้น (ซม.) */
  L: number;
  /** เหล็กเสริมพิเศษยื่น L/4 และคอม้างอขึ้นที่ L/5 จากศูนย์กลางคาน (ซม.) */
  cutoff: number;
  bend: number;
}

export function slabDetail(input: SlabInput, dims: Pick<SlabDims, 'lx' | 'ly'>): SlabDetail {
  const dir = detailDir(input);
  const L = dir === 'x' ? dims.lx : dims.ly;
  return {
    dir,
    cross: otherDir(dir),
    cranked: crankDirs(input),
    L,
    cutoff: L / K.detailTopCutoff,
    bend: L / K.detailBend,
  };
}

/** ปริมาณเหล็กต่อความกว้าง 1 ม. (ซม.²/ม.) */
export const runArea = (run: BarRun | null) => (run ? (100 / run.spacing) * REBARS[run.size].area : 0);

/** เหล็กบนที่ขอบ = คอม้าที่งอขึ้นเว้นเส้น (ครึ่งชุด) + เสริมพิเศษ (ซม.²/ม.) */
export const topAtSupport = (layout: SlabLayout, dir: BarDir) =>
  runArea(layout.bottom[dir]) / 2 + runArea(layout.top[dir]);

/** ระยะเรียงเฉลี่ยของเหล็กบนที่ขอบ (คอม้าที่ระยะ 2s สลับกับเสริมพิเศษ) — null เมื่อไม่มีเหล็กบน */
export function topSpacingAtSupport(layout: SlabLayout, dir: BarDir): number | null {
  const crank = layout.bottom[dir];
  const extra = layout.top[dir];
  const perMeter = (crank ? 100 / (2 * crank.spacing) : 0) + (extra ? 100 / extra.spacing : 0);
  return perMeter > 0 ? 100 / perMeter : null;
}

/**
 * คอม้าที่งอขึ้นกับเสริมพิเศษวางระดับเดียวกันที่ผิวบน — ใช้เส้นที่ใหญ่กว่ากำหนดความลึกประสิทธิผล
 * คืน layout ที่แทนเหล็กบนของทิศที่มีคอม้าด้วยขนาดนั้น เพื่อส่งต่อให้ slabGeometry
 */
export function detailDepthLayout(input: SlabInput, layout: SlabLayout): SlabLayout {
  const top = { ...layout.top };
  for (const dir of crankDirs(input)) {
    const sizes = [layout.bottom[dir], layout.top[dir]].filter((r): r is BarRun => r !== null);
    if (sizes.length === 0) continue;
    const size = sizes.reduce((a, b) => (REBARS[b.size].dia > REBARS[a.size].dia ? b : a)).size;
    top[dir] = { size, spacing: layout.top[dir]?.spacing ?? layout.bottom[dir]!.spacing };
  }
  return { ...layout, top };
}
