import type { CheckStatus } from '@/engine/concrete/types';

const TEXT: Record<CheckStatus, string> = { ok: 'ผ่าน', warn: 'ควรตรวจสอบ', fail: 'ไม่ผ่าน' };
const ICON: Record<CheckStatus, string> = { ok: '✓', warn: '!', fail: '✗' };

export function StatusBadge({ status }: { status: CheckStatus }) {
  return <span className={`badge ${status}`}>{TEXT[status]}</span>;
}

export function StatusIcon({ status }: { status: CheckStatus }) {
  return (
    <span className={`status-icon ${status}`} title={TEXT[status]} aria-label={TEXT[status]}>
      {ICON[status]}
    </span>
  );
}
