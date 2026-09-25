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

function standards(): CriteriaBlock[] {
  const { laws_and_regulations, other_references } = c.reference_standards
  return [
    { type: 'list', title: 'กฎหมายและข้อบังคับ', items: laws_and_regulations, ordered: true },
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
      title: 'ข้อกำหนดตามกฎกระทรวง',
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
  const u = c.load_combinations.ultimate_strength_design
  return [
    { type: 'note', text: 'สำหรับการออกแบบวิธีกำลังประลัย' },
    { type: 'formulas', title: 'ไม่คิดแรงลม', items: [u.without_wind.formula] },
    { type: 'formulas', title: 'คิดแรงลม', items: u.with_wind.map((w) => w.formula) },
    { type: 'note', text: u.selection },
    {
      type: 'facts',
      items: Object.entries(u.variables).map(([name, meaning]) => ({ label: name, value: meaning })),
    },
  ]
}

function liveLoad(): CriteriaBlock[] {
  const ll = c.live_load
  return [
    {
      type: 'table',
      columns: [{ label: 'การใช้งาน' }, { label: `ขั้นต่ำ (${unit(ll.unit)})`, num: true }],
      rows: ll.minimum_values.map((row) => [row.usage, num(row.value)]),
    },
    { type: 'note', text: ll.special_condition },
  ]
}

function liveLoadReduction(): CriteriaBlock[] {
  const r = c.live_load_reduction
  return [
    {
      type: 'table',
      columns: [{ label: 'ชั้น' }, { label: `ลดลง (${unit(r.unit)})`, num: true }],
      rows: r.reductions_by_floor.map((row) => [row.floor, num(row.reduction)]),
    },
    { type: 'list', title: 'อาคารที่ไม่ให้ลดน้ำหนักบรรทุกจร', items: r.buildings_without_reduction },
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
  ]
}

function windLoad(): CriteriaBlock[] {
  const w = c.wind_load
  const inc = w.allowable_increase_with_wind
  return [
    {
      type: 'table',
      columns: [{ label: 'ความสูงของอาคาร' }, { label: `แรงลม (${unit(w.unit)})`, num: true }],
      rows: w.values.map((row) => [row.height, num(row.value)]),
    },
    {
      type: 'note',
      text: `เมื่อรวมแรงลม เพิ่มหน่วยแรงยอมให้ได้ไม่เกิน ${num(inc.maximum)}${unit(inc.unit)}`,
    },
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
  ]
}

function fireCover(): CriteriaBlock[] {
  const f = c.fire_resistance_cover
  const groups = [
    { title: 'คอนกรีตเสริมเหล็ก', rows: f.reinforced_concrete },
    { title: 'คอนกรีตอัดแรง', rows: f.prestressed_concrete },
    { title: 'เหล็กรูปพรรณ', rows: f.structural_steel },
  ]
  return groups.map(({ title, rows }) => ({
    type: 'table',
    title,
    columns: [{ label: 'ชิ้นส่วน' }, { label: `ระยะหุ้มต่ำสุด (${unit(f.unit)})`, num: true }],
    rows: rows.map((row) => [row.member, num(row.minimum_cover)]),
  }))
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
  { id: 'dc-fire', title: 'ระยะหุ้มกันไฟ', blocks: fireCover() },
]

/**
 * หมวดในแต่ละหน้าของรูปเล่ม ต้องเรียงตาม CRITERIA_SECTIONS และครบทุกหมวด
 * แบ่งให้แต่ละหน้าลง A4 ได้โดยไม่ต้องย่อ — ถ้าแก้ข้อมูลจนล้น แท็บ "พิมพ์รูปเล่ม" จะแจ้งเตือน
 */
export const CRITERIA_PRINT_PAGES: string[][] = [
  ['dc-standards', 'dc-concrete', 'dc-rebar', 'dc-wsd'],
  ['dc-steel', 'dc-combo', 'dc-dead', 'dc-live'],
  ['dc-live-reduction', 'dc-wind', 'dc-soil', 'dc-pile', 'dc-fire'],
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
