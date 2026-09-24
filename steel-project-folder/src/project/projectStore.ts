import { create } from 'zustand'
import { isSupportedKind, type CalcSheet, type Project } from '../engine/shared/types'
import {
  deleteSheet as dbDeleteSheet,
  emptyProject,
  listProjects,
  listSheets,
  newId,
  saveProject,
  saveSheet,
} from './storage'

interface ProjectState {
  project: Project | null
  sheets: CalcSheet[]
  loading: boolean
  init: () => Promise<void>
  updateProject: (patch: Partial<Project>) => Promise<void>
  upsertSheet: (sheet: CalcSheet) => Promise<void>
  createSheet: (kind: CalcSheet['kind'], title: string, input: unknown) => Promise<CalcSheet>
  removeSheet: (id: string) => Promise<void>
  reorderSheet: (id: string, direction: -1 | 1) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  sheets: [],
  loading: true,

  init: async () => {
    const projects = await listProjects()
    let project = projects[0]
    if (!project) {
      project = emptyProject()
      project.name = 'โครงการใหม่'
      await saveProject(project)
    }
    // รายการชนิดที่โปรแกรมไม่รองรับแล้ว (เช่น คานคอนกรีตที่บันทึกไว้ก่อนหน้า) ยังอยู่ในฐานข้อมูล แต่ไม่แสดง
    const sheets = (await listSheets(project.id)).filter((s) => isSupportedKind(s.kind))
    set({ project, sheets, loading: false })
  },

  updateProject: async (patch) => {
    const current = get().project
    if (!current) return
    const next = { ...current, ...patch, updatedAt: Date.now() }
    set({ project: next })
    await saveProject(next)
  },

  upsertSheet: async (sheet) => {
    await saveSheet(sheet)
    const sheets = get().sheets
    const exists = sheets.some((s) => s.id === sheet.id)
    const next = exists ? sheets.map((s) => (s.id === sheet.id ? sheet : s)) : [...sheets, sheet]
    set({ sheets: next.sort((a, b) => a.order - b.order) })
  },

  createSheet: async (kind, title, input) => {
    const project = get().project
    if (!project) throw new Error('ยังไม่มีโครงการ')
    const now = Date.now()
    const sheet: CalcSheet = {
      id: newId(),
      projectId: project.id,
      kind,
      title,
      order: get().sheets.length,
      input,
      remarks: '',
      createdAt: now,
      updatedAt: now,
    }
    await get().upsertSheet(sheet)
    return sheet
  },

  removeSheet: async (id) => {
    await dbDeleteSheet(id)
    set({ sheets: get().sheets.filter((s) => s.id !== id) })
  },

  reorderSheet: async (id, direction) => {
    const sheets = [...get().sheets]
    const index = sheets.findIndex((s) => s.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= sheets.length) return
    ;[sheets[index], sheets[target]] = [sheets[target], sheets[index]]
    const renumbered = sheets.map((s, i) => ({ ...s, order: i }))
    set({ sheets: renumbered })
    await Promise.all(renumbered.map((s) => saveSheet(s)))
  },
}))
