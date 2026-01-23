import { StickyNote } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { NoteDetail, NoteSummary, TaskSummary } from '../types'
import { getNote, listNotes, reorderNotes } from '../lib/api'
import { cn } from '../lib/cn'
import { formatDateTime } from '../lib/datetime'
import { htmlToPlainText } from '../lib/text'
import { NoteDetailModal } from './NoteDetailModal'
import { SortableItem } from './SortableItem'
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
  rectSortingStrategy,
} from '@dnd-kit/sortable'

export function NotesPanel(props: { 
  openModalFromHeader?: boolean
  onModalOpened?: () => void
  onTaskCreated?: (task: TaskSummary) => void
  allTasks?: TaskSummary[]
}) {
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<NoteDetail | null>(null)

  const [query, setQuery] = useState('')

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

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const data = await listNotes()
      setNotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle opening modal from header
  useEffect(() => {
    if (props.openModalFromHeader) {
      setSelected(null)
      setModalOpen(true)
      props.onModalOpened?.()
    }
  }, [props.openModalFromHeader, props.onModalOpened])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter((n) => n.title.toLowerCase().includes(q) || n.excerpt.toLowerCase().includes(q))
  }, [notes, query])

  async function openNote(id: number) {
    setError(null)
    setModalOpen(true)
    try {
      const detail = await getNote(id)
      setSelected(detail)
    } catch (err) {
      setSelected(null)
      setError(err instanceof Error ? err.message : 'Failed to load note')
    }
  }

  async function requestRefreshNote(id: number) {
    try {
      const detail = await getNote(id)
      setSelected((prev) => (prev?.id === id ? detail : prev))
      const plainText = htmlToPlainText(detail.body)
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                title: detail.title,
                excerpt: plainText.slice(0, 180),
                updatedAt: detail.updatedAt,
                linkedTaskCount: detail.linkedTasks.length,
              }
            : n
        )
      )
    } catch {
      // best-effort
    }
  }

  // Handle drag end for notes
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = filtered.findIndex((n) => n.id === active.id)
      const newIndex = filtered.findIndex((n) => n.id === over.id)

      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(filtered, oldIndex, newIndex)
      const updates = reordered.map((n, i) => ({ id: n.id, sortOrder: i }))

      // Optimistically update local state
      setNotes((prev) => {
        const updated = new Map(updates.map((u) => [u.id, u.sortOrder]))
        return prev
          .map((n) => (updated.has(n.id) ? { ...n, sortOrder: updated.get(n.id)! } : n))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      })

      // Persist to server
      try {
        await reorderNotes(updates)
      } catch {
        // Revert on error by refreshing
        refresh()
      }
    },
    [filtered]
  )

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notes</p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {loading ? 'Loading…' : `Showing ${filtered.length} of ${notes.length}`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
              placeholder="Title or text…"
            />
          </label>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="mt-6 text-sm text-slate-600 dark:text-slate-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700/50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">No notes yet.</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Create one to capture ideas and create tasks.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filtered.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pl-6">
              {filtered.map((n) => (
                <SortableItem key={n.id} id={n.id}>
                  <button
                    type="button"
                    onClick={() => openNote(n.id)}
                    className={cn(
                      'group w-full h-44 rounded-2xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 p-4 text-left shadow-sm',
                      'hover:bg-zinc-50/70 dark:hover:bg-gray-600/70',
                      'flex flex-col'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 line-clamp-4">{n.excerpt || '—'}</p>
                    </div>

                    <div className="mt-auto pt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-zinc-200/70 dark:border-zinc-600/70">
                      <span>{n.linkedTaskCount} linked tasks</span>
                      <span className="tabular-nums" title={n.updatedAt}>
                        Updated {formatDateTime(n.updatedAt)}
                      </span>
                    </div>
                  </button>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <NoteDetailModal
        open={modalOpen}
        note={selected}
        availableTasks={props.allTasks}
        onTaskCreated={(task) => {
          // After creating a task from a note, jump the user into the task flow.
          props.onTaskCreated?.(task)
          setModalOpen(false)
          setSelected(null)
        }}
        onClose={() => {
          setModalOpen(false)
          setSelected(null)
        }}
        onUpsertSummary={(saved) => {
          setNotes((prev) => {
            const exists = prev.some((n) => n.id === saved.id)
            const nextSummary: NoteSummary = {
              id: saved.id,
              title: saved.title,
              excerpt: '',
              createdAt: saved.createdAt,
              updatedAt: saved.updatedAt,
              linkedTaskCount: 0,
              sortOrder: 0,
            }
            return exists ? prev.map((n) => (n.id === saved.id ? { ...n, ...nextSummary } : n)) : [nextSummary, ...prev]
          })
          refresh()
        }}
        onDeleted={(id) => {
          setNotes((prev) => prev.filter((n) => n.id !== id))
          setModalOpen(false)
          setSelected(null)
        }}
        onRequestRefresh={(id) => requestRefreshNote(id)}
      />
    </div>
  )
}

