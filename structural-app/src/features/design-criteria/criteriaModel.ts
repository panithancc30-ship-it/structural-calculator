import data from './designCriteria.json'

/**
 * เกณฑ์การออกแบบ (Design Criteria) ในรูปหมวดและบล็อกสำหรับแสดงผล
 *
 * หน้าจอและรูปเล่มอ่านจากที่นี่ที่เดียว ป้ายกำกับจึงตรงกันเสมอ
 * ค่าทั้งหมดมาจาก designCriteria.json ตามที่เขียนไว้ ไม่ได้คำนวณใหม่
 * และไม่ได้ส่งเข้าเอนจินคำนวณ — ค่าที่รายการคำนวณใช้จริงอยู่ใน src/engine
 * จึงแก้ไฟล์ JSON ได้โดยไม่กระทบผลคำนวณ
 */
const c = data.design_criteria

const UNIT_LABEL: Record<string, string> = {
  'kg/m2': 'กก./ม.²',
  'kg/m3': 'กก./ม.³',
  'metric ton/m2': 'ตัน/ม.²',
  mm: 'มม.',
  'mm/hour': 'มม./ชม.',
  percent: '%',
  degree: 'องศา',
}

export const unit = (u: string) => UNIT_LABEL[u] ?? u

export const num = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 3 })

