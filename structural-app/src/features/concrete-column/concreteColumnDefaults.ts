import { toColumnProjectFile, useColumnStore } from '@/state/columnStore'

/** ค่าเริ่มต้นของรายการคำนวณเสาคอนกรีต = สถานะตั้งต้นของ store */
export const DEFAULT_CONCRETE_COLUMN_INPUT = toColumnProjectFile(useColumnStore.getInitialState())

/** ชื่อหัวรูปหน้าตัดเสา ใช้ทั้งหน้าจอออกแบบและรูปเล่ม */
export function columnTitles(columnName: string, shape: 'rect' | 'circle') {
  return {
    title: `SECTION ${columnName || 'C1'}`,
    subtitle: shape === 'rect' ? 'เสาปลอกเดี่ยว' : 'เสาปลอกเกลียว',
  }
}
