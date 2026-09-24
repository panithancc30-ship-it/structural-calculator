import Dexie, { type EntityTable } from 'dexie'
import type { CalcSheet, Project } from '../engine/shared/types'

const db = new Dexie('thai-structural-calc') as Dexie & {
  projects: EntityTable<Project, 'id'>
  sheets: EntityTable<CalcSheet, 'id'>
}

db.version(1).stores({
  projects: 'id, name, updatedAt',
  sheets: 'id, projectId, order, updatedAt',
})

export { db }

export function newId(): string {
  return crypto.randomUUID()
}

export function emptyProject(): Project {
  const now = Date.now()
  return {
    id: newId(),
    name: '',
    location: '',
    owner: '',
    engineerName: '',
    engineerLicense: '',
    checkerName: '',
    checkerLicense: '',
    documentDate: new Date().toISOString().slice(0, 10),
    scope: '',
    createdAt: now,
    updatedAt: now,
  }
}

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() })
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.sheets, async () => {
    await db.sheets.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
}

export async function listSheets(projectId: string): Promise<CalcSheet[]> {
  const sheets = await db.sheets.where('projectId').equals(projectId).toArray()
  return sheets.sort((a, b) => a.order - b.order)
}

export async function saveSheet(sheet: CalcSheet): Promise<void> {
  await db.sheets.put({ ...sheet, updatedAt: Date.now() })
}

export async function deleteSheet(id: string): Promise<void> {
  await db.sheets.delete(id)
}

export async function exportProjectJson(projectId: string): Promise<string> {
  const project = await db.projects.get(projectId)
  const sheets = await listSheets(projectId)
  return JSON.stringify({ version: 1, project, sheets }, null, 2)
}

export async function importProjectJson(json: string): Promise<string> {
  const parsed = JSON.parse(json) as { project: Project; sheets: CalcSheet[] }
  if (!parsed.project) throw new Error('ไฟล์ไม่ถูกต้อง: ไม่พบข้อมูลโครงการ')

  const idMap = new Map<string, string>()
  const projectId = newId()
  idMap.set(parsed.project.id, projectId)

  await db.transaction('rw', db.projects, db.sheets, async () => {
    await db.projects.put({ ...parsed.project, id: projectId, updatedAt: Date.now() })
    for (const sheet of parsed.sheets ?? []) {
      await db.sheets.put({ ...sheet, id: newId(), projectId })
    }
  })

  return projectId
}
