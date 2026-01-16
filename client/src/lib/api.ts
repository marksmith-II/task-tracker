import type { LinkAttachment, NoteDetail, NoteSummary, Reminder, Subtask, TaskDetail, TaskPriority, TaskStatus, TaskSummary } from '../types'

async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (err) {
    // Browser "TypeError: Failed to fetch" (proxy down, server down, blocked, etc.)
    const url = typeof input === 'string' ? input : input.toString()
    const hint =
      url.startsWith('/api') || url.includes('/api/')
        ? 'If you are running locally, make sure both servers are running via `npm run dev` from the repo root.'
        : 'Check your network connection and that the API is reachable.'
    throw new Error(`Failed to reach API at ${url}. ${hint}`)
  }

  if (res.status === 204) return undefined as T

  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const msg =
      typeof (data as any)?.error === 'string'
        ? String((data as any).error)
        : `Request failed (${res.status})`
    throw new Error(msg)
  }
  return data as T
}

export function listTasks(params?: { status?: TaskStatus | 'ALL'; tag?: string | 'ALL'; includeArchived?: boolean }) {
  const url = new URL('/api/tasks', window.location.origin)
  if (params?.status && params.status !== 'ALL') url.searchParams.set('status', params.status)
  if (params?.tag && params.tag !== 'ALL') url.searchParams.set('tag', params.tag)
  if (params?.includeArchived) url.searchParams.set('includeArchived', '1')
  return api<TaskSummary[]>(url)
}

export function listArchivedTasks(search?: string) {
  const url = new URL('/api/tasks/archived', window.location.origin)
  if (search?.trim()) url.searchParams.set('search', search.trim())
  return api<TaskSummary[]>(url)
}

export function archiveTask(id: number) {
  return api<TaskSummary>(`/api/tasks/${id}/archive`, { method: 'POST' })
}

export function unarchiveTask(id: number) {
  return api<TaskSummary>(`/api/tasks/${id}/unarchive`, { method: 'POST' })
}

export function reorderTasks(items: { id: number; sortOrder: number }[]) {
  return api<{ ok: boolean }>('/api/tasks/reorder', { method: 'PUT', body: JSON.stringify({ items }) })
}

export function getTask(id: number) {
  return api<TaskDetail>(`/api/tasks/${id}`)
}

export function createTask(input: {
  title: string
  notes?: string
  status?: TaskStatus
  priority?: TaskPriority | null
  dueDate?: string | null
  tags?: string[]
}) {
  return api<TaskSummary>('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
}

export function updateTask(
  id: number,
  input: {
    title?: string
    notes?: string
    status?: TaskStatus
    priority?: TaskPriority | null
    dueDate?: string | null
    tags?: string[]
  }
) {
  return api<TaskSummary>(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteTask(id: number) {
  return api<void>(`/api/tasks/${id}`, { method: 'DELETE' })
}

export function addSubtask(taskId: number, content: string) {
  return api<Subtask>(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ content }) })
}

export function updateSubtask(id: number, input: { content?: string; isCompleted?: boolean }) {
  return api<Subtask>(`/api/subtasks/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteSubtask(id: number) {
  return api<void>(`/api/subtasks/${id}`, { method: 'DELETE' })
}

// ---- Notes ----
export function listNotes() {
  return api<NoteSummary[]>('/api/notes')
}

export function reorderNotes(items: { id: number; sortOrder: number }[]) {
  return api<{ ok: boolean }>('/api/notes/reorder', { method: 'PUT', body: JSON.stringify({ items }) })
}

export function getNote(id: number) {
  return api<NoteDetail>(`/api/notes/${id}`)
}

export function createNote(input: { title: string; body?: string }) {
  return api<{ id: number; title: string; body: string; createdAt: string; updatedAt: string }>('/api/notes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateNote(id: number, input: { title?: string; body?: string }) {
  return api<{ id: number; title: string; body: string; createdAt: string; updatedAt: string }>(`/api/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteNote(id: number) {
  return api<void>(`/api/notes/${id}`, { method: 'DELETE' })
}

export function linkTaskToNote(noteId: number, taskId: number) {
  return api<void>(`/api/notes/${noteId}/link-task`, { method: 'POST', body: JSON.stringify({ taskId }) })
}

export function unlinkTaskFromNote(noteId: number, taskId: number) {
  return api<void>(`/api/notes/${noteId}/link-task/${taskId}`, { method: 'DELETE' })
}

export function createTaskFromNote(
  noteId: number,
  input: { title?: string; notes?: string; status?: TaskStatus; priority?: TaskPriority | null; dueDate?: string | null; tags?: string[] }
) {
  return api<TaskSummary>(`/api/notes/${noteId}/create-task`, { method: 'POST', body: JSON.stringify(input) })
}

export function createNoteFromTask(taskId: number, input?: { title?: string; body?: string }) {
  return api<{ id: number; title: string; body: string; createdAt: string; updatedAt: string }>(`/api/tasks/${taskId}/create-note`, {
    method: 'POST',
    body: JSON.stringify(input ?? {}),
  })
}

export function linkNoteToTask(taskId: number, noteId: number) {
  return api<void>(`/api/tasks/${taskId}/link-note`, { method: 'POST', body: JSON.stringify({ noteId }) })
}

export function unlinkNoteFromTask(taskId: number, noteId: number) {
  return api<void>(`/api/tasks/${taskId}/link-note/${noteId}`, { method: 'DELETE' })
}

// ---- Links ----
export function addTaskLink(taskId: number, url: string) {
  return api<LinkAttachment>(`/api/tasks/${taskId}/links`, { method: 'POST', body: JSON.stringify({ url }) })
}

export function addNoteLink(noteId: number, url: string) {
  return api<LinkAttachment>(`/api/notes/${noteId}/links`, { method: 'POST', body: JSON.stringify({ url }) })
}

export function deleteLink(id: number) {
  return api<void>(`/api/links/${id}`, { method: 'DELETE' })
}

export function fetchLinkPreview(url: string) {
  const u = new URL('/api/link-preview', window.location.origin)
  u.searchParams.set('url', url)
  return api<{ url: string; title: string | null; description: string | null; imageUrl: string | null; faviconUrl: string | null; screenshotUrl: string | null }>(u)
}

// ---- Reminders ----
export function listReminders(params?: { includeDone?: boolean }) {
  const u = new URL('/api/reminders', window.location.origin)
  if (params?.includeDone) u.searchParams.set('includeDone', '1')
  return api<Reminder[]>(u)
}

export function createReminder(input: { targetType: 'TASK' | 'NOTE'; targetId: number; dueAt: string; message?: string }) {
  return api<Reminder>('/api/reminders', { method: 'POST', body: JSON.stringify(input) })
}

export function updateReminder(id: number, input: { dueAt?: string; message?: string; isDone?: boolean }) {
  return api<Reminder>(`/api/reminders/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export function deleteReminder(id: number) {
  return api<void>(`/api/reminders/${id}`, { method: 'DELETE' })
}

export function listDueReminders(take?: number) {
  const u = new URL('/api/reminders/due', window.location.origin)
  if (take) u.searchParams.set('take', String(take))
  return api<Reminder[]>(u)
}

