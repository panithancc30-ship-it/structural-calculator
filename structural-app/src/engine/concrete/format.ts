export function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** ระยะ ซม. → ข้อความเมตรแบบแบบก่อสร้าง เช่น 15 → "0.15", 12.5 → "0.125" */
export function cmToM(cm: number): string {
  const m = (cm / 100).toFixed(3);
  return m.endsWith('0') ? m.slice(0, -1) : m;
}
