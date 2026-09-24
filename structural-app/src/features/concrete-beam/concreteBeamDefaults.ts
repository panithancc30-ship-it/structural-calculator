import { toProjectFile, useStore } from '@/state/store'

/** ค่าเริ่มต้นของรายการคำนวณคานคอนกรีต = สถานะตั้งต้นของ store (ออกแบบเหล็กอัตโนมัติไว้แล้ว) */
export const DEFAULT_CONCRETE_BEAM_INPUT = toProjectFile(useStore.getInitialState())
