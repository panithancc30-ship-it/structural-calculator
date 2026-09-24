/** แปลงหน้าตัด → องค์ประกอบรูป (หน่วย ซม. ตามจริง) + เลือกมาตราส่วนให้พอดีกรอบกระดาษ */
import { computeGeometry, type SectionGeometry } from '../../domain/design/barLayout';
import { stirrupText } from '../../domain/design/stirrupConfig';
import { REBARS, type BarName } from '../../domain/rebar';
import type { BeamInput, Face, SectionKey, SectionLayout } from '../../domain/types';
import { SECTION_TITLES } from '../labels';

export const SCALES = [10, 15, 20, 25, 30, 40, 50] as const;
export const DRAWING_FONT = "Sarabun, Tahoma, 'Leelawadee UI', sans-serif";

export type DrawingPick =
  | { kind: 'bar'; face: Face; layerId: string; barId: string }
  | { kind: 'side'; rowId: string }
  | { kind: 'stirrup' };

export interface DrawingLabel {
  key: string;
  text: string;
  /** จุดเริ่มเส้นชี้ */
  ax: number;
  ay: number;
  /** ระดับบรรทัดป้าย */
  y: number;
  dot: boolean;
  target: DrawingPick;
}

export interface DrawingModel {
  denom: number;
  /** ตัวคูณขนาดตัวอักษร/เส้น ให้คงที่บนกระดาษ (1 ที่มาตราส่วน 1:10) */
  u: number;
  b: number;
  h: number;
  geom: SectionGeometry;
  labels: DrawingLabel[];
  elbowX: number;
  labelX: number;
  font: number;
  titleFont: number;
  subFont: number;
  title: string;
  titleW: number;
  subText: string;
  hookLen: number;
  dimHX: number;
  dimBY: number;
  titleY: number;
  subY: number;
  view: { x: number; y: number; w: number; h: number };
  sizeMm: { w: number; h: number };
}

export function barGroupText(sizes: BarName[]): string {
  const counts = new Map<BarName, number>();
  for (const s of sizes) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => REBARS[b[0]].dia - REBARS[a[0]].dia)
    .map(([s, c]) => `${c}-${s}`)
    .join(' + ');
}

const THAI_COMBINING = /[ัิ-ฺ็-๎]/;
const THAI = /[฀-๿]/;

/** ประมาณความกว้างข้อความ (ใช้คำนวณขอบรูป) */
export function textWidth(text: string, font: number): number {
  let w = 0;
  for (const ch of text) {
    if (THAI_COMBINING.test(ch)) continue;
    if (THAI.test(ch)) w += 0.56;
    else if (ch === ' ') w += 0.28;
    else if (/[.,@:()\-+]/.test(ch)) w += 0.36;
    else if (/[A-Z0-9]/.test(ch)) w += 0.63;
    else w += 0.52;
  }
  return w * font;
}

export function buildDrawingModel(
  input: BeamInput,
  layout: SectionLayout,
  denom: number,
  title: string,
  subtitle: string,
): DrawingModel {
  const geom = computeGeometry(input, layout);
  const { b, h } = input;
  const u = denom / 10;
  const font = 2.5 * u;
  const titleFont = 3.6 * u;
  const subFont = 2.3 * u;
  const gap = font * 1.3;
  const { outer } = geom;

  const labels: DrawingLabel[] = [];
  for (const face of ['top', 'bottom'] as const) {
    for (const layer of layout[face]) {
      const bars = geom.bars.filter((bar) => bar.face === face && bar.layerId === layer.id);
      if (bars.length === 0) continue;
      const anchor = bars.reduce((a, bar) => (bar.x > a.x ? bar : a));
      labels.push({
        key: layer.id,
        text: barGroupText(bars.map((bar) => bar.size)),
        ax: anchor.x,
        ay: anchor.y,
        y: face === 'top' ? anchor.y - 3.2 * u : anchor.y + 3.2 * u,
        dot: false,
        target: { kind: 'bar', face, layerId: layer.id, barId: anchor.id },
      });
    }
  }

  const sideAll = geom.bars.filter((bar) => bar.face === 'side');
  const sideRight = sideAll.filter((bar) => bar.id.endsWith('-R'));
  if (sideRight.length > 0) {
    const anchor = sideRight[Math.floor((sideRight.length - 1) / 2)];
    labels.push({
      key: 'side',
      text: `${barGroupText(sideAll.map((bar) => bar.size))} (เหล็กข้าง)`,
      ax: anchor.x,
      ay: anchor.y,
      y: anchor.y,
      dot: false,
      target: { kind: 'side', rowId: anchor.layerId },
    });
  }

  const stirrupLabel: DrawingLabel = {
    key: 'stirrup',
    text: `ปลอก ${stirrupText(layout.stirrup)}`,
    ax: outer.x + outer.w,
    ay: h / 2,
    y: h / 2 + (sideRight.length ? gap : 0),
    dot: true,
    target: { kind: 'stirrup' },
  };
  labels.push(stirrupLabel);

  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) {
    if (labels[i].y < labels[i - 1].y + gap) labels[i].y = labels[i - 1].y + gap;
  }
  stirrupLabel.ay = Math.min(outer.y + outer.h - outer.r, Math.max(outer.y + outer.r, stirrupLabel.y));

  const elbowX = b + 3 * u;
  const labelX = b + 4.6 * u;
  const maxLabelW = Math.max(...labels.map((l) => textWidth(l.text, font)));
  const titleW = textWidth(title, titleFont);
  const subText = `${subtitle}   SCALE 1:${denom}`;
  const halfTitle = Math.max(titleW, textWidth(subText, subFont)) / 2;

  const dimHX = -5 * u;
  const dimBY = h + 5 * u;
  const titleY = h + 13 * u;
  const subY = titleY + 4.2 * u;

  const minX = Math.min(dimHX - font - 1.5 * u, b / 2 - halfTitle - u);
  const maxX = Math.max(labelX + maxLabelW + u, b / 2 + halfTitle + u);
  const minY = Math.min(-2 * u, labels[0].y - font - 0.5 * u);
  const maxY = Math.max(subY + 1.5 * u, labels[labels.length - 1].y + u);
  const view = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  return {
    denom, u, b, h, geom, labels, elbowX, labelX, font, titleFont, subFont,
    title, titleW, subText,
    hookLen: Math.max(6 * outer.ds, 5),
    dimHX, dimBY, titleY, subY, view,
    sizeMm: { w: (view.w * 10) / denom, h: (view.h * 10) / denom },
  };
}

/** มาตราส่วนที่ใหญ่ที่สุดที่ทั้งสองหน้าตัดพอดีกรอบ (มม.) บนใบ A4 */
export function pickScale(input: BeamInput, layouts: Record<SectionKey, SectionLayout>, boxW = 86, boxH = 98): number {
  for (const denom of SCALES) {
    const fits = (['A', 'B'] as const).every((key) => {
      const t = SECTION_TITLES[key];
      const m = buildDrawingModel(input, layouts[key], denom, t.title, t.subtitle);
      return m.sizeMm.w <= boxW && m.sizeMm.h <= boxH;
    });
    if (fits) return denom;
  }
  return SCALES[SCALES.length - 1];
}
