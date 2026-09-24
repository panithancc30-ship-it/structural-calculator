import { toStairProjectFile, useStairStore } from '@/state/stairStore'

/** ค่าเริ่มต้นของรายการคำนวณบันได = สถานะตั้งต้นของ store */
export const DEFAULT_CONCRETE_STAIR_INPUT = toStairProjectFile(useStairStore.getInitialState())
