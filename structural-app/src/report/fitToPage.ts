/**
 * ย่อรายการคำนวณให้พอดี 1 หน้า A4 ตอนสั่งพิมพ์
 *
 * ความยาวของหมายเหตุและข้อสังเกตแต่ละรายการไม่แน่นอน การจัดหน้าด้วย CSS อย่างเดียว
 * จึงรับประกันไม่ได้ว่าจะไม่ล้นไปหน้าที่สอง ก่อนพิมพ์จึงวัดความสูงจริงในขนาดกระดาษพิมพ์
 * แล้วย่อเฉพาะรายการที่ล้น — แต่ไม่ย่อเกิน MIN_SCALE เพื่อให้ตัวหนังสือยังอ่านได้
 */

/** ความสูงพื้นที่พิมพ์ — ต้องตรงกับ @page ใน print.css (A4 29.7 ซม. ขอบบน 1.4 ขอบล่าง 1.2) */
const PRINTABLE_HEIGHT_CM = 29.7 - 1.4 - 1.2
const CM_TO_PX = 96 / 2.54

/** เผื่อความคลาดเคลื่อนระหว่างการวัดบนจอกับการจัดหน้าของเครื่องพิมพ์จริง */
const SAFETY = 0.99

/** ย่อได้ต่ำสุด 85% — เล็กกว่านี้ตัวอักษรในตารางจะเล็กเกินอ่านในเอกสารยื่นขออนุญาต */
export const MIN_SCALE = 0.85

const SELECTOR = '.report-page.fit-one-page'

export interface FitResult {
  title: string
  /** อัตราส่วนที่ต้องย่อ (1 = ไม่ต้องย่อ) */
  scale: number
  /** ย่อไม่เกิน MIN_SCALE แล้วยังลงได้ 1 หน้า */
  fits: boolean
}

function pages(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(SELECTOR)]
}

/** วัดความสูงของแต่ละรายการในขนาดพื้นที่พิมพ์ (คลาส measuring-print จำลองกฎ @media print) */
export function measureSheets(): FitResult[] {
  const list = pages()
  for (const page of list) page.style.removeProperty('zoom')

  const root = document.documentElement
  // ตอนพิมพ์จริง รูปเล่มยังอยู่ใน <main> ที่มีระยะขอบซ้ายขวา จึงแคบกว่าพื้นที่พิมพ์เต็ม
  const container = list[0]?.closest('main')
  const inset = container
    ? parseFloat(getComputedStyle(container).paddingLeft) +
      parseFloat(getComputedStyle(container).paddingRight)
    : 0
  root.style.setProperty('--print-inset', `${inset}px`)
  root.classList.add('measuring-print')
  const available = PRINTABLE_HEIGHT_CM * CM_TO_PX * SAFETY

  const results = list.map((page) => {
    const height = page.getBoundingClientRect().height
    const needed = height > 0 ? available / height : 1
    // ปัดลงเพื่อให้แน่ใจว่าหลังย่อแล้วลงหน้าเดียวจริง
    const scale = Math.min(1, Math.floor(needed * 100) / 100)
    return { title: page.dataset.title ?? '', scale, fits: scale >= MIN_SCALE }
  })

  root.classList.remove('measuring-print')
  return results
}

export function applyPrintFit(): void {
  const list = pages()
  measureSheets().forEach((result, i) => {
    if (result.scale < 1) list[i].style.zoom = String(Math.max(result.scale, MIN_SCALE))
  })
}

export function clearPrintFit(): void {
  for (const page of pages()) page.style.removeProperty('zoom')
}
