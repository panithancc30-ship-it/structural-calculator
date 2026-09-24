import { columnGeometry, type ColumnGeometry } from '@/engine/concrete/column/geometry';
import type { ColumnInput, ColumnLayout } from '@/engine/concrete/column/types';
import { cmToM } from '@/engine/concrete/format';
import { barGroupText, SCALES, textWidth } from '../drawing/drawingModel';

export type ColumnPick = { kind: 'bar'; barId: string } | { kind: 'tie' };

export interface ColumnLabel {
  key: string;
  text: string;
  ax: number;
  ay: number;
  y: number;
  dot: boolean;
  target: ColumnPick;
}

/** พิกัด SVG: x เดิม, y กลับทิศ (svgY = −y) — หน่วย ซม. */
export interface ColumnDrawingModel {
  denom: number;
  u: number;
  circle: boolean;
  halfW: number;
  halfH: number;
  geom: ColumnGeometry;
  labels: ColumnLabel[];
  elbowX: number;
  labelX: number;
  font: number;
  titleFont: number;
  subFont: number;
  title: string;
  titleW: number;
  subText: string;
  hookLen: number;
  dimX: number;
  dimY: number;
  titleY: number;
  subY: number;
  view: { x: number; y: number; w: number; h: number };
  sizeMm: { w: number; h: number };
}

export function transverseText(layout: ColumnLayout): string {
  return layout.kind === 'circle'
    ? `เกลียว ${layout.tie.size} ระยะ ${cmToM(layout.tie.spacing)}`
    : `ปลอก ${layout.tie.size} @ ${cmToM(layout.tie.spacing)}`;
}

export function buildColumnDrawing(
  input: ColumnInput,
  layout: ColumnLayout,
  denom: number,
  title: string,
  subtitle: string,
): ColumnDrawingModel {
  const geom = columnGeometry(input, layout);
  const circle = layout.kind === 'circle';
  const halfW = circle ? input.D / 2 : input.b / 2;
  const halfH = circle ? input.D / 2 : input.h / 2;
  const u = denom / 10;
  const font = 2.5 * u;
  const titleFont = 3.6 * u;
  const subFont = 2.3 * u;
  const gap = font * 1.3;

  const labels: ColumnLabel[] = [];
  if (geom.bars.length > 0) {
    const target = geom.bars.reduce((a, b) => (b.x + b.y > a.x + a.y ? b : a));
    labels.push({
      key: 'bars', text: barGroupText(geom.bars.map((b) => b.size)),
      ax: target.x, ay: -target.y, y: -target.y - 3.2 * u, dot: false,
      target: { kind: 'bar', barId: target.id },
    });
  }
  if (circle) {
    const k = Math.SQRT1_2 * geom.spiralR!;
    labels.push({ key: 'tie', text: transverseText(layout), ax: k, ay: k, y: k, dot: true, target: { kind: 'tie' } });
  } else {
    const t = geom.tieRect!;
    labels.push({ key: 'tie', text: transverseText(layout), ax: t.hx, ay: t.hy * 0.35, y: t.hy * 0.35, dot: true, target: { kind: 'tie' } });
    const ct = geom.crossTies[0];
    if (ct) {
      const ax = ct.dir === 'vertical' ? ct.pos : t.hx * 0.5;
      const ay = ct.dir === 'vertical' ? t.hy * 0.7 : -ct.pos;
      labels.push({
        key: 'cross', text: `เหล็กถ่าง ${layout.tie.size} @ ${cmToM(layout.tie.spacing)}`,
        ax, ay, y: Math.max(ay, t.hy * 0.7), dot: true, target: { kind: 'tie' },
      });
    }
  }
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y < labels[i - 1].y + gap) labels[i].y = labels[i - 1].y + gap;
  }

  const elbowX = halfW + 3 * u;
  const labelX = halfW + 4.6 * u;
  const maxLabelW = Math.max(0, ...labels.map((l) => textWidth(l.text, font)));
  const titleW = textWidth(title, titleFont);
  const subText = `${subtitle}   SCALE 1:${denom}`;
  const titleHalf = Math.max(titleW, textWidth(subText, subFont)) / 2;
  const dimX = -halfW - 5 * u;
  const dimY = halfH + 5 * u;
  const titleY = halfH + 13 * u;
  const subY = titleY + 4.2 * u;

  const minX = Math.min(dimX - font - 1.5 * u, -titleHalf - u);
  const maxX = Math.max(labelX + maxLabelW + u, titleHalf + u);
  const minY = Math.min(-halfH - 5 * u, (labels[0]?.y ?? 0) - font - 0.5 * u);
  const maxY = Math.max(subY + 1.5 * u, (labels[labels.length - 1]?.y ?? 0) + u);
  const view = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  return {
    denom, u, circle, halfW, halfH, geom, labels, elbowX, labelX, font, titleFont, subFont,
    title, titleW, subText, hookLen: Math.max(6 * geom.ds, 5), dimX, dimY, titleY, subY, view,
    sizeMm: { w: (view.w * 10) / denom, h: (view.h * 10) / denom },
  };
}

export function pickColumnScale(input: ColumnInput, layout: ColumnLayout, title: string, boxW = 86, boxH = 100): number {
  for (const denom of SCALES) {
    const m = buildColumnDrawing(input, layout, denom, title, 'เสาปลอกเดี่ยว');
    if (m.sizeMm.w <= boxW && m.sizeMm.h <= boxH) return denom;
  }
  return SCALES[SCALES.length - 1];
}
