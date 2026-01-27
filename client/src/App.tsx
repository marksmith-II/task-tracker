import { useEffect, useMemo, useState, useCallback } from 'react'
import type { TaskDetail, TaskPriority, TaskStatus, TaskSummary } from './types'
import { deleteTask, getTask, listDueReminders, listTasks, reorderTasks, updateTask } from './lib/api'
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

type PersistedFiltersV1 = {
  status: TaskStatus[]
  priority: TaskPriority[]
  due: Array<'overdue' | 'today' | 'soon'>
  tag: string | 'ALL'
}

type SavedFilterV1 = {
  id: string
  name: string
  filters: PersistedFiltersV1
}

const FILTERS_STORAGE_KEY = 'tt:filters:v1'
const SAVED_FILTERS_STORAGE_KEY = 'tt:savedFilters:v1'

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

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [bulkTagDraft, setBulkTagDraft] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const raw = window.localStorage.getItem('tt:viewMode')
    return raw === 'list' || raw === 'cards' || raw === 'kanban' ? raw : 'cards'
  })

  const [sortMode, setSortMode] = useState<'manual' | 'overdue_first'>(() => {
    const raw = window.localStorage.getItem('tt:sortMode')
    return raw === 'overdue_first' ? 'overdue_first' : 'manual'
  })

  const [tab, setTab] = useState<'dashboard' | 'tasks' | 'notes' | 'archived'>(() => {
    const raw = window.localStorage.getItem('tt:tab')
    return raw === 'dashboard' || raw === 'notes' || raw === 'archived' ? raw : 'tasks'
  })
  
  // For opening note modal from header
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [noteToOpenId, setNoteToOpenId] = useState<number | null>(null)

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

  const [savedFilters, setSavedFilters] = useState<SavedFilterV1[]>(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_FILTERS_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as SavedFilterV1[]) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const [activeSavedFilterId, setActiveSavedFilterId] = useState<string>('') // '' = none

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

  const quickUpdateTask = useCallback(
    async (
      taskId: number,
      patch: {
        title?: string
        notes?: string
        status?: TaskStatus
        priority?: TaskPriority | null
        dueDate?: string | null
        tags?: string[]
      }
    ) => {
      // Optimistic update
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
      try {
        const saved = await updateTask(taskId, patch)
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...saved } : t)))
      } catch (err) {
        pushToast('Failed to update task', err instanceof Error ? err.message : 'Failed to update task')
        refreshTasks()
      }
    },
    [pushToast, refreshTasks]
  )

  const changeDueDate = useCallback(
    async (taskId: number, nextDueDate: string | null) => {
      await quickUpdateTask(taskId, { dueDate: nextDueDate })
    },
    [quickUpdateTask]
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
    window.localStorage.setItem('tt:sortMode', sortMode)
  }, [sortMode])

  useEffect(() => {
    window.localStorage.setItem('tt:tab', tab)
  }, [tab])

  // Hydrate filters from URL (preferred) or localStorage (fallback)
  useEffect(() => {
    function parseCsv<T extends string>(raw: string | null, allowed: readonly T[]): T[] {
      if (!raw) return []
      const parts = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean) as T[]
      return parts.filter((p) => allowed.includes(p))
    }

    const url = new URL(window.location.href)
    const sp = url.searchParams
    const hasAny = ['status', 'priority', 'due', 'tag'].some((k) => sp.has(k))

    let source: PersistedFiltersV1 | null = null
    if (hasAny) {
      source = {
        status: parseCsv(sp.get('status'), ['TODO', 'IN_PROGRESS', 'DONE'] as const),
        priority: parseCsv(sp.get('priority'), ['HIGH', 'MEDIUM', 'LOW'] as const),
        due: parseCsv(sp.get('due'), ['overdue', 'today', 'soon'] as const),
        tag: (sp.get('tag') ? String(sp.get('tag')) : 'ALL') as string | 'ALL',
      }
    } else {
      try {
        const raw = window.localStorage.getItem(FILTERS_STORAGE_KEY)
        const parsed = raw ? (JSON.parse(raw) as PersistedFiltersV1) : null
        if (parsed && typeof parsed === 'object') source = parsed
      } catch {
        // ignore
      }
    }

    if (!source) return
    setStatusFilter(Array.isArray(source.status) ? source.status : [])
    setPriorityFilter(Array.isArray(source.priority) ? source.priority : [])
    setDueStatusFilter(Array.isArray(source.due) ? source.due : [])
    setTagFilter(typeof source.tag === 'string' && source.tag.trim() ? source.tag : 'ALL')
  }, [])

  // Persist filters to URL + localStorage
  useEffect(() => {
    const next: PersistedFiltersV1 = { status: statusFilter, priority: priorityFilter, due: dueStatusFilter, tag: tagFilter }
    try {
      window.localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }

    const url = new URL(window.location.href)
    const sp = url.searchParams
    if (statusFilter.length) sp.set('status', statusFilter.join(','))
    else sp.delete('status')
    if (priorityFilter.length) sp.set('priority', priorityFilter.join(','))
    else sp.delete('priority')
    if (dueStatusFilter.length) sp.set('due', dueStatusFilter.join(','))
    else sp.delete('due')
    if (tagFilter !== 'ALL') sp.set('tag', String(tagFilter))
    else sp.delete('tag')
    window.history.replaceState({}, '', url.toString())
  }, [statusFilter, priorityFilter, dueStatusFilter, tagFilter])

  // Avoid accidental bulk actions when the visible set changes
  useEffect(() => {
    setSelectedIds([])
  }, [statusFilter, priorityFilter, dueStatusFilter, tagFilter, sortMode, viewMode, tab])

  // Keep active saved view in sync (clear it when filters diverge)
  useEffect(() => {
    if (!activeSavedFilterId) return
    const saved = savedFilters.find((f) => f.id === activeSavedFilterId)
    if (!saved) return
    const current: PersistedFiltersV1 = { status: statusFilter, priority: priorityFilter, due: dueStatusFilter, tag: tagFilter }
    if (JSON.stringify(saved.filters) !== JSON.stringify(current)) setActiveSavedFilterId('')
  }, [activeSavedFilterId, savedFilters, statusFilter, priorityFilter, dueStatusFilter, tagFilter])

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

  const displayed = useMemo(() => {
    if (sortMode === 'manual') return filtered
    const scoreDue = (t: TaskSummary) => {
      if (t.status === 'DONE') return 99
      const ds = getDueDateStatus(t.dueDate)
      if (ds === 'overdue') return 0
      if (ds === 'today') return 1
      if (ds === 'soon') return 2
      if (ds === 'upcoming') return 3
      return 4
    }

    return [...filtered].sort((a, b) => {
      const sa = scoreDue(a)
      const sb = scoreDue(b)
      if (sa !== sb) return sa - sb

      // Within same bucket: earlier due dates first
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate && !b.dueDate) return -1
      if (!a.dueDate && b.dueDate) return 1

      // Then by priority (HIGH -> LOW -> none)
      const pr = (p: TaskPriority | null) => (p === 'HIGH' ? 0 : p === 'MEDIUM' ? 1 : p === 'LOW' ? 2 : 3)
      const pa = pr(a.priority)
      const pb = pr(b.priority)
      if (pa !== pb) return pa - pb

      // Fallback to existing manual order/id
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      if (so !== 0) return so
      return b.id - a.id
    })
  }, [filtered, sortMode])

  const activeFilterCount =
    (statusFilter.length ? 1 : 0) + (priorityFilter.length ? 1 : 0) + (dueStatusFilter.length ? 1 : 0) + (tagFilter !== 'ALL' ? 1 : 0)

  const clearFilters = useCallback(() => {
    setStatusFilter([])
    setPriorityFilter([])
    setDueStatusFilter([])
    setTagFilter('ALL')
  }, [])

  const toggleSelected = useCallback((taskId: number, selected: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev)
      if (selected) set.add(taskId)
      else set.delete(taskId)
      return Array.from(set)
    })
  }, [])

  // Keyboard-first navigation + selection
  useEffect(() => {
    if (tab !== 'tasks') return

    const handler = (e: KeyboardEvent) => {
      if (modalOpen || searchOpen || shortcutsOpen) return
      const target = e.target as HTMLElement | null
      const isInputActive = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (isInputActive) return

      const activeEl = document.activeElement as HTMLElement | null
      const focusedId =
        activeEl?.id?.startsWith('task-item-') ? Number(activeEl.id.replace('task-item-', '')) : null
      const currentIndex = focusedId ? displayed.findIndex((t) => t.id === focusedId) : -1

      const focusAt = (idx: number) => {
        const t = displayed[idx]
        if (!t) return
        const el = document.getElementById(`task-item-${t.id}`) as HTMLElement | null
        el?.focus()
        el?.scrollIntoView({ block: 'nearest' })
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = Math.min((currentIndex === -1 ? 0 : currentIndex + 1), displayed.length - 1)
        focusAt(next)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = Math.max((currentIndex === -1 ? displayed.length - 1 : currentIndex - 1), 0)
        focusAt(next)
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSelectedIds(displayed.map((t) => t.id))
        return
      }

      if (!focusedId) return

      // Space toggles completion (DONE <-> TODO)
      if (e.key === ' ') {
        e.preventDefault()
        const t = displayed.find((x) => x.id === focusedId)
        if (!t) return
        void quickUpdateTask(focusedId, { status: t.status === 'DONE' ? 'TODO' : 'DONE' })
        return
      }

      // Alt+P cycles priority
      if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        const t = displayed.find((x) => x.id === focusedId)
        if (!t) return
        const order: Array<TaskPriority | null> = [null, 'LOW', 'MEDIUM', 'HIGH']
        const idx = order.indexOf(t.priority ?? null)
        const next = order[(idx + 1) % order.length] ?? null
        void quickUpdateTask(focusedId, { priority: next })
        return
      }

      // Alt+D opens the date picker (if present)
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        const root = document.getElementById(`task-item-${focusedId}`)
        const btn = root?.querySelector('button[aria-label="Edit due date"]') as HTMLButtonElement | null
        btn?.click()
        return
      }
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [tab, displayed, modalOpen, searchOpen, shortcutsOpen, quickUpdateTask])

  // Handle drag end for tasks
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = displayed.findIndex((t) => t.id === active.id)
      const newIndex = displayed.findIndex((t) => t.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(displayed, oldIndex, newIndex)
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
    [displayed, refreshTasks]
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
                clearFilters()
                
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
                  <div className="flex items-end gap-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">View</span>
                      <select
                        value={activeSavedFilterId}
                        onChange={(e) => {
                          const id = e.target.value
                          setActiveSavedFilterId(id)
                          const found = savedFilters.find((f) => f.id === id)
                          if (found) {
                            setStatusFilter(found.filters.status)
                            setPriorityFilter(found.filters.priority)
                            setDueStatusFilter(found.filters.due)
                            setTagFilter(found.filters.tag)
                          }
                        }}
                        className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                        title="Saved filters"
                      >
                        <option value="">Saved views…</option>
                        {savedFilters.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Sort</span>
                      <select
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value === 'overdue_first' ? 'overdue_first' : 'manual')}
                        className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                        title="Sort tasks"
                      >
                        <option value="manual">Manual</option>
                        <option value="overdue_first">Overdue first</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        const name = prompt('Name this filter view:', '')
                        if (!name?.trim()) return
                        const item: SavedFilterV1 = {
                          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                          name: name.trim(),
                          filters: { status: statusFilter, priority: priorityFilter, due: dueStatusFilter, tag: tagFilter },
                        }
                        setSavedFilters((prev) => {
                          const next = [item, ...prev]
                          try {
                            window.localStorage.setItem(SAVED_FILTERS_STORAGE_KEY, JSON.stringify(next))
                          } catch {
                            // ignore
                          }
                          return next
                        })
                        setActiveSavedFilterId(item.id)
                      }}
                      className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-zinc-50 dark:hover:bg-gray-600"
                      title="Save current filters as a view"
                    >
                      Save view
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        clearFilters()
                        setActiveSavedFilterId('')
                      }}
                      className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-zinc-50 dark:hover:bg-gray-600"
                      title="Clear all filters"
                    >
                      Clear
                      {activeFilterCount ? (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs px-2 py-0.5">
                          {activeFilterCount}
                        </span>
                      ) : null}
                    </button>
                  </div>

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

              {selectedIds.length ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-gray-700/40 px-3 py-2">
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">{selectedIds.length}</span> selected
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="ml-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:underline"
                    >
                      Clear selection
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value as TaskStatus | ''
                        if (!v) return
                        ;(async () => {
                          for (const id of selectedIds) await quickUpdateTask(id, { status: v })
                        })()
                        e.target.value = ''
                      }}
                      className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-2 text-sm"
                      title="Bulk status"
                    >
                      <option value="">Status…</option>
                      <option value="TODO">Todo</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>

                    <select
                      defaultValue="__PICK__"
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw === '__PICK__') return
                        const v = raw === '__NONE__' ? null : (raw as TaskPriority)
                        ;(async () => {
                          for (const id of selectedIds) await quickUpdateTask(id, { priority: v })
                        })()
                        e.target.value = '__PICK__'
                      }}
                      className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-2 text-sm"
                      title="Bulk priority"
                    >
                      <option value="__PICK__">Priority…</option>
                      <option value="__NONE__">None</option>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date()
                        const yyyy = today.getFullYear()
                        const mm = String(today.getMonth() + 1).padStart(2, '0')
                        const dd = String(today.getDate()).padStart(2, '0')
                        const date = `${yyyy}-${mm}-${dd}`
                        ;(async () => {
                          for (const id of selectedIds) await quickUpdateTask(id, { dueDate: date })
                        })()
                      }}
                      className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-gray-600"
                      title="Set due date to today"
                    >
                      Due today
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        ;(async () => {
                          for (const id of selectedIds) {
                            const t = tasks.find((x) => x.id === id)
                            if (!t?.dueDate) continue
                            const [y, m, d] = t.dueDate.split('-').map(Number)
                            const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
                            dt.setDate(dt.getDate() + 1)
                            const yyyy = dt.getFullYear()
                            const mm = String(dt.getMonth() + 1).padStart(2, '0')
                            const dd = String(dt.getDate()).padStart(2, '0')
                            await quickUpdateTask(id, { dueDate: `${yyyy}-${mm}-${dd}` })
                          }
                        })()
                      }}
                      className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-gray-600"
                      title="Snooze selected tasks by +1 day"
                    >
                      Snooze +1d
                    </button>

                    <div className="flex items-center gap-2">
                      <input
                        value={bulkTagDraft}
                        onChange={(e) => setBulkTagDraft(e.target.value)}
                        placeholder="Add tag…"
                        className="h-9 w-32 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const tag = bulkTagDraft.trim()
                          if (!tag) return
                          ;(async () => {
                            for (const id of selectedIds) {
                              const t = tasks.find((x) => x.id === id)
                              if (!t) continue
                              const next = Array.from(new Set([...(t.tags ?? []), tag]))
                              await quickUpdateTask(id, { tags: next })
                            }
                          })()
                          setBulkTagDraft('')
                        }}
                        className="h-9 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-2 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-gray-600"
                      >
                        Add
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm(`Delete ${selectedIds.length} task(s)? This cannot be undone.`)) return
                        ;(async () => {
                          for (const id of selectedIds) {
                            try {
                              await deleteTask(id)
                              setTasks((prev) => prev.filter((t) => t.id !== id))
                            } catch (err) {
                              pushToast('Failed to delete task', err instanceof Error ? err.message : 'Failed to delete task')
                            }
                          }
                          setSelectedIds([])
                        })()
                      }}
                      className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-2 text-sm font-medium text-rose-800 hover:bg-rose-100"
                      title="Delete selected tasks"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : null}

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
                    tasks={displayed}
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
                sortMode === 'manual' ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={displayed.map((t) => t.id)} strategy={rectSortingStrategy}>
                      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-6">
                        {displayed.map((t, index) => (
                          <SortableItem key={t.id} id={t.id}>
                            <TaskCard
                              task={t}
                              domId={`task-item-${t.id}`}
                              onOpen={() => openTask(t.id)}
                              onChangeDueDate={(d) => changeDueDate(t.id, d)}
                              onChangeStatus={(s) => quickUpdateTask(t.id, { status: s })}
                              onChangePriority={(p) => quickUpdateTask(t.id, { priority: p })}
                              selected={selectedIds.includes(t.id)}
                              onToggleSelected={(sel) => toggleSelected(t.id, sel)}
                              index={index}
                            />
                          </SortableItem>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-6">
                    {displayed.map((t, index) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        domId={`task-item-${t.id}`}
                        onOpen={() => openTask(t.id)}
                        onChangeDueDate={(d) => changeDueDate(t.id, d)}
                        onChangeStatus={(s) => quickUpdateTask(t.id, { status: s })}
                        onChangePriority={(p) => quickUpdateTask(t.id, { priority: p })}
                        selected={selectedIds.includes(t.id)}
                        onToggleSelected={(sel) => toggleSelected(t.id, sel)}
                        index={index}
                      />
                    ))}
                  </div>
                )
              ) : (
                sortMode === 'manual' ? (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={displayed.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      <div className="mt-5 space-y-2 pl-6">
                        {displayed.map((t, index) => (
                          <SortableItem key={t.id} id={t.id}>
                            <TaskRow
                              task={t}
                              domId={`task-item-${t.id}`}
                              onOpen={() => openTask(t.id)}
                              onChangeDueDate={(d) => changeDueDate(t.id, d)}
                              onChangeStatus={(s) => quickUpdateTask(t.id, { status: s })}
                              onChangePriority={(p) => quickUpdateTask(t.id, { priority: p })}
                              selected={selectedIds.includes(t.id)}
                              onToggleSelected={(sel) => toggleSelected(t.id, sel)}
                              index={index}
                            />
                          </SortableItem>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                ) : (
                  <div className="mt-5 space-y-2 pl-6">
                    {displayed.map((t, index) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        domId={`task-item-${t.id}`}
                        onOpen={() => openTask(t.id)}
                        onChangeDueDate={(d) => changeDueDate(t.id, d)}
                        onChangeStatus={(s) => quickUpdateTask(t.id, { status: s })}
                        onChangePriority={(p) => quickUpdateTask(t.id, { priority: p })}
                        selected={selectedIds.includes(t.id)}
                        onToggleSelected={(sel) => toggleSelected(t.id, sel)}
                        index={index}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          ) : tab === 'notes' ? (
            <NotesPanel 
              openModalFromHeader={noteModalOpen}
              onModalOpened={() => setNoteModalOpen(false)}
              allTasks={tasks}
              openNoteId={noteToOpenId}
              onNoteOpened={() => setNoteToOpenId(null)}
              onOpenTask={(id) => {
                setTab('tasks')
                void openTask(id)
              }}
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
        onOpenNote={(id) => {
          setModalOpen(false)
          setSelectedTask(null)
          setTab('notes')
          setNoteToOpenId(id)
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
          setNoteToOpenId(noteId)
        }}
      />

      <KeyboardShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  )
}