/** เขียนสูตรให้อ่านง่าย เช่น "0.29 * sqrt(fc')" เป็น "0.29√f′c" */
export const formula = (s: string) =>
  s
    .replace(/\s*\*\s*sqrt\(([^)]+)\)/g, '√$1')
    .replace(/\s\*\s/g, '·')
    .replace(/fc'/g, 'f′c')

const NONE = '—'

export interface Column {
  label: string
  /** ตัวเลข: ชิดขวาและใช้ตัวเลขความกว้างเท่ากัน */
  num?: boolean
}

export interface Fact {
  label: string
  value: string
  hint?: string
}

export type CriteriaBlock =
  /** แถวที่มีช่องเดียวในตารางหลายคอลัมน์ คือหัวข้อย่อยที่คร่อมทุกคอลัมน์ */
  | { type: 'table'; title?: string; columns: Column[]; rows: string[][] }
  | { type: 'facts'; title?: string; items: Fact[] }
  /** ordered แสดงเป็นรายการมีเลขข้อ ไม่เช่นนั้นเป็นป้ายสั้น ๆ เรียงต่อกัน */
  | { type: 'list'; title?: string; items: string[]; ordered?: boolean }
  | { type: 'formulas'; title?: string; items: string[] }
  | { type: 'note'; text: string }
  /** บล็อกที่วางคู่กันบนจอกว้าง — ในรูปเล่มซึ่งแบ่งสองคอลัมน์อยู่แล้วจะเรียงต่อกันตามปกติ */
  | { type: 'side-by-side'; blocks: CriteriaBlock[] }

export interface CriteriaSection {
  id: string
  title: string
  blocks: CriteriaBlock[]
}

const ksc = (v: number) => `${num(v)} ksc`

/** ค่าที่กฎกระทรวง พ.ศ. 2566 ไม่ได้กำหนดไว้ ใช้ค่าเดิมตามที่ผู้ใช้เลือก — บอกที่มาไว้ใต้ตาราง */
const notIn2566 = (what: string): CriteriaBlock => ({
  type: 'note',
  text: `${what} — ${c.reference_standards.values_not_in_2566}`,
})

/** ตัวคูณแสดงสองตำแหน่งตามกฎกระทรวง เว้นแต่มีหลักที่สาม เช่น 0.625 */
export const factor = (v: number) => (Math.round(v * 1000) % 10 ? v.toFixed(3) : v.toFixed(2))

/** ช่องแรกที่ซ้ำกับแถวก่อนหน้าเว้นว่าง ให้อ่านเป็นกลุ่มเหมือนเซลล์ผสาน */
function mergeRepeats(rows: string[][]): string[][] {
  return rows.map((row, i) => (i > 0 && rows[i - 1][0] === row[0] ? ['', ...row.slice(1)] : row))
}

function standards(): CriteriaBlock[] {
  const { laws_and_regulations, regulation_notes, other_references } = c.reference_standards
  return [
    { type: 'list', title: 'กฎหมายและข้อบังคับ', items: laws_and_regulations, ordered: true },
    { type: 'list', title: 'ข้อควรทราบเกี่ยวกับกฎกระทรวง พ.ศ. 2566', items: regulation_notes, ordered: true },
    { type: 'list', title: 'เอกสารอ้างอิงอื่น', items: other_references },
    {
      type: 'facts',
      title: 'หน่วยที่ใช้',
      items: [
        { label: 'หน่วยแรง', value: unit(c.units.stress) },
        { label: 'หน่วยแรงระบบ SI', value: unit(c.units.force_per_area_si) },
        { label: 'น้ำหนักต่อพื้นที่', value: unit(c.units.area_load) },
        { label: 'หน่วยน้ำหนักต่อปริมาตร', value: unit(c.units.volume_weight) },
      ],
    },
  ]
}

function concrete(): CriteriaBlock[] {
  const mix = c.concrete.mix_design
  const ratio = mix.mix_ratio_by_volume
  const s = c.concrete.strength_and_allowable_stress
  const u = unit(s.fc_prime.unit)
  return [
    {
      type: 'facts',
      title: 'ส่วนผสมคอนกรีต',
      items: [
        {
          label: 'อัตราส่วนผสมโดยปริมาตร',
          value: `${ratio.cement} : ${ratio.sand} : ${ratio.coarse_aggregate}`,
          hint: 'ปูนซีเมนต์ : ทราย : หิน',
        },
        {
          label: 'อัตราส่วนน้ำต่อซีเมนต์',
          value: `${mix.water_cement_ratio.minimum.toFixed(2)}–${mix.water_cement_ratio.maximum.toFixed(2)}`,
        },
        { label: 'อายุทดสอบ', value: `${mix.test_age} วัน` },
        { label: 'ตัวอย่างทดสอบ', value: `แท่ง${mix.test_specimen}` },
      ],
    },
    {
      type: 'table',
      title: 'กำลังและหน่วยแรงยอมให้',
      columns: [
        { label: 'รายการ' },
        { label: 'สูตร' },
        { label: `ค่าที่ใช้ (${u})`, num: true },
        { label: `ไม่เกิน (${u})`, num: true },
      ],
      rows: [
        [`${s.fc_prime.description} (f′c)`, NONE, num(s.fc_prime.value), NONE],
        [
          'หน่วยแรงอัดยอมให้ (fc)',
          formula(s.allowable_compressive_stress.formula),
          num(s.allowable_compressive_stress.value),
          num(s.allowable_compressive_stress.regulatory_maximum),
        ],
        [
          'กำลังอัดคอนกรีตสำหรับออกแบบวิธีกำลังประลัย',
          NONE,
          NONE,
          num(s.ultimate_design_concrete_strength.maximum),
        ],
        [
          'หน่วยแรงอัดยอมให้ของคอนกรีตล้วน',
          formula(s.plain_concrete_allowable_compression.formula),
          NONE,
          num(s.plain_concrete_allowable_compression.maximum),
        ],
        ['หน่วยแรงเฉือนยอมให้ในคาน (vc)', formula(s.shear_beam.formula), num(s.shear_beam.value), NONE],
        ['หน่วยแรงเฉือนทะลุยอมให้', formula(s.shear_punching.formula), num(s.shear_punching.value), NONE],
        ['หน่วยแรงเฉือนจากแรงบิดยอมให้', formula(s.shear_torsion.formula), num(s.shear_torsion.value), NONE],
        ['โมดูลัสยืดหยุ่น (Ec)', formula(s.elastic_modulus.formula), num(s.elastic_modulus.value), NONE],
      ],
    },
    notIn2566('ค่าในช่อง "ไม่เกิน"'),
  ]
}

function reinforcingSteel(): CriteriaBlock[] {
  const { round_bars, deformed_bars, regulatory_limits: lim } = c.reinforcing_steel
  const col = lim.allowable_column_compression
  return [
    {
      type: 'table',
      title: 'เหล็กเสริมที่ใช้',
      columns: [
        { label: 'ชั้นคุณภาพ' },
        { label: 'ชนิด' },
        { label: 'fy (ksc)', num: true },
        { label: 'fs ยอมให้' },
        { label: 'fs (ksc)', num: true },
        { label: 'Es (ksc)', num: true },
      ],
      rows: [round_bars, deformed_bars].map((bar) => [
        bar.grade,
        bar.type,
        num(bar.fy.value),
        formula(bar.allowable_tensile_stress.formula),
        num(bar.allowable_tensile_stress.value),
        num(bar.elastic_modulus.value),
      ]),
    },
    {
      type: 'facts',
      title: 'ข้อกำหนดตามกฎกระทรวงเดิม',
      items: [
        { label: 'กำลังครากต่ำสุด', value: ksc(lim.minimum_yield_strength.value) },
        {
          label: 'กำลังครากออกแบบวิธีกำลังประลัย เหล็กกลม',
          value: `ไม่เกิน ${ksc(lim.ultimate_design_yield_strength.round_bars_maximum)}`,
        },
        {
          label: 'กำลังครากออกแบบวิธีกำลังประลัย เหล็กอื่น',
          value: `ไม่เกิน ${ksc(lim.ultimate_design_yield_strength.other_reinforcement_maximum)}`,
        },
      ],
    },
    {
      type: 'table',
      columns: [{ label: 'หน่วยแรงดึงยอมให้' }, { label: 'เงื่อนไข' }, { label: 'ไม่เกิน (ksc)', num: true }],
      rows: lim.allowable_tensile_stress.map((row) => [
        row.type,
        row.formula ? formula(row.formula) : NONE,
        num(row.maximum),
      ]),
    },
    {
      type: 'table',
      columns: [{ label: 'หน่วยแรงอัดยอมให้ในเสา' }, { label: 'เงื่อนไข' }, { label: 'ไม่เกิน (ksc)', num: true }],
      rows: [
        ['เหล็กข้ออ้อย', formula(col.deformed_bars.formula), num(col.deformed_bars.maximum)],
        ['เหล็กรูปพรรณในเสาประกอบ', NONE, num(col.structural_steel_composite_column.maximum)],
        ['เหล็กหล่อ', NONE, num(col.cast_iron.maximum)],
      ],
    },
    notIn2566('ข้อกำหนดกำลังครากและหน่วยแรงยอมให้ที่กำกับไว้'),
  ]
}

function wsdConstants(): CriteriaBlock[] {
  const { round_bars_SR24: sr, deformed_bars_SD40: sd, formulas } = c.concrete_steel_interaction
  const rows: Array<[string, typeof sr]> = [
    [c.reinforcing_steel.round_bars.grade, sr],
    [c.reinforcing_steel.deformed_bars.grade, sd],
  ]
  return [
    {
      type: 'table',
      columns: [
        { label: 'เหล็กเสริม' },
        { label: 'n', num: true },
        { label: 'k', num: true },
        { label: 'j', num: true },
        { label: `R (${unit(sr.R_unit)})`, num: true },
      ],
      rows: rows.map(([grade, v]) => [grade, num(v.n), num(v.k), num(v.j), num(v.R)]),
    },
    {
      type: 'formulas',
      title: 'สูตรที่ใช้',
      items: Object.entries(formulas).map(([name, f]) => `${name} = ${formula(f)}`),
    },
  ]
}

function structuralSteel(): CriteriaBlock[] {
  const st = c.structural_steel
  const a = st.allowable_stresses
  const noTest = st.regulatory_yield_strength_without_test
  const weld = c.welding_electrode
  return [
    { type: 'list', items: st.grade.split(' / ') },
    {
      type: 'facts',
      items: [
        { label: 'กำลังคราก (Fy)', value: `${num(st.fy.value)} ${unit(st.fy.unit)}` },
        { label: 'โมดูลัสยืดหยุ่น (Es)', value: `${num(st.elastic_modulus.value)} ${unit(st.elastic_modulus.unit)}` },
        {
          label: 'Fy เมื่อไม่มีผลทดสอบ หนาไม่เกิน 40 มม.',
          value: `${num(noTest.thickness_up_to_40_mm)} ${unit(noTest.unit)}`,
        },
        {
          label: 'Fy เมื่อไม่มีผลทดสอบ หนาเกิน 40 มม.',
          value: `${num(noTest.thickness_over_40_mm)} ${unit(noTest.unit)}`,
        },
      ],
    },
    notIn2566('Fy เมื่อไม่มีผลทดสอบ'),
    {
      type: 'table',
      columns: [{ label: 'หน่วยแรงยอมให้' }, { label: 'สูตร' }, { label: 'ค่า (ksc)', num: true }],
      rows: (
        [
          ['แรงดึง (Ft)', a.tension],
          ['แรงอัด (Fa)', a.compression],
          ['แรงดัด (Fb)', a.bending],
          ['แรงเฉือน (Fv)', a.shear],
        ] as const
      ).map(([label, stress]) => [label, formula(stress.formula), num(stress.value)]),
    },
    {
      type: 'facts',
      title: 'ลวดเชื่อม',
      items: [
        { label: 'ชั้นคุณภาพ', value: weld.grade },
        {
          label: 'หน่วยแรงเฉือนยอมให้',
          value: `${num(weld.allowable_shear_stress.value)} ${unit(weld.allowable_shear_stress.unit)}`,
        },
      ],
    },
  ]
}

function loadCombinations(): CriteriaBlock[] {
  const lc = c.load_combinations
  const comboTable = (method: typeof lc.allowable_stress_design): CriteriaBlock => ({
    type: 'table',
    title: method.title,
    columns: [{ label: 'กรณี' }, { label: 'ชุดน้ำหนักบรรทุก' }],
    rows: mergeRepeats(method.cases.flatMap(({ case: name, formulas }) => formulas.map((f) => [name, f]))),
  })
  const rc = lc.concrete_strength_reduction_factors
  const steel = lc.steel_resistance_factors
  return [
    { type: 'note', text: 'รายการคำนวณในโปรแกรมนี้ใช้วิธีหน่วยแรงที่ยอมให้ แรงที่ป้อนจึงเป็นแรงจากชุด S' },
    comboTable(lc.allowable_stress_design),
    comboTable(lc.strength_design),
    { type: 'note', text: lc.selection },
    {
      type: 'facts',
      items: Object.entries(lc.variables).map(([name, meaning]) => ({ label: name, value: meaning })),
    },
    {
      type: 'table',
      title: rc.title,
      columns: [
        { label: 'แรงที่กระทำ' },
        { label: 'ระบุมาตรฐานและควบคุมคุณภาพ', num: true },
        { label: 'ไม่ได้ระบุ', num: true },
      ],
      rows: rc.values.map((row) => [
        row.force,
        factor(row.with_quality_control),
        factor(row.without_quality_control),
      ]),
    },
    {
      type: 'table',
      title: steel.title,
      columns: [{ label: 'องค์อาคาร' }, { label: 'ตัวคูณ', num: true }],
      rows: steel.values.map((row) => [row.member, factor(row.value)]),
    },
  ]
}

function liveLoad(): CriteriaBlock[] {
  const ll = c.live_load
  const impact = ll.impact_increase
  // ประเภทอาคารเป็นแถวหัวข้อคร่อมทั้งแถว — ตารางสองคอลัมน์ตัดบรรทัดน้อยกว่าในรูปเล่มที่แบ่งสองคอลัมน์
  const groupTables = ll.groups.map(
    ({ group, occupancies }): CriteriaBlock => ({
      type: 'table',
      title: group,
      columns: [{ label: 'ส่วนของอาคาร' }, { label: unit(ll.unit), num: true }],
      rows: occupancies.flatMap(({ occupancy, areas }) => [
        ...(occupancy ? [[occupancy]] : []),
        ...areas.map((a) => [a.area, num(a.value)]),
      ]),
    }),
  )
  return [
    { type: 'note', text: ll.basis },
    ...groupTables,
    { type: 'note', text: ll.special_condition },
    {
      type: 'table',
      title: 'แรงกระแทก เพิ่มน้ำหนักบรรทุกไม่น้อยกว่า (ข้อ 16)',
      columns: [{ label: 'โครงสร้าง' }, { label: `เพิ่ม (${unit(impact.unit)})`, num: true }],
      rows: impact.values.map((row) => [row.structure, num(row.value)]),
    },
  ]
}

function liveLoadReduction(): CriteriaBlock[] {
  const r = c.live_load_reduction
  return [
    { type: 'note', text: r.applies_to },
    {
      type: 'table',
      columns: [{ label: 'ชั้น' }, { label: `ลดลง (${unit(r.unit)})`, num: true }],
      rows: r.reductions_by_floor.map((row) => [row.floor, num(row.reduction)]),
    },
    { type: 'list', title: 'อาคารที่ไม่ให้ลดน้ำหนักบรรทุกจร (ข้อ 14)', items: r.buildings_without_reduction },
    { type: 'note', text: r.heavy_live_load_rule },
  ]
}

function deadLoad(): CriteriaBlock[] {
  const { material_unit_weights: mat, building_element_weights: el, soil_properties: soil } = c.dead_load
  return [
    {
      type: 'side-by-side',
      blocks: [
        {
          type: 'table',
          title: 'หน่วยน้ำหนักวัสดุ',
          columns: [{ label: 'วัสดุ' }, { label: unit(mat.unit), num: true }],
          rows: mat.values.map((row) => [row.material, num(row.value)]),
        },
        {
          type: 'table',
          title: 'น้ำหนักส่วนประกอบอาคาร',
          columns: [{ label: 'ส่วนประกอบ' }, { label: unit(el.unit), num: true }],
          rows: el.values.map((row) => [row.element, num(row.value)]),
        },
      ],
    },
    {
      type: 'facts',
      title: 'คุณสมบัติดิน',
      items: [
        {
          label: 'แรงดันที่ผิวดิน',
          value: `${num(soil.surface_pressure.value)} ${unit(soil.surface_pressure.unit)}`,
        },
        {
          label: 'มุมเสียดทานภายในของดิน (φ)',
          value: `${num(soil.friction_angle.value)} ${unit(soil.friction_angle.unit)}`,
        },
      ],
    },
    { type: 'note', text: c.dead_load.partition_note },
  ]
}

function windLoad(): CriteriaBlock[] {
  const w = c.wind_load
  return [
    {
      type: 'table',
      title: `หน่วยแรงลมขั้นต่ำตามสภาพภูมิประเทศ (${unit(w.unit)})`,
      columns: [{ label: 'ส่วนของอาคาร' }, ...w.terrains.map((t) => ({ label: t.terrain, num: true }))],
      rows: w.heights.map((height, i) => [height, ...w.terrains.map((t) => num(t.values[i]))]),
    },
    { type: 'list', title: 'เงื่อนไข', items: w.conditions, ordered: true },
  ]
}

function soilBearing(): CriteriaBlock[] {
  const s = c.soil_bearing_capacity
  return [
    {
      type: 'table',
      columns: [{ label: 'ชนิดดิน' }, { label: `ยอมให้ (${unit(s.unit)})`, num: true }],
      rows: s.values.map((row) => [row.soil_type, num(row.value)]),
    },
    notIn2566('ตารางนี้'),
  ]
}

function pileFoundation(): CriteriaBlock[] {
  const p = c.pile_foundation
  const sf = p.skin_friction_without_test
  const cap = p.allowable_capacity_with_test
  const st = p.settlement_limits
  const ofUltimate = (ratio: number) => `ไม่เกิน ${ratio.toFixed(2)} เท่าของน้ำหนักบรรทุกประลัย`
  const limit = (v: { maximum: number; unit: string }) => `${num(v.maximum)} ${unit(v.unit)}`
  return [
    {
      type: 'facts',
      title: 'แรงเสียดทานผิวเมื่อไม่มีผลทดสอบ',
      items: [
        { label: 'ช่วงลึกไม่เกิน 7 ม.', value: `ไม่เกิน ${limit(sf.depth_up_to_7_m)}` },
        {
          label: 'ช่วงลึกเกิน 7 ม.',
          value: `${sf.depth_over_7_m.formula} ${unit(sf.depth_over_7_m.unit)}`,
          hint: `y คือ${sf.depth_over_7_m.y}`,
        },
      ],
    },
    {
      type: 'facts',
      title: 'น้ำหนักบรรทุกปลอดภัยเมื่อมีผลทดสอบ',
      items: [
        {
          label: 'คำนวณจากผลทดสอบดิน',
          value: ofUltimate(cap.calculated_from_soil_test.maximum_ratio_of_ultimate_load),
        },
        {
          label: 'จากการทดสอบบรรทุกน้ำหนัก',
          value: ofUltimate(cap.obtained_from_load_test.maximum_ratio_of_ultimate_load),
        },
      ],
    },
    {
      type: 'table',
      title: 'การทรุดตัวที่ยอมให้ในการทดสอบบรรทุกน้ำหนัก',
      columns: [{ label: 'รายการ' }, { label: 'ไม่เกิน', num: true }],
      rows: [
        ['ทรุดตัวรวมหลังบรรทุกน้ำหนักครบ 24 ชั่วโมง', limit(st.total_settlement_after_24_hours)],
        ['อัตราการทรุดตัวเฉลี่ย', limit(st.average_settlement_rate)],
        ['ทรุดตัวสุทธิหลังถอนน้ำหนักออก', limit(st.net_settlement_after_unloading)],
      ],
    },
    notIn2566('ค่าในหมวดนี้'),
  ]
}

function fire(): CriteriaBlock[] {
  const r = c.fire_resistance_rating
  const f = c.fire_resistance_cover
  const coverGroups = [
    { title: 'ระยะหุ้ม คอนกรีตเสริมเหล็ก', rows: f.reinforced_concrete },
    { title: 'ระยะหุ้ม คอนกรีตอัดแรง', rows: f.prestressed_concrete },
    { title: 'ระยะหุ้ม เหล็กรูปพรรณ', rows: f.structural_steel },
  ]
  return [
    { type: 'list', title: 'อาคารที่โครงสร้างหลักต้องทนไฟ (ข้อ 22)', items: r.applies_to, ordered: true },
    {
      type: 'table',
      title: 'อัตราการทนไฟของโครงสร้างหลัก (ข้อ 23)',
      columns: [{ label: 'ตำแหน่ง' }, { label: 'โครงสร้างหลัก' }, { label: `ไม่น้อยกว่า (${r.unit})`, num: true }],
      rows: mergeRepeats(r.values.map((row) => [row.location, row.members, row.hours])),
    },
    { type: 'list', items: r.notes, ordered: true },
    { type: 'note', text: f.note },
    ...coverGroups.map(
      ({ title, rows }): CriteriaBlock => ({
        type: 'table',
        title,
        columns: [{ label: 'ชิ้นส่วน' }, { label: `ระยะหุ้มต่ำสุด (${unit(f.unit)})`, num: true }],
        rows: rows.map((row) => [row.member, num(row.minimum_cover)]),
      }),
    ),
  ]
}

export const CRITERIA_SECTIONS: CriteriaSection[] = [
  { id: 'dc-standards', title: 'มาตรฐานอ้างอิง', blocks: standards() },
  { id: 'dc-concrete', title: 'คอนกรีต', blocks: concrete() },
  { id: 'dc-rebar', title: 'เหล็กเสริม', blocks: reinforcingSteel() },
  { id: 'dc-wsd', title: 'ค่าคงที่ออกแบบ WSD', blocks: wsdConstants() },
  { id: 'dc-steel', title: 'เหล็กรูปพรรณและลวดเชื่อม', blocks: structuralSteel() },
  { id: 'dc-combo', title: 'การรวมน้ำหนักบรรทุก', blocks: loadCombinations() },
  { id: 'dc-dead', title: 'น้ำหนักบรรทุกคงที่', blocks: deadLoad() },
  { id: 'dc-live', title: 'น้ำหนักบรรทุกจร', blocks: liveLoad() },
  { id: 'dc-live-reduction', title: 'การลดน้ำหนักบรรทุกจร', blocks: liveLoadReduction() },
  { id: 'dc-wind', title: 'แรงลม', blocks: windLoad() },
  { id: 'dc-soil', title: 'กำลังแบกทานของดิน', blocks: soilBearing() },
  { id: 'dc-pile', title: 'เสาเข็ม', blocks: pileFoundation() },
  { id: 'dc-fire', title: 'การทนไฟ', blocks: fire() },
]

/**
 * ส่วนของหมวดที่พิมพ์ในหน้าหนึ่ง: ทั้งหมวด (ใส่แค่ id) หรือช่วงบล็อก [from, to) ของหมวดที่ยาวเกินหนึ่งหน้า
 * เลขบล็อกนับจาก printBlocks() ซึ่งแตกบล็อกที่วางคู่กันออกเป็นบล็อกเดี่ยวแล้ว
 */
export type CriteriaPrintPart = string | { id: string; from?: number; to?: number }

/** บล็อกของหมวดตามลำดับในรูปเล่ม — รูปเล่มแบ่งสองคอลัมน์อยู่แล้ว บล็อกที่วางคู่กันจึงเรียงต่อกัน */
export function printBlocks(section: CriteriaSection): CriteriaBlock[] {
  return section.blocks.flatMap((b) => (b.type === 'side-by-side' ? b.blocks : [b]))
}

export interface ResolvedPrintPart {
  section: CriteriaSection
  /** เลขหมวดตามลำดับบนหน้าจอ */
  number: number
  from: number
  to: number
}

const SECTION_INDEX = new Map(CRITERIA_SECTIONS.map((s, i) => [s.id, i]))

export function resolvePrintPart(part: CriteriaPrintPart): ResolvedPrintPart | undefined {
  const { id, from = 0, to } = typeof part === 'string' ? { id: part } : part
  const index = SECTION_INDEX.get(id)
  if (index === undefined) return undefined
  const section = CRITERIA_SECTIONS[index]
  return { section, number: index + 1, from, to: to ?? printBlocks(section).length }
}

/**
 * หมวดในแต่ละหน้าของรูปเล่ม ต้องเรียงตาม CRITERIA_SECTIONS และครบทุกบล็อก
 * แบ่งให้แต่ละหน้าลง A4 ได้โดยไม่ต้องย่อ — ถ้าแก้ข้อมูลจนล้น แท็บ "พิมพ์รูปเล่ม" จะแจ้งเตือน
 * หมวดน้ำหนักบรรทุกจรตามกฎกระทรวง พ.ศ. 2566 ยาวเกินหนึ่งหน้า จึงแบ่งพิมพ์สองหน้า (กลุ่ม 1–2 และกลุ่ม 3–7)
 */
export const CRITERIA_PRINT_PAGES: CriteriaPrintPart[][] = [
  ['dc-standards', 'dc-concrete'],
  ['dc-rebar', 'dc-wsd', 'dc-steel'],
  ['dc-combo'],
  ['dc-dead', { id: 'dc-live', to: 3 }],
  [{ id: 'dc-live', from: 3 }],
  ['dc-live-reduction', 'dc-wind', 'dc-soil', 'dc-pile'],
  ['dc-fire'],
]

/** ค่าหลักที่แสดงเด่นบนหัวหน้าจอ */
export const KEY_VALUES: Fact[] = [
  { label: 'กำลังอัดคอนกรีต (f′c)', value: ksc(c.concrete.strength_and_allowable_stress.fc_prime.value) },
  {
    label: 'หน่วยแรงอัดยอมให้ (fc)',
    value: ksc(c.concrete.strength_and_allowable_stress.allowable_compressive_stress.value),
  },
  {
    label: `เหล็กเสริม ${c.reinforcing_steel.round_bars.grade}`,
    value: `fy ${ksc(c.reinforcing_steel.round_bars.fy.value)}`,
  },
  {
    label: `เหล็กเสริม ${c.reinforcing_steel.deformed_bars.grade}`,
    value: `fy ${ksc(c.reinforcing_steel.deformed_bars.fy.value)}`,
  },
  { label: 'เหล็กรูปพรรณ', value: `Fy ${ksc(c.structural_steel.fy.value)}` },
  { label: 'อัตราส่วนโมดูลัส (n)', value: num(c.concrete_steel_interaction.round_bars_SR24.n) },
]
