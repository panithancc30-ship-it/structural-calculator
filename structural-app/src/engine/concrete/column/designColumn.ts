import { ACI318_WSD_COLUMN as K } from '../codes/aci318Wsd';
import { newId } from '../layoutOps';
import { REBARS, type BarName } from '../rebar';
import type { Bar } from '../types';
import { analyzeColumn } from './analyzeColumn';
import { columnGeometry } from './geometry';
import { spiralRequirement, tieRequirement } from './transverse';
import type { CircleColumnLayout, ColumnInput, ColumnLayout, RectColumnLayout, TransverseSpec } from './types';

const bars = (count: number, size: BarName): Bar[] => Array.from({ length: count }, () => ({ id: newId('c'), size }));

/** เสาสี่เหลี่ยม n เส้น (คู่) กระจายรอบรูปตามสัดส่วนความยาวด้าน — สมมาตรบน/ล่าง ซ้าย/ขวา */
export function buildRectLayout(n: number, input: ColumnInput, tie: TransverseSpec): RectColumnLayout {
  const extraPairs = Math.max(0, Math.round((n - 4) / 2));
  const ix = Math.round((extraPairs * input.b) / (input.b + input.h));
  const iy = extraPairs - ix;
  return {
    kind: 'rect',
    corners: bars(4, input.mainBar),
    top: bars(ix, input.mainBar),
    bottom: bars(ix, input.mainBar),
    left: bars(iy, input.mainBar),
    right: bars(iy, input.mainBar),
    tie,
  };
}

export function buildCircleLayout(n: number, input: ColumnInput, tie: TransverseSpec): CircleColumnLayout {
  return { kind: 'circle', bars: bars(Math.max(n, K.minBarsSpiral), input.mainBar), tie };
}

function transverseFor(input: ColumnInput): TransverseSpec {
  const size: BarName = REBARS[input.tieBar].dia + 1e-9 >= K.tieMinDia ? input.tieBar : 'RB9';
  if (input.shape === 'circle') return { size, spacing: spiralRequirement(input, size).spacing };
  const probe = buildRectLayout(4, input, { size, spacing: 15 });
  return { size, spacing: tieRequirement(input, columnGeometry(input, probe), size).spacing };
}

/**
 * ออกแบบอัตโนมัติ: เพิ่มจำนวนเหล็กทีละขั้นจน ρg ≥ 1% และกำลังผ่าน
 * หยุดเมื่อระยะช่องว่างไม่พอ หรือ ρg เกิน 8% (ตารางตรวจสอบจะแสดงไม่ผ่าน)
 */
export function autoColumnLayout(input: ColumnInput): ColumnLayout {
  const tie = transverseFor(input);
  const circle = input.shape === 'circle';
  const start = circle ? K.minBarsSpiral : K.minBarsRect;
  const step = circle ? 1 : 2;
  const build = (n: number) => (circle ? buildCircleLayout(n, input, tie) : buildRectLayout(n, input, tie));

  let layout: ColumnLayout = build(start);
  for (let n = start; n <= 80; n += step) {
    layout = build(n);
    const geom = columnGeometry(input, layout);
    const rho = geom.Ast / geom.Ag;
    const spacingOk = geom.spacing.every((s) => s.ok);
    if (rho < K.rhoMin && spacingOk) continue;
    const a = analyzeColumn(input, layout);
    if (a.utilization <= 1 || !spacingOk || rho > K.rhoMax) break;
  }
  return layout;
}
