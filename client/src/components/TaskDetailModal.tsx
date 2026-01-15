import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Save, Trash2, X } from 'lucide-react'
import type { TaskDetail, TaskStatus, TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { addSubtask, createTask, deleteSubtask, deleteTask, updateSubtask, updateTask } from '../lib/api'
import { TagBadge } from './TagBadge'

function normalizeTagInput(raw: string) {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function TaskDetailModal(props: {
  open: boolean
  task: TaskDetail | null
  onClose: () => void
  onUpsertSummary: (task: TaskSummary) => void
  onDeleted: (id: number) => void
  onRequestRefresh: (id: number) => void | Promise<void>
}) {
  const { open, task } = props
  const isNew = !task

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [subtasks, setSubtasks] = useState<TaskDetail['subtasks']>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializedForTaskId = useRef<number | null>(null)

  const progress = useMemo(() => {
    const total = subtasks.length
    const done = subtasks.filter((s) => s.isCompleted).length
    return { total, done }
  }, [subtasks])

  useEffect(() => {
    if (!open) return

    setError(null)
    setBusy(false)
    setTagDraft('')
    setSubtaskDraft('')

    // Only initialize full form state when opening, or when switching tasks.
    // This prevents subtask refreshes from wiping unsaved edits in the modal.
    const nextId = task?.id ?? null
    if (initializedForTaskId.current !== nextId) {
      initializedForTaskId.current = nextId
      setTitle(task?.title ?? '')
      setNotes(task?.notes ?? '')
      setStatus(task?.status ?? 'TODO')
      setDueDate(task?.dueDate ?? null)
      setTags(task?.tags ?? [])
    }

    setSubtasks(task?.subtasks ?? [])
  }, [open, task?.id, task?.subtasks])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, props])

  if (!open) return null

  const canEditSubtasks = Boolean(task?.id)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
        onClick={props.onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900">{isNew ? 'New Task' : 'Task Details'}</h2>
            {!isNew ? (
              <p className="text-xs text-slate-500">
                Subtasks: <span className="font-medium text-slate-700">{progress.done}</span>/{progress.total}
              </p>
            ) : (
              <p className="text-xs text-slate-500">Create a task, then manage tags and subtasks.</p>
            )}
          </div>

          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-zinc-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto px-4 py-4">
          {error ? (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                placeholder="e.g. Finish weekly report"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                >
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700">Due date</span>
                <input
                  type="date"
                  value={dueDate ?? ''}
                  onChange={(e) => setDueDate(e.target.value ? e.target.value : null)}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                />
              </label>
            </div>
          </div>

          <label className="mt-3 grid gap-1">
            <span className="text-xs font-medium text-slate-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
              placeholder="Optional details…"
            />
          </label>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-700">Tags</p>
                <p className="text-xs text-slate-500">Comma-separated, press Enter to add.</p>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <TagBadge
                  key={t}
                  tag={t}
                  onRemove={() => {
                    setTags((prev) => prev.filter((x) => x !== t))
                  }}
                />
              ))}
              {tags.length === 0 ? <span className="text-sm text-slate-500/80">No tags</span> : null}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const next = normalizeTagInput(tagDraft)
                    if (next.length) setTags((prev) => Array.from(new Set([...prev, ...next])))
                    setTagDraft('')
                  }
                }}
                className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                placeholder="e.g. Work, Urgent"
              />
              <button
                type="button"
                onClick={() => {
                  const next = normalizeTagInput(tagDraft)
                  if (next.length) setTags((prev) => Array.from(new Set([...prev, ...next])))
                  setTagDraft('')
                }}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-zinc-50"
              >
                Add
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-700">Subtasks</p>
                <p className="text-xs text-slate-500">Checklist items with completion tracking.</p>
              </div>
            </div>

            {!canEditSubtasks ? (
              <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-slate-600">
                Save this task first to add subtasks.
              </div>
            ) : (
              <>
                <div className="mt-2 space-y-2">
                  {subtasks.length ? (
                    subtasks.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2',
                          s.isCompleted ? 'bg-emerald-50/40' : 'bg-white'
                        )}
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={s.isCompleted}
                            onChange={async (e) => {
                              setError(null)
                              try {
                                await updateSubtask(s.id, { isCompleted: e.target.checked })
                                setSubtasks((prev) =>
                                  prev.map((x) => (x.id === s.id ? { ...x, isCompleted: e.target.checked } : x))
                                )
                                await props.onRequestRefresh(task.id)
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'Failed to update subtask')
                              }
                            }}
                            className="h-4 w-4 accent-slate-900"
                          />
                          <span className={cn('truncate text-sm', s.isCompleted ? 'text-slate-500 line-through' : 'text-slate-900')}>
                            {s.content}
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Delete this subtask?')) return
                            setError(null)
                            try {
                              await deleteSubtask(s.id)
                              setSubtasks((prev) => prev.filter((x) => x.id !== s.id))
                              await props.onRequestRefresh(task.id)
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Failed to delete subtask')
                            }
                          }}
                          className="rounded-lg p-2 text-slate-500 hover:bg-zinc-100 hover:text-slate-700"
                          aria-label="Delete subtask"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-slate-600">
                      No subtasks yet.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={subtaskDraft}
                    onChange={(e) => setSubtaskDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        ;(async () => {
                          const content = subtaskDraft.trim()
                          if (!content || !task) return
                          setError(null)
                          try {
                            const created = await addSubtask(task.id, content)
                            setSubtasks((prev) => [...prev, created])
                            setSubtaskDraft('')
                            await props.onRequestRefresh(task.id)
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'Failed to add subtask')
                          }
                        })()
                      }
                    }}
                    className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                    placeholder="Add a subtask…"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const content = subtaskDraft.trim()
                      if (!content || !task) return
                      setError(null)
                      try {
                        const created = await addSubtask(task.id, content)
                        setSubtasks((prev) => [...prev, created])
                        setSubtaskDraft('')
                        await props.onRequestRefresh(task.id)
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to add subtask')
                      }
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
          {!isNew ? (
            <button
              type="button"
              onClick={async () => {
                if (!task) return
                if (!confirm('Delete this task and all its subtasks?')) return
                setBusy(true)
                setError(null)
                try {
                  await deleteTask(task.id)
                  props.onDeleted(task.id)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to delete task')
                } finally {
                  setBusy(false)
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800 hover:bg-rose-100"
              disabled={busy}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={props.onClose}
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-zinc-100"
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                const trimmedTitle = title.trim()
                if (!trimmedTitle) {
                  setError('Title is required')
                  return
                }

                setBusy(true)
                setError(null)
                try {
                  const payload = { title: trimmedTitle, notes, status, dueDate, tags }
                  const saved = isNew ? await createTask(payload) : await updateTask(task!.id, payload)
                  props.onUpsertSummary(saved)
                  props.onClose()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to save task')
                } finally {
                  setBusy(false)
                }
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-sm',
                busy ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'
              )}
              disabled={busy}
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

