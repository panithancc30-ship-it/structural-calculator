import { useEffect, useState, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CRITERIA_SECTIONS, KEY_VALUES, type CriteriaBlock } from './criteriaModel'

/**
 * หน้าเกณฑ์การออกแบบ (Design Criteria) — แสดงข้อมูลอ้างอิงอย่างเดียว
 * เนื้อหาทั้งหมดมาจาก criteriaModel ซึ่งรูปเล่มก็ใช้ร่วมกัน
 */

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 font-medium text-foreground">{children}</h3>
}

function BlockBody({ block }: { block: CriteriaBlock }) {
  switch (block.type) {
    case 'table':
      return (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {block.columns.map((col, i) => (
                <TableHead key={i} className={col.num ? 'text-right' : undefined}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {block.rows.map((row, r) => (
              <TableRow key={r}>
                {row.map((cell, i) => (
                  <TableCell
                    key={i}
                    className={block.columns[i].num ? 'text-right tabular-nums' : 'whitespace-normal'}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    case 'facts':
      return (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
          {block.items.map(({ label, value, hint }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
              {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
            </div>
          ))}
        </dl>
      )
    case 'list':
      return block.ordered ? (
        <ol className="list-decimal space-y-1 pl-5">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {block.items.map((item) => (
            <Badge key={item} variant="outline">
              {item}
            </Badge>
          ))}
        </div>
      )
    case 'formulas':
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {block.items.map((f) => (
            <code key={f} className="block rounded-md bg-muted px-3 py-2 font-mono text-sm">
              {f}
            </code>
          ))}
        </div>
      )
    case 'note':
      return <p className="text-sm text-muted-foreground">{block.text}</p>
    case 'side-by-side':
      return (
        <div className="grid gap-5 md:grid-cols-2">
          {block.blocks.map((inner, i) => (
            <Block key={i} block={inner} />
          ))}
        </div>
      )
  }
}

function Block({ block }: { block: CriteriaBlock }) {
  const title = 'title' in block ? block.title : undefined
  return (
    <div>
      {title && <SubHeading>{title}</SubHeading>}
      <BlockBody block={block} />
    </div>
  )
}

const SECTION_IDS = CRITERIA_SECTIONS.map((s) => s.id)

/** หมวดที่กำลังอ่านอยู่ ใช้ไฮไลต์เมนูด้านข้าง */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      // แถบตรวจจับอยู่ใต้หัวหน้าจอที่ติดด้านบน ถึงราวหนึ่งในสามของจอ
      { rootMargin: '-120px 0px -65% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [ids])
  return [active, setActive] as const
}

export function DesignCriteriaPage() {
  const [active, setActive] = useActiveSection(SECTION_IDS)

  const goTo = (id: string) => {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg font-semibold">Design Criteria</CardTitle>
            <Badge variant="outline">ข้อมูลอ้างอิง</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            เกณฑ์และค่าที่ใช้ในการออกแบบ ตามกฎกระทรวงและมาตรฐาน วสท. แสดงเพื่ออ้างอิงเท่านั้น
            ไม่ได้ใช้ในสูตรของรายการคำนวณ · พิมพ์รวมในรูปเล่มต่อจากสารบัญ
          </p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {KEY_VALUES.map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/60 px-3 py-2">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="sticky top-28 hidden self-start lg:block">
          <ul className="space-y-0.5 border-l">
            {CRITERIA_SECTIONS.map(({ id, title }) => (
              <li key={id}>
                <button
                  onClick={() => goTo(id)}
                  className={`-ml-px block w-full border-l-2 py-1 pl-3 text-left text-sm hover:text-foreground ${
                    id === active
                      ? 'border-primary font-medium text-primary'
                      : 'border-transparent text-muted-foreground'
                  }`}
                >
                  {title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6">
          {CRITERIA_SECTIONS.map(({ id, title, blocks }, index) => (
            <Card key={id} id={id} className="scroll-mt-28">
              <CardHeader>
                <CardTitle>
                  <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                  {title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
