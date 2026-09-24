import { Fragment } from 'react';
import type { CheckItem } from '@/engine/concrete/types';
import { StatusIcon } from './StatusBadge';

export const GROUP_TH: Record<CheckItem['group'], string> = {
  flexure: 'ดัด',
  detail: 'การจัดเหล็ก',
  shear: 'เฉือน / บิด',
  beam: 'คาน',
  strength: 'กำลังรับแรงอัด + โมเมนต์',
  slenderness: 'ความชะลูด',
  transverse: 'เหล็กปลอก',
  soil: 'แรงดันดิน',
  oneWay: 'เฉือนแบบคาน (ทางเดียว)',
  punching: 'เฉือนทะลุ (สองทาง)',
  anchorage: 'ระยะฝังเหล็ก',
  bearing: 'แรงแบกทานใต้เสา',
  pile: 'เสาเข็ม',
  deflection: 'การโก่งตัวและความหนาขั้นต่ำ',
  geometry: 'ขนาดขั้นบันได',
};

export function CheckTable({ checks, compact = false }: { checks: CheckItem[]; compact?: boolean }) {
  return (
    <table className={`checks${compact ? ' compact' : ''}`}>
      <thead>
        <tr>
          <th>รายการ</th>
          <th className="num">ต้องการ</th>
          <th className="num">ใช้จริง</th>
          <th aria-label="ผล" />
        </tr>
      </thead>
      <tbody>
        {checks.map((c, i) => (
          <Fragment key={c.id}>
            {(i === 0 || checks[i - 1].group !== c.group) && (
              <tr className="group">
                <td colSpan={4}>{GROUP_TH[c.group]}</td>
              </tr>
            )}
            <tr className={c.status}>
              <td>{c.label}</td>
              <td className="num">{c.required}</td>
              <td className="num">{c.provided}</td>
              <td className="icon">
                <StatusIcon status={c.status} />
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
