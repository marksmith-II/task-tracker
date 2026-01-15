import { useEffect, useMemo, useState } from 'react'
import type { TaskDetail, TaskStatus, TaskSummary } from './types'
import { getTask, listDueReminders, listTasks } from './lib/api'
import { Header, type ViewMode } from './components/Header'
import { TaskCard } from './components/TaskCard'
import { TaskRow } from './components/TaskRow'
import { TaskDetailModal } from './components/TaskDetailModal'
import { NotesPanel } from './components/NotesPanel'
import { RemindersPanel } from './components/RemindersPanel'
import { cn } from './lib/cn'

function toSummary(detail: TaskDetail): TaskSummary {
  const { subtasks: _subtasks, linkedNotes: _linkedNotes, links: _links, ...summary } = detail
  return summary
}

export default function App() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'ALL'>('ALL')
  const [tagFilter, setTagFilter] = useState<string | 'ALL'>('ALL')

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const raw = window.localStorage.getItem('tt:viewMode')
    return raw === 'list' || raw === 'cards' ? raw : 'cards'
  })

  const [tab, setTab] = useState<'tasks' | 'notes' | 'reminders'>(() => {
    const raw = window.localStorage.getItem('tt:tab')
    return raw === 'notes' || raw === 'reminders' ? raw : 'tasks'
  })

  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string }>>([])

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

  useEffect(() => {
    window.localStorage.setItem('tt:viewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    window.localStorage.setItem('tt:tab', tab)
  }, [tab])

  useEffect(() => {
    // Poll server for due reminders (server marks them as "fired" so you only see each once).
    const interval = window.setInterval(() => {
      ;(async () => {
        try {
          const due = await listDueReminders(10)
          if (!due.length) return
          for (const r of due) {
            const id = `${r.id}-${r.firedAt ?? Date.now()}`
            const title = 'Reminder'
            const message = r.message || `${r.targetType} #${r.targetId} is due`
            setToasts((prev) => [{ id, title, message }, ...prev].slice(0, 5))
            window.setTimeout(() => {
              setToasts((prev) => prev.filter((t) => t.id !== id))
            }, 10000)

            // Best-effort browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(title, { body: message })
              } catch {
                // ignore
              }
            }
          }
        } catch {
          // ignore polling errors
        }
      })()
    }, 15000)

    return () => window.clearInterval(interval)
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
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="relative">
          <div className="fixed bottom-4 right-4 z-50 space-y-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className="w-80 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                role="button"
                tabIndex={0}
              >
                <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                <p className="mt-1 text-sm text-slate-600">{t.message}</p>
                <p className="mt-2 text-xs text-slate-500">Click to dismiss</p>
              </div>
            ))}
          </div>

          <div className="mb-4 inline-flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab('tasks')}
              className={cn('rounded-xl px-3 py-2 text-sm font-medium', tab === 'tasks' ? 'bg-zinc-100 text-slate-900' : 'text-slate-700 hover:bg-zinc-50')}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setTab('notes')}
              className={cn('rounded-xl px-3 py-2 text-sm font-medium', tab === 'notes' ? 'bg-zinc-100 text-slate-900' : 'text-slate-700 hover:bg-zinc-50')}
            >
              Notes
            </button>
            <button
              type="button"
              onClick={() => setTab('reminders')}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium',
                tab === 'reminders' ? 'bg-zinc-100 text-slate-900' : 'text-slate-700 hover:bg-zinc-50'
              )}
            >
              Reminders
            </button>
          </div>

          {tab === 'tasks' ? (
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
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
              ) : null}

              {loading ? (
                <div className="mt-6 text-sm text-slate-600">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-900">No tasks match your filters.</p>
                  <p className="mt-1 text-sm text-slate-600">Try changing Status/Tag, or create a new task.</p>
                </div>
              ) : viewMode === 'cards' ? (
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={() => openTask(t.id)} />
                  ))}
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  {filtered.map((t) => (
                    <TaskRow key={t.id} task={t} onOpen={() => openTask(t.id)} />
                  ))}
                </div>
              )}
            </div>
          ) : tab === 'notes' ? (
            <NotesPanel allTasks={tasks} />
          ) : (
            <RemindersPanel allTasks={tasks} />
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
