import { toPileCapProjectFile, usePileCapStore } from '@/state/pileCapStore'

/** ค่าเริ่มต้นของรายการคำนวณฐานรากเสาเข็ม = สถานะตั้งต้นของ store */
export const DEFAULT_CONCRETE_PILECAP_INPUT = toPileCapProjectFile(usePileCapStore.getInitialState())
