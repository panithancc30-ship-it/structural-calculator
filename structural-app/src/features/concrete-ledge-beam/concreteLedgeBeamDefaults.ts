import { toLedgeProjectFile, useLedgeStore } from '@/state/ledgeStore'

/** ค่าเริ่มต้นของรายการคานรับพื้นยื่น = สถานะตั้งต้นของ store (ออกแบบเหล็กอัตโนมัติไว้แล้ว) */
export const DEFAULT_CONCRETE_LEDGE_BEAM_INPUT = toLedgeProjectFile(useLedgeStore.getInitialState())
