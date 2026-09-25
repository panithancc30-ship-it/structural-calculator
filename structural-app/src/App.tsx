import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronUp,
  Download,
  FilePlus2,
  FileText,
  Printer,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import { TextField } from '@/components/FormFields'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { CalcSheet, CalcSheetKind } from '@/engine/shared/types'
import { DesignCriteriaPage } from '@/features/design-criteria/DesignCriteriaPage'
import { GROUP_LABEL, KIND_LABEL, SHEET_TYPES, SHEET_TYPES_BY_GROUP, inputWithTitle, sheetType } from '@/features/registry'
import { useProjectStore } from '@/project/projectStore'
import { exportProjectJson, importProjectJson } from '@/project/storage'
import { ReportLayout } from '@/report/ReportLayout'
import '@/report/concrete-sheet.css'
import '@/report/print.css'

type Tab = 'project' | 'criteria' | 'calc' | 'report'

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: 'project', label: 'ข้อมูลโครงการ', icon: FileText },
  { id: 'criteria', label: 'Design Criteria', icon: BookOpen },
  { id: 'calc', label: 'รายการคำนวณ', icon: Calculator },
  { id: 'report', label: 'พิมพ์รูปเล่ม', icon: Printer },
]

export default function App() {
  const { project, sheets, loading, init, updateProject, upsertSheet, createSheet, removeSheet, reorderSheet } =
    useProjectStore()
  const [tab, setTab] = useState<Tab>('calc')
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null)
  const [draftKind, setDraftKind] = useState<CalcSheetKind>(SHEET_TYPES[0].kind)
  const [draftInput, setDraftInput] = useState<unknown>(SHEET_TYPES[0].defaultInput)
  const [draftTitle, setDraftTitle] = useState(`${SHEET_TYPES[0].titlePrefix}1`)
  const [draftRemarks, setDraftRemarks] = useState('')

  useEffect(() => {
    void init()
  }, [init])

  const type = useMemo(() => sheetType(draftKind), [draftKind])
  /** ชื่อชิ้นส่วนในหัวรูปตามชื่อรายการเสมอ จึงไม่ต้องกรอกซ้ำในฟอร์ม */
  const draftValue = useMemo(() => inputWithTitle(type, draftInput, draftTitle), [type, draftInput, draftTitle])
  /** หน้าจอออกแบบงานคอนกรีตมีรูปหน้าตัดที่แก้ไขได้ ต้องการพื้นที่กว้างกว่างานเหล็ก */
  const wide = type.group === 'concrete'

  /** นับเฉพาะรายการชนิดเดียวกัน เพื่อให้เลขที่ในชื่อเรียงต่อกันตามชนิด */
  const nextNumberFor = (kind: CalcSheetKind) =>
    sheets.filter((s) => s.kind === kind).length + 1

  const loadSheet = (sheet: CalcSheet) => {
    setActiveSheetId(sheet.id)
    setDraftKind(sheet.kind)
    setDraftInput(sheet.input)
    setDraftTitle(sheet.title)
    setDraftRemarks(sheet.remarks)
    setTab('calc')
  }

  const startNewSheet = (kind: CalcSheetKind = draftKind) => {
    const next = sheetType(kind)
    setActiveSheetId(null)
    setDraftKind(kind)
    setDraftInput(next.defaultInput)
    setDraftTitle(`${next.titlePrefix}${nextNumberFor(kind)}`)
    setDraftRemarks('')
  }

  /** เปลี่ยนชนิดรายการระหว่างร่าง — ต้องล้างค่าเดิมเพราะโครงสร้างข้อมูลคนละแบบ */
  const changeKind = (kind: CalcSheetKind) => {
    if (kind === draftKind) return
    startNewSheet(kind)
  }

  const handleSave = async () => {
    if (activeSheetId) {
      const existing = sheets.find((s) => s.id === activeSheetId)
      if (!existing) return
      await upsertSheet({
        ...existing,
        kind: draftKind,
        title: draftTitle,
        input: draftValue,
        remarks: draftRemarks,
        updatedAt: Date.now(),
      })
    } else {
      const sheet = await createSheet(draftKind, draftTitle, draftValue)
      await upsertSheet({ ...sheet, remarks: draftRemarks })
      setActiveSheetId(sheet.id)
    }
  }

  const handleExport = async () => {
    if (!project) return
    const json = await exportProjectJson(project.id)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name || 'project'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (file: File) => {
    await importProjectJson(await file.text())
    window.location.reload()
  }

  if (loading || !project) {
    return <div className="p-8 text-muted-foreground">กำลังโหลด...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-20 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                โปรแกรมคำนวณออกแบบโครงสร้าง
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                โครงสร้างเหล็กรูปพรรณ และคอนกรีตเสริมเหล็ก ด้วยวิธีหน่วยแรงใช้งาน · หน่วย ksc / กก. / ซม.
              </p>
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                {TABS.map(({ id, label, icon: Icon }) => (
                  <TabsTrigger key={id} value={id} className="gap-1.5">
                    <Icon className="size-4" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      <main className={`mx-auto px-6 py-6 ${wide && tab === 'calc' ? 'max-w-[1700px]' : 'max-w-7xl'}`}>
        {tab === 'project' && (
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle>ข้อมูลสำหรับหน้าปกรายการคำนวณ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="ชื่อโครงการ" value={project.name} onChange={(v) => void updateProject({ name: v })} />
                <TextField label="สถานที่ก่อสร้าง" value={project.location} onChange={(v) => void updateProject({ location: v })} />
                <TextField label="เจ้าของอาคาร" value={project.owner} onChange={(v) => void updateProject({ owner: v })} />
                <TextField
                  label="ขอบเขตการคำนวณ"
                  value={project.scope}
                  onChange={(v) => void updateProject({ scope: v })}
                  placeholder="เช่น งานโครงสร้างเหล็กหลังคา อาคาร 2 ชั้น"
                />
                <TextField label="ชื่อผู้คำนวณออกแบบ" value={project.engineerName} onChange={(v) => void updateProject({ engineerName: v })} />
                <TextField label="เลขที่ใบอนุญาต (ผู้คำนวณ)" value={project.engineerLicense} onChange={(v) => void updateProject({ engineerLicense: v })} />
                <TextField label="ชื่อผู้ตรวจสอบ" value={project.checkerName} onChange={(v) => void updateProject({ checkerName: v })} />
                <TextField label="เลขที่ใบอนุญาต (ผู้ตรวจสอบ)" value={project.checkerLicense} onChange={(v) => void updateProject({ checkerLicense: v })} />
                <TextField
                  label="วันที่ในเอกสาร"
                  type="date"
                  value={project.documentDate}
                  onChange={(v) => void updateProject({ documentDate: v })}
                />
              </div>

              <Separator />

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => void handleExport()}>
                  <Download className="size-4" />
                  สำรองข้อมูลเป็นไฟล์ JSON
                </Button>
                <Button variant="outline" asChild>
                  <label className="cursor-pointer">
                    <Upload className="size-4" />
                    นำเข้าไฟล์สำรอง
                    <input
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleImport(file)
                      }}
                    />
                  </label>
                </Button>
                <p className="text-xs text-muted-foreground">
                  ข้อมูลเก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ควรสำรองไฟล์เป็นระยะ
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === 'criteria' && <DesignCriteriaPage />}

        {tab === 'calc' && (
          <div
            className={`grid gap-6 ${
              wide
                ? 'lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]'
                : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]'
            }`}
          >
            <div className="space-y-4">
              <Card>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>ชนิดรายการคำนวณ</Label>
                    <div className="space-y-2">
                      {SHEET_TYPES_BY_GROUP.map(({ group, types }) => (
                        <div key={group} className="flex flex-wrap items-center gap-2">
                          <span className="w-40 shrink-0 text-xs text-muted-foreground">
                            {GROUP_LABEL[group]}
                          </span>
                          {types.map(({ kind, label, icon: Icon, description }) => (
                            <Tooltip key={kind}>
                              <TooltipTrigger asChild>
                                <Button
                                  variant={kind === draftKind ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => changeKind(kind)}
                                >
                                  <Icon className="size-4" />
                                  {label}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{description}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      ))}
                    </div>
                    {activeSheetId && (
                      <p className="text-xs text-muted-foreground">
                        การเปลี่ยนชนิดจะเริ่มรายการใหม่ เพราะข้อมูลนำเข้าคนละชุดกัน
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-56 grow">
                      <TextField
                        label="ชื่อรายการ"
                        value={draftTitle}
                        onChange={setDraftTitle}
                        placeholder="เช่น คานเหล็ก SB1 ชั้น 2"
                      />
                    </div>
                    <Button onClick={() => void handleSave()}>
                      <Save className="size-4" />
                      {activeSheetId ? 'บันทึกการแก้ไข' : 'บันทึกเข้ารูปเล่ม'}
                    </Button>
                    <Button variant="outline" onClick={() => startNewSheet()}>
                      <FilePlus2 className="size-4" />
                      รายการใหม่
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {type.renderForm(draftValue, setDraftInput)}

              <Card>
                <CardContent className="space-y-1.5">
                  <Label htmlFor="remarks">หมายเหตุของวิศวกร (แสดงท้ายรายการคำนวณ)</Label>
                  <Textarea
                    id="remarks"
                    value={draftRemarks}
                    onChange={(e) => setDraftRemarks(e.target.value)}
                    rows={3}
                    placeholder="เช่น สมมติฐานการรับน้ำหนัก, ข้อสังเกตเพิ่มเติม"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {type.renderResult(draftValue)}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">รายการคำนวณในรูปเล่ม ({sheets.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {sheets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      ยังไม่มีรายการ — กด “บันทึกเข้ารูปเล่ม” เพื่อเพิ่ม
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {sheets.map((sheet) => (
                        <li key={sheet.id} className="flex items-center gap-1 py-1.5 first:pt-0 last:pb-0">
                          <button
                            onClick={() => loadSheet(sheet)}
                            className={`grow rounded px-2 py-1 text-left text-sm hover:bg-accent ${
                              sheet.id === activeSheetId ? 'font-semibold text-primary' : 'text-foreground'
                            }`}
                          >
                            {sheet.order + 1}. {sheet.title}
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              {KIND_LABEL[sheet.kind]}
                            </span>
                          </button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => void reorderSheet(sheet.id, -1)}>
                                <ChevronUp className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>เลื่อนขึ้น</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => void reorderSheet(sheet.id, 1)}>
                                <ChevronDown className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>เลื่อนลง</TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>ลบรายการนี้ออกจากรูปเล่ม?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  “{sheet.title}” จะถูกลบถาวร การกระทำนี้ย้อนกลับไม่ได้
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    void removeSheet(sheet.id)
                                    if (sheet.id === activeSheetId) startNewSheet()
                                  }}
                                >
                                  ลบรายการ
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {tab === 'report' && (
          <div>
            <Card className="no-print mb-5">
              <CardContent className="flex flex-wrap items-center gap-4">
                <Button onClick={() => window.print()}>
                  <Printer className="size-4" />
                  พิมพ์ / บันทึกเป็น PDF
                </Button>
                <p className="text-sm text-muted-foreground">
                  ในหน้าต่างพิมพ์ เลือกปลายทางเป็น “Save as PDF” ขนาดกระดาษ A4 และเปิด “กราฟิกพื้นหลัง”
                </p>
              </CardContent>
            </Card>
            <ReportLayout project={project} sheets={sheets} />
          </div>
        )}
      </main>
    </div>
  )
}
