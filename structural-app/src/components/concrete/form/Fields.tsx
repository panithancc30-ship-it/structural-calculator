import { useState } from 'react';
import type { BarName, SteelGrade } from '@/engine/concrete/rebar';

export interface NumberInputProps {
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  ariaLabel?: string;
}

/** ช่องตัวเลขที่พิมพ์ค้าง (เช่น ลบจนว่าง) ได้โดยไม่เด้งกลับ */
export function NumberInput({ value, onChange, unit, step = 1, ariaLabel }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <span className="field-input">
      <input
        type="number"
        inputMode="decimal"
        step={step}
        aria-label={ariaLabel}
        value={draft ?? String(value)}
        onFocus={() => setDraft(String(value))}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const v = Number(text);
          if (text.trim() !== '' && Number.isFinite(v)) onChange(v);
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </span>
  );
}

export function NumberField({ label, hint, ...rest }: NumberInputProps & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <NumberInput {...rest} ariaLabel={label} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function SteelField({
  label,
  value,
  grades,
  onChange,
}: {
  label: string;
  value: number;
  grades: SteelGrade[];
  onChange: (fy: number) => void;
}) {
  const match = grades.find((g) => g.fy === value);
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-row">
        <select
          aria-label={`${label} ชั้นคุณภาพ`}
          value={match?.name ?? 'custom'}
          onChange={(e) => {
            const g = grades.find((x) => x.name === e.target.value);
            if (g) onChange(g.fy);
          }}
        >
          {grades.map((g) => (
            <option key={g.name} value={g.name}>
              {g.name}
            </option>
          ))}
          <option value="custom">กำหนดเอง</option>
        </select>
        <NumberInput value={value} onChange={onChange} unit="ksc" step={100} ariaLabel={label} />
      </span>
    </div>
  );
}

export function BarSelect({
  label,
  value,
  sizes,
  onChange,
}: {
  label: string;
  value: BarName;
  sizes: BarName[];
  onChange: (v: BarName) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as BarName)}>
        {sizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented<T extends string | boolean>({
  label, value, options, onChange, grid = false,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  /** จัดปุ่มเป็นตาราง 2 คอลัมน์ (ตัวเลือกยาว) */
  grid?: boolean;
}) {
  return (
    <div className="field span2">
      <span className="field-label">{label}</span>
      <div className={grid ? 'seg grid' : 'seg'} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={value === o.value ? 'active' : ''}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
