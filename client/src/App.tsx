import { useEffect, useMemo, useState, useCallback } from 'react'
import type { TaskDetail, TaskPriority, TaskStatus, TaskSummary } from './types'
import { getTask, listDueReminders, listTasks, reorderTasks, updateTask } from './lib/api'
import { Header, type ViewMode } from './components/Header'
import { TaskCard } from './components/TaskCard'
import { TaskRow } from './components/TaskRow'
import { TaskDetailModal } from './components/TaskDetailModal'
import { NotesPanel } from './components/NotesPanel'
import { ArchivedTasksPanel } from './components/ArchivedTasksPanel'
import { SortableItem } from './components/SortableItem'
import { SearchModal } from './components/SearchModal'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { KanbanBoard } from './components/KanbanBoard'
import { Dashboard, type DashboardFilter } from './components/Dashboard'
import { EmptyState } from './components/EmptyState'
import { getDueDateStatus } from './components/taskStatus'
import { MultiSelectFilter, type FilterOption } from './components/MultiSelectFilter'
import { cn } from './lib/cn'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'

function toSummary(detail: TaskDetail): TaskSummary {
  const { subtasks: _subtasks, linkedNotes: _linkedNotes, links: _links, ...summary } = detail
  return summary
}

// Filter options for multi-select dropdowns
const statusOptions: FilterOption<TaskStatus>[] = [
  { value: 'TODO', label: 'Todo' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
]

const priorityOptions: FilterOption<TaskPriority>[] = [
  { value: 'HIGH', label: 'High', icon: '🔴' },
  { value: 'MEDIUM', label: 'Medium', icon: '🟡' },
  { value: 'LOW', label: 'Low', icon: '🟢' },
]

const dueOptions: FilterOption<'overdue' | 'today' | 'soon'>[] = [
  { value: 'overdue', label: 'Overdue', icon: '🔴' },
  { value: 'today', label: 'Due Today', icon: '🟡' },
  { value: 'soon', label: 'Due Soon', icon: '🟠' },
]

export default function App() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Multi-select filters - empty array means "all"
  const [statusFilter, setStatusFilter] = useState<TaskStatus[]>([])
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority[]>([])
  const [dueStatusFilter, setDueStatusFilter] = useState<('overdue' | 'today' | 'soon')[]>([])
  const [tagFilter, setTagFilter] = useState<string | 'ALL'>('ALL')

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const raw = window.localStorage.getItem('tt:viewMode')
    return raw === 'list' || raw === 'cards' || raw === 'kanban' ? raw : 'cards'
  })

  const [tab, setTab] = useState<'dashboard' | 'tasks' | 'notes' | 'archived'>(() => {
    const raw = window.localStorage.getItem('tt:tab')
    return raw === 'dashboard' || raw === 'notes' || raw === 'archived' ? raw : 'tasks'
  })
  
  // For opening note modal from header
  const [noteModalOpen, setNoteModalOpen] = useState(false)

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [toasts, setToasts] = useState<Array<{ id: string; title: string; message: string }>>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<TaskDetail | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [allNotes, setAllNotes] = useState<{ id: number; title: string; excerpt: string; createdAt: string; updatedAt: string; linkedTaskCount: number; sortOrder: number }[]>([])

  const pushToast = useCallback((title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [{ id, title, message }, ...prev].slice(0, 5))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 10000)
  }, [])

  const refreshTasks = useCallback(async () => {
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
  }, [])

  const changeDueDate = useCallback(
    async (taskId: number, nextDueDate: string | null) => {
      // Optimistic update
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, dueDate: nextDueDate } : t)))
      try {
        const saved = await updateTask(taskId, { dueDate: nextDueDate })
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...saved } : t)))
      } catch (err) {
        pushToast('Failed to update due date', err instanceof Error ? err.message : 'Failed to update due date')
        // Best-effort reconcile
        refreshTasks()
      }
    },
    [pushToast, refreshTasks]
  )

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
    // Fetch notes for search
    ;(async () => {
      try {
        const { listNotes } = await import('./lib/api')
        const notes = await listNotes()
        setAllNotes(notes)
      } catch {
        // ignore
      }
    })()
  }, [refreshTasks])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      const target = e.target as HTMLElement
      const isInputActive = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Cmd/Ctrl + K for search (always works)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        return
      }

      // Don't trigger single-key shortcuts if user is typing
      if (isInputActive) return

      // N for new task
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        setSelectedTask(null)
        setModalOpen(true)
        return
      }

      // ? for keyboard shortcuts
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
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
      // Status filter - empty array means all
      if (statusFilter.length > 0 && !statusFilter.includes(t.status)) return false
      // Priority filter - empty array means all
      if (priorityFilter.length > 0 && !priorityFilter.includes(t.priority as TaskPriority)) return false
      // Tag filter
      if (tagFilter !== 'ALL' && !t.tags.includes(tagFilter)) return false
      // Due status filter - empty array means all
      if (dueStatusFilter.length > 0) {
        const dueStatus = getDueDateStatus(t.dueDate)
        if (!dueStatusFilter.includes(dueStatus as 'overdue' | 'today' | 'soon')) return false
      }
      return true
    })
  }, [tasks, statusFilter, priorityFilter, tagFilter, dueStatusFilter])

  // Handle drag end for tasks
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = filtered.findIndex((t) => t.id === active.id)
      const newIndex = filtered.findIndex((t) => t.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(filtered, oldIndex, newIndex)
      const updates = reordered.map((t, i) => ({ id: t.id, sortOrder: i }))

      // Optimistically update local state
      setTasks((prev) => {
        const updated = new Map(updates.map((u) => [u.id, u.sortOrder]))
        return prev
          .map((t) => (updated.has(t.id) ? { ...t, sortOrder: updated.get(t.id)! } : t))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      })

      // Persist to server
      try {
        await reorderTasks(updates)
      } catch {
        // Revert on error by refreshing
        refreshTasks()
      }
    },
    [filtered]
  )

  return (
    <div className="min-h-full">
      <Header
        onNewTask={() => {
          setSelectedTask(null)
          setModalOpen(true)
        }}
        onNewNote={() => {
          setTab('notes')
          setNoteModalOpen(true)
        }}
        onExport={() => {
          window.location.assign('/api/backup')
        }}
        onSearch={() => setSearchOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        viewModeEnabled={tab !== 'notes'}
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

          <div className="mb-4 inline-flex rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setTab('dashboard')}
              className={cn('rounded-xl px-3 py-2 text-sm font-medium', tab === 'dashboard' ? 'bg-zinc-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-gray-700')}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setTab('tasks')}
              className={cn('rounded-xl px-3 py-2 text-sm font-medium', tab === 'tasks' ? 'bg-zinc-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-gray-700')}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setTab('notes')}
              className={cn('rounded-xl px-3 py-2 text-sm font-medium', tab === 'notes' ? 'bg-zinc-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-gray-700')}
            >
              Notes
            </button>
            <button
              type="button"
              onClick={() => setTab('archived')}
              className={cn(
                'rounded-xl px-3 py-2 text-sm font-medium',
                tab === 'archived' ? 'bg-zinc-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-gray-700'
              )}
            >
              Archive
            </button>
          </div>

          {tab === 'dashboard' ? (
            <Dashboard
              tasks={tasks}
              onOpenTask={(id) => openTask(id)}
              onNavigateToTasks={(filter?: DashboardFilter) => {
                // Reset all filters first
                setStatusFilter([])
                setPriorityFilter([])
                setDueStatusFilter([])
                
                // Apply the requested filter (single value from dashboard becomes array with one item)
                if (filter?.status) setStatusFilter([filter.status])
                if (filter?.priority) setPriorityFilter([filter.priority])
                if (filter?.dueStatus) setDueStatusFilter([filter.dueStatus])
                
                // Navigate to tasks tab
                setTab('tasks')
              }}
            />
          ) : tab === 'archived' ? (
            <ArchivedTasksPanel
              onUnarchived={(task) => {
                setTasks((prev) => [task, ...prev])
              }}
            />
          ) : tab === 'tasks' ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tasks</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Showing <span className="font-medium text-slate-900 dark:text-slate-100">{filtered.length}</span> of{' '}
                    <span className="font-medium text-slate-900 dark:text-slate-100">{tasks.length}</span>
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <MultiSelectFilter<TaskStatus>
                    label="Status"
                    options={statusOptions}
                    selected={statusFilter}
                    onChange={setStatusFilter}
                  />

                  <MultiSelectFilter<TaskPriority>
                    label="Priority"
                    options={priorityOptions}
                    selected={priorityFilter}
                    onChange={setPriorityFilter}
                  />

                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Tag</span>
                    <select
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                    >
                      <option value="ALL">All</option>
                      {allTags.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>

                  <MultiSelectFilter<'overdue' | 'today' | 'soon'>
                    label="Due"
                    options={dueOptions}
                    selected={dueStatusFilter}
                    onChange={setDueStatusFilter}
                  />
                </div>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
              ) : null}

              {loading ? (
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-600">
                  <div className="h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  Loading tasks…
                </div>
              ) : tasks.length === 0 && viewMode !== 'kanban' ? (
                <div className="mt-6">
                  <EmptyState
                    variant="tasks"
                    action={{
                      label: 'Create your first task',
                      onClick: () => {
                        setSelectedTask(null)
                        setModalOpen(true)
                      }
                    }}
                  />
                </div>
              ) : filtered.length === 0 && viewMode !== 'kanban' ? (
                <div className="mt-6">
                  <EmptyState variant="filtered" />
                </div>
              ) : viewMode === 'kanban' ? (
                <div className="mt-5">
                  <KanbanBoard
                    tasks={filtered}
                    onOpenTask={(id) => openTask(id)}
                    onNewTask={() => {
                      setSelectedTask(null)
                      setModalOpen(true)
                    }}
                    onTaskStatusChange={(taskId, newStatus) => {
                      setTasks((prev) =>
                        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
                      )
                    }}
                    onTaskDueDateChange={changeDueDate}
                  />
                </div>
              ) : viewMode === 'cards' ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={filtered.map((t) => t.id)} strategy={rectSortingStrategy}>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-6">
                      {filtered.map((t, index) => (
                        <SortableItem key={t.id} id={t.id}>
                          <TaskCard task={t} onOpen={() => openTask(t.id)} onChangeDueDate={(d) => changeDueDate(t.id, d)} index={index} />
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext items={filtered.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="mt-5 space-y-2 pl-6">
                      {filtered.map((t, index) => (
                        <SortableItem key={t.id} id={t.id}>
                          <TaskRow task={t} onOpen={() => openTask(t.id)} onChangeDueDate={(d) => changeDueDate(t.id, d)} index={index} />
                        </SortableItem>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          ) : tab === 'notes' ? (
            <NotesPanel 
              openModalFromHeader={noteModalOpen}
              onModalOpened={() => setNoteModalOpen(false)}
              allTasks={tasks}
              onTaskCreated={(created) => {
                setTasks((prev) => {
                  const exists = prev.some((t) => t.id === created.id)
                  const next = exists ? prev.map((t) => (t.id === created.id ? created : t)) : [created, ...prev]
                  return next.sort((a, b) => {
                    const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
                    if (so !== 0) return so
                    const at = Date.parse(a.createdAt)
                    const bt = Date.parse(b.createdAt)
                    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at
                    return b.id - a.id
                  })
                })

                // Take the user directly into the new task details.
                setTab('tasks')
                void openTask(created.id)
              }}
            />
          ) : null}
        </div>
      </main>

      <TaskDetailModal
        open={modalOpen}
        task={selectedTask}
        allTags={allTags}
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
        onArchived={(id) => {
          setTasks((prev) => prev.filter((t) => t.id !== id))
          setModalOpen(false)
          setSelectedTask(null)
        }}
        onRequestRefresh={(id) => requestRefreshTask(id)}
      />

      <SearchModal
        open={searchOpen}
        tasks={tasks}
        notes={allNotes}
        onClose={() => setSearchOpen(false)}
        onOpenTask={(id) => {
          setSearchOpen(false)
          openTask(id)
        }}
        onOpenNote={(noteId) => {
          setSearchOpen(false)
          setTab('notes')
          void noteId
          // TODO: Open note detail modal
        }}
      />

      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  )
}
