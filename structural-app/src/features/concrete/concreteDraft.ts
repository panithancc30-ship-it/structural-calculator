import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { CheckStatus as ConcreteStatus } from '@/engine/concrete/types'
import type { CheckStatus } from '@/engine/shared/types'

/** งานคอนกรีตใช้ 'ok' ส่วนรูปเล่มรายงานใช้ 'pass' */
export function toReportStatus(status: ConcreteStatus): CheckStatus {
  return status === 'ok' ? 'pass' : status
}

interface ConcreteStore {
  loadProject: (data: unknown) => string | null
}

/** ค่าที่ไม่มีทางเท่ากับ input ของรายการใด ทำให้เรนเดอร์แรกโหลดข้อมูลเสมอ */
const NEVER_SYNCED = Symbol('never-synced')

/**
 * เชื่อม zustand store ของโมดูลคอนกรีตเข้ากับรายการคำนวณที่กำลังร่างอยู่
 *
 * โมดูลคอนกรีตเดิมเป็นแอพเดี่ยวที่เก็บสถานะไว้ใน store ก้อนเดียว ส่วนรูปเล่มของแอพรวม
 * เก็บรายการคำนวณเป็นข้อมูลก้อนหนึ่งต่อหนึ่งรายการ ตัวเชื่อมนี้จึงทำสองทาง:
 * โหลดข้อมูลของรายการที่เลือกเข้า store และส่งทุกการแก้ไขใน store กลับขึ้นไปเป็นข้อมูลรายการ
 *
 * ร่างได้ทีละรายการเท่านั้น ซึ่งตรงกับหน้าจอ “รายการคำนวณ” ที่มีร่างเดียว
 */
export function useConcreteDraft<S extends ConcreteStore>(
  store: UseBoundStore<StoreApi<S>>,
  value: unknown,
  onChange: (next: unknown) => void,
  toFile: (state: S) => unknown,
): string | null {
  const synced = useRef<unknown>(NEVER_SYNCED)
  const hydrating = useRef(false)
  const [error, setError] = useState<string | null>(null)

  // โหลดก่อนเบราว์เซอร์วาด เพื่อไม่ให้เห็นข้อมูลของรายการก่อนหน้าแวบขึ้นมา
  useLayoutEffect(() => {
    if (value === synced.current) return
    synced.current = value
    hydrating.current = true
    // คัดลอกก่อนโหลด เพราะ store แก้ข้อมูลของตัวเองได้ ส่วนค่าเริ่มต้นใช้ร่วมกันทุกรายการใหม่
    setError(store.getState().loadProject(structuredClone(value)))
    hydrating.current = false
  }, [store, value])

  useEffect(
    () =>
      store.subscribe((state) => {
        if (hydrating.current) return
        const file = toFile(state)
        synced.current = file
        onChange(file)
      }),
    [store, onChange, toFile],
  )

  return error
}
