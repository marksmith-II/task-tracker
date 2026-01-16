import { Archive, Search, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TaskSummary } from '../types'
import { listArchivedTasks, unarchiveTask } from '../lib/api'
import { cn } from '../lib/cn'
import { TagBadge } from './TagBadge'
import { statusLabel, statusStyles } from './taskStatus'

export function ArchivedTasksPanel(props: { onUnarchived: (task: TaskSummary) => void }) {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await listArchivedTasks(debouncedSearch)
      setTasks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load archived tasks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  async function handleUnarchive(task: TaskSummary) {
    try {
      const updated = await unarchiveTask(task.id)
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      props.onUnarchived(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive task')
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-slate-500" />
            <p className="text-sm font-semibold text-slate-900">Archived Tasks</p>
          </div>
          <p className="text-sm text-slate-600">
            {loading ? 'Loading…' : `${tasks.length} archived task${tasks.length === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative">
            <span className="sr-only">Search archived tasks</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
              placeholder="Search archived…"
            />
          </label>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="mt-6 text-sm text-slate-600">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
          <Archive className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {debouncedSearch ? 'No matching archived tasks' : 'No archived tasks'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {debouncedSearch ? 'Try a different search term.' : 'Completed tasks can be archived from the task detail view.'}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {tasks.map((task, index) => {
            const styles = statusStyles(task.status)
            const Icon = styles.icon
            const isEven = index % 2 === 0
            return (
              <div
                key={task.id}
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3',
                  isEven ? 'bg-white' : 'bg-amber-50/40',
                  styles.border,
                  'opacity-75'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset',
                        styles.badge
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {statusLabel(task.status)}
                    </span>
                    <span className="text-xs text-slate-500">
                      Archived {task.archivedAt ? new Date(task.archivedAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <div className="mt-2 min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                    {task.notes?.trim() ? (
                      <p className="mt-1 truncate text-sm text-slate-600">{task.notes.trim()}</p>
                    ) : null}
                  </div>

                  {task.tags.length ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {task.tags.slice(0, 6).map((tag) => (
                        <TagBadge key={tag} tag={tag} />
                      ))}
                      {task.tags.length > 6 ? (
                        <span className="text-xs text-slate-500">+{task.tags.length - 6}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => handleUnarchive(task)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-zinc-100 hover:text-slate-900 transition"
                  title="Restore from archive"
                >
                  <Undo2 className="h-4 w-4" />
                  Restore
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
