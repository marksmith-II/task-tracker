import { useEffect, useMemo, useState } from 'react'
import type { TaskDetail, TaskStatus, TaskSummary } from './types'
import { getTask, listTasks } from './lib/api'
import { Header } from './components/Header'
import { TaskCard } from './components/TaskCard'
import { TaskDetailModal } from './components/TaskDetailModal'

function toSummary(detail: TaskDetail): TaskSummary {
  const { subtasks: _subtasks, ...summary } = detail
  return summary
}

export default function App() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [tagFilter, setTagFilter] = useState<string | 'ALL'>('ALL')

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)

  async function refreshTasks() {
    setLoading(true)
    setError(null)
    try {
      const data = await listTasks()
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }

  async function openTask(id: number) {
    setError(null)
    setModalOpen(true)
    try {
      const detail = await getTask(id)
      setSelectedTask(detail)
    } catch (err) {
      setSelectedTask(null)
      setError(err instanceof Error ? err.message : 'Failed to load task')
    }
  }

  async function requestRefreshTask(id: number) {
    try {
      const detail = await getTask(id)
      setSelectedTask((prev) => (prev?.id === id ? detail : prev))
      setTasks((prev) => prev.map((t) => (t.id === id ? toSummary(detail) : t)))
    } catch {
      // best-effort refresh; keep UI responsive even if it fails
    }
  }

  useEffect(() => {
    refreshTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const allTags = useMemo(() => {
    const s = new Set<string>()
    for (const t of tasks) for (const tag of t.tags) s.add(tag)
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [tasks])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false
      if (tagFilter !== 'ALL' && !t.tags.includes(tagFilter)) return false
      return true
    })
  }, [tasks, statusFilter, tagFilter])

  return (
    <div className="min-h-full">
      <Header
        onNewTask={() => {
          setSelectedTask(null)
          setModalOpen(true)
        }}
        onExport={() => {
          window.location.assign('/api/backup')
        }}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Tasks</p>
              <p className="text-sm text-slate-600">
                Showing <span className="font-medium text-slate-900">{filtered.length}</span> of{' '}
                <span className="font-medium text-slate-900">{tasks.length}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'ALL')}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                >
                  <option value="ALL">All</option>
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Tag</span>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                >
                  <option value="ALL">All</option>
                  {allTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-6 text-sm text-slate-600">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
              <p className="text-sm font-semibold text-slate-900">No tasks match your filters.</p>
              <p className="mt-1 text-sm text-slate-600">Try changing Status/Tag, or create a new task.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <TaskCard key={t.id} task={t} onOpen={() => openTask(t.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      <TaskDetailModal
        open={modalOpen}
        task={selectedTask}
        onClose={() => {
          setModalOpen(false)
          setSelectedTask(null)
        }}
        onUpsertSummary={(saved) => {
          setTasks((prev) => {
            const exists = prev.some((t) => t.id === saved.id)
            const next = exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]
            return next
          })
        }}
        onDeleted={(id) => {
          setTasks((prev) => prev.filter((t) => t.id !== id))
          setModalOpen(false)
          setSelectedTask(null)
        }}
        onRequestRefresh={(id) => requestRefreshTask(id)}
      />
    </div>
  )
}
