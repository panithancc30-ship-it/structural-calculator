import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Info, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { fmt, fmtSymbolValue, fmtUnit } from '@/engine/shared/units'
import type { CalcStep, CheckItem, CheckStatus } from '@/engine/shared/types'

const STATUS_TEXT: Record<CheckStatus, string> = {
  pass: 'ผ่าน',
  fail: 'ไม่ผ่าน',
  warn: 'ควรตรวจสอบ',
}

const STATUS_ICON = { pass: CheckCircle2, fail: XCircle, warn: AlertTriangle } as const

const BADGE_CLASS: Record<CheckStatus, string> = {
  pass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  fail: 'border-red-200 bg-red-50 text-red-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
}

const BANNER_CLASS: Record<CheckStatus, string> = {
  pass: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  fail: 'border-red-200 bg-red-50 text-red-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-900',
}

const ICON_CLASS: Record<CheckStatus, string> = {
  pass: 'text-emerald-600',
  fail: 'text-red-600',
  warn: 'text-amber-600',
}

interface Props {
  overall: CheckStatus
  checks: CheckItem[]
  steps: CalcStep[]
  /** ข้อความเตือน/ข้อจำกัดที่วิศวกรต้องรู้ก่อนใช้ผลลัพธ์ */
  warnings?: string[]
  summary?: string
  diagram?: ReactNode
  diagramTitle?: string
}

export function CalcResultView({
  overall,
  checks,
  steps,
  warnings = [],
  summary,
  diagram,
  diagramTitle = 'รูปตัดหน้าตัด',
}: Props) {
  const BannerIcon = STATUS_ICON[overall]

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg border px-4 py-3',
          BANNER_CLASS[overall],
        )}
      >
        <BannerIcon className={cn('size-7 shrink-0', ICON_CLASS[overall])} />
        <div>
          <div className="text-lg font-semibold leading-tight">
            สรุปผลการตรวจสอบ: {STATUS_TEXT[overall]}
          </div>
          <div className="text-sm opacity-80">
            {summary ??
              (overall === 'pass'
                ? 'หน้าตัดที่กำหนดรับแรงได้อย่างปลอดภัย'
                : overall === 'fail'
                  ? 'ปรับขนาดหน้าตัด เพิ่มจุดค้ำยัน หรือเปลี่ยนเกรดเหล็ก แล้วตรวจสอบใหม่'
                  : 'ผ่านเกณฑ์หลัก แต่มีบางรายการที่ควรตรวจสอบเพิ่มเติม')}
          </div>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Info className="size-4" />
            ข้อสังเกตและข้อจำกัดของการคำนวณนี้
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900/90">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รายการตรวจสอบ</TableHead>
              <TableHead className="text-right">ค่าที่เกิดขึ้น</TableHead>
              <TableHead className="text-right">ค่าที่ยอมให้</TableHead>
              <TableHead className="text-right">อัตราส่วน</TableHead>
              <TableHead className="text-center">ผล</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checks.map((check) => (
              <TableRow key={check.id}>
                <TableCell>
                  <div className="font-medium">{check.label}</div>
                  {check.formula && (
                    <div className="text-xs text-muted-foreground">{check.formula}</div>
                  )}
                  {check.note && (
                    <div className="text-xs text-muted-foreground">{check.note}</div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtSymbolValue(check.actualSymbol, check.actual, check.unit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtUnit(check.allowable, check.unit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmt(check.ratio, 2)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={BADGE_CLASS[check.status]}>
                    {STATUS_TEXT[check.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {diagram && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{diagramTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">{diagram}</CardContent>
        </Card>
      )}

      <Card className="py-0">
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between gap-2 px-6 py-4 text-sm font-semibold">
            ขั้นตอนการคำนวณโดยละเอียด
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t">
            <Table>
              <TableBody>
                {steps.map((step) => (
                  <TableRow key={step.symbol}>
                    <TableCell className="w-24 font-medium">{step.symbol}</TableCell>
                    <TableCell>
                      <div>{step.label}</div>
                      {step.formula && (
                        <div className="text-xs text-muted-foreground">{step.formula}</div>
                      )}
                      {step.substitution && (
                        <div className="text-xs text-muted-foreground">
                          {step.substitution}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="w-40 text-right tabular-nums">
                      {fmtUnit(step.value, step.unit, step.decimals ?? 2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      </Card>
    </div>
  )
}
