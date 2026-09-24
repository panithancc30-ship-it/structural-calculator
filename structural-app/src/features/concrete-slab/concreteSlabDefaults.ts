import { toSlabProjectFile, useSlabStore } from '@/state/slabStore'

/** ค่าเริ่มต้นของรายการคำนวณพื้น = สถานะตั้งต้นของ store */
export const DEFAULT_CONCRETE_SLAB_INPUT = toSlabProjectFile(useSlabStore.getInitialState())
