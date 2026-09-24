import { toFootingProjectFile, useFootingStore } from '@/state/footingStore'

/** ค่าเริ่มต้นของรายการคำนวณฐานรากแผ่ = สถานะตั้งต้นของ store */
export const DEFAULT_CONCRETE_FOOTING_INPUT = toFootingProjectFile(useFootingStore.getInitialState())
