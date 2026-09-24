/** รูปร่างเส้นศูนย์กลางเหล็กปลอก (พิกัด SVG, y ชี้ลง) */
export interface RoundedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export function roundedRectPath({ x, y, w, h, r }: RoundedRect): string {
  return (
    `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} ` +
    `A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} ` +
    `V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`
  );
}

/** ขอ 135° ที่มุมซ้ายบน — ปลายทั้งสองอ้อมเหล็กมุมแล้วชี้เข้าแกนหน้าตัด */
export function hookPath({ x, y, r }: RoundedRect, len: number): string {
  const cx = x + r;
  const cy = y + r;
  const k = Math.SQRT1_2;
  const l = len * k;
  return (
    `M${cx},${y} A${r},${r} 0 0 1 ${cx + r * k},${cy - r * k} l${l},${l} ` +
    `M${x},${cy} A${r},${r} 0 0 0 ${cx - r * k},${cy + r * k} l${l},${l}`
  );
}
