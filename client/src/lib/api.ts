import type { Subtask, TaskDetail, TaskStatus, TaskSummary } from '../types'

async function api<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

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

export function listTasks(params?: { status?: TaskStatus | 'ALL'; tag?: string | 'ALL' }) {
  const url = new URL('/api/tasks', window.location.origin)
  if (params?.status && params.status !== 'ALL') url.searchParams.set('status', params.status)
  if (params?.tag && params.tag !== 'ALL') url.searchParams.set('tag', params.tag)
  return api<TaskSummary[]>(url)
}

export function getTask(id: number) {
  return api<TaskDetail>(`/api/tasks/${id}`)
}

export function createTask(input: {
  title: string
  notes?: string
  status?: TaskStatus
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

