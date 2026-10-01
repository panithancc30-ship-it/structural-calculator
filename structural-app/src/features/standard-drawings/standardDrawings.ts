import precastSlab1 from '../../assets/standard-drawings/precast-slab-1.png'
import precastSlab2 from '../../assets/standard-drawings/precast-slab-2.png'

/** ส่วนของภาพที่ใช้พิมพ์ หน่วยพิกเซลของไฟล์ภาพ */
export interface DrawingCrop {
  x: number
  y: number
  width: number
  height: number
}

/**
 * แบบมาตรฐานที่แนบท้ายรูปเล่มได้ — เป็นรูปภาพล้วน ไม่มีการคำนวณ
 * การเพิ่มแบบใหม่ทำได้โดยใส่ไฟล์ภาพใน src/assets/standard-drawings แล้วเพิ่มรายการในนี้
 */
export interface StandardDrawing {
  /** เก็บในข้อมูลโครงการ จึงห้ามเปลี่ยนหลังใช้งานแล้ว */
  id: string
  /** ชื่อในสารบัญ หัวกระดาษ และตัวเลือก */
  title: string
  /** รายละเอียดว่าในแบบมีอะไรบ้าง แสดงเป็น tooltip ของตัวเลือก */
  description: string
  src: string
  /** ขนาดจริงของไฟล์ภาพ */
  width: number
  height: number
  /** ตัดขอบที่ติดมาจากกรอบแบบต้นฉบับ (ไม่ใส่ = ใช้ทั้งภาพ) */
  crop?: DrawingCrop
}

export const STANDARD_DRAWINGS: StandardDrawing[] = [
  {
    id: 'precast-slab-1',
    title: 'แบบมาตรฐานพื้นสำเร็จรูป แผ่นที่ 1',
    description: 'การวางพื้นสำเร็จรูป SP ที่รอยตัดขาด ช่องว่างที่คานริม จุดที่ไม่มีที่รองรับ และพื้นต่างระดับ',
    src: precastSlab1,
    width: 897,
    height: 721,
  },
  {
    id: 'precast-slab-2',
    title: 'แบบมาตรฐานพื้นสำเร็จรูป แผ่นที่ 2',
    description: 'การวางพื้นสำเร็จรูป SP ภายใน ติดพื้นหล่อในที่ S พื้นห้องน้ำ ริมคาน และพื้น S ที่สูงกว่าหลังคาน',
    src: precastSlab2,
    width: 1117,
    height: 886,
    // แถบชื่อแบบของกรอบต้นฉบับติดมาทางขวา และเส้นกรอบทางบน
    crop: { x: 0, y: 3, width: 1086, height: 883 },
  },
]

/** เรียงตามลำดับในทะเบียนเสมอ ตัดรหัสที่ไม่รู้จักและรหัสซ้ำทิ้ง (ข้อมูลโครงการเก่าไม่มีช่องนี้) */
export function selectedStandardDrawings(ids: readonly string[] | undefined): StandardDrawing[] {
  const wanted = new Set(ids ?? [])
  return STANDARD_DRAWINGS.filter((d) => wanted.has(d.id))
}

/** สลับการเลือกแบบหนึ่งแผ่น คืนรหัสที่เลือกตามลำดับในทะเบียน ไม่ขึ้นกับลำดับที่คลิก */
export function toggleStandardDrawing(ids: readonly string[] | undefined, id: string): string[] {
  const wanted = new Set(selectedStandardDrawings(ids).map((d) => d.id))
  if (wanted.has(id)) wanted.delete(id)
  else wanted.add(id)
  return STANDARD_DRAWINGS.filter((d) => wanted.has(d.id)).map((d) => d.id)
}
