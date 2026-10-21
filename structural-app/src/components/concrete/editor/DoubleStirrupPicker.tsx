import { DOUBLE_STIRRUP_TYPES, type DoubleStirrupType } from '@/engine/concrete/types';

export const DOUBLE_STIRRUP_TH: Record<DoubleStirrupType, { label: string; hint: string }> = {
  narrow: { label: 'ปลอกในแคบ', hint: 'คร่อมเหล็กกลาง — ชั้นแรกบน/ล่าง ≥ 4 เส้น' },
  layer2: { label: 'ปลอกในรัดชั้น 2', hint: 'เต็มความกว้าง — ชั้นที่ 2 บน/ล่าง ≥ 2 เส้น' },
};

/** รูปย่อหน้าตัดคาน 2 ปลอก — ปลอกนอกสีเทา ปลอกในสีเข้ม ให้เห็นความต่างของสองแบบ */
function Icon({ type }: { type: DoubleStirrupType }) {
  const bars =
    type === 'narrow'
      ? [6, 10.67, 15.33, 20].flatMap((x) => [[x, 6], [x, 34]])
      : [[6, 6], [13, 6], [20, 6], [6.9, 11], [19.1, 11], [6.9, 29], [19.1, 29], [6, 34], [13, 34], [20, 34]];
  return (
    <svg viewBox="0 0 26 40" width={20} height={30} aria-hidden="true">
      <rect x={1} y={1} width={24} height={38} fill="#fff" stroke="#94a3b8" strokeWidth={1} />
      <rect x={4.5} y={4.5} width={17} height={31} rx={2} fill="none" stroke="#64748b" strokeWidth={1.1} />
      {type === 'narrow' ? (
        <rect x={9.2} y={4.5} width={7.6} height={31} rx={2} fill="none" stroke="#111" strokeWidth={1.1} />
      ) : (
        <rect x={5.5} y={9.5} width={15} height={21} rx={2} fill="none" stroke="#111" strokeWidth={1.1} />
      )}
      {bars.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.3} fill="#111" />
      ))}
    </svg>
  );
}

/** เลือกแบบของ 2 ปลอก (ปลอกในแคบ / ปลอกในรัดชั้น 2) — ใช้ทั้งแผงกรอกข้อมูลและป๊อปอัปเหล็กปลอก */
export function DoubleStirrupPicker({
  value,
  onChange,
}: {
  value: DoubleStirrupType;
  onChange: (type: DoubleStirrupType) => void;
}) {
  return (
    <div className="seg stirrup-types" role="group" aria-label="แบบ 2 ปลอก">
      {DOUBLE_STIRRUP_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className={value === type ? 'active' : ''}
          aria-pressed={value === type}
          title={DOUBLE_STIRRUP_TH[type].hint}
          onClick={() => onChange(type)}
        >
          <Icon type={type} />
          <span>{DOUBLE_STIRRUP_TH[type].label}</span>
        </button>
      ))}
    </div>
  );
}
