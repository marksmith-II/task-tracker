import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Plus, Save, Trash2, X } from 'lucide-react'
import type { LinkAttachment, NoteSummary, TaskDetail, TaskLinkedNote, TaskPriority, TaskStatus, TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { formatDateTime } from '../lib/datetime'
import {
  addSubtask,
  addTaskLink,
  archiveTask,
  createNoteFromTask,
  createTask,
  deleteLink,
  deleteSubtask,
  deleteTask,
  linkNoteToTask,
  listNotes,
  unlinkNoteFromTask,
  updateSubtask,
  updateTask,
} from '../lib/api'
import { TagInput } from './TagInput'
import { LinkAttachmentsSection } from './LinkAttachments'
import { RichTextEditor } from './RichTextEditor'

export function TaskDetailModal(props: {
  open: boolean
  task: TaskDetail | null
  allTags: string[]
  onClose: () => void
  onUpsertSummary: (task: TaskSummary) => void
  onDeleted: (id: number) => void
  onArchived?: (id: number) => void
  onRequestRefresh: (id: number) => void | Promise<void>
  onOpenNote?: (id: number) => void
}) {
  const { open, task } = props
  const isNew = !task

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [priority, setPriority] = useState<TaskPriority | null>(null)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [subtasks, setSubtasks] = useState<TaskDetail['subtasks']>([])
  const [linkedNotes, setLinkedNotes] = useState<TaskLinkedNote[]>([])
  const [allNotes, setAllNotes] = useState<NoteSummary[]>([])
  const [noteToLinkId, setNoteToLinkId] = useState<number | ''>('')
  const [links, setLinks] = useState<LinkAttachment[]>([])
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
    setSubtaskDraft('')

    // Only initialize full form state when opening, or when switching tasks.
    // This prevents subtask refreshes from wiping unsaved edits in the modal.
    const nextId = task?.id ?? null
    if (initializedForTaskId.current !== nextId) {
      initializedForTaskId.current = nextId
      setTitle(task?.title ?? '')
      setNotes(task?.notes ?? '')
      setStatus(task?.status ?? 'TODO')
      setPriority(task?.priority ?? null)
      setDueDate(task?.dueDate ?? null)
      setTags(task?.tags ?? [])
    }

    setSubtasks(task?.subtasks ?? [])
    setLinkedNotes(task?.linkedNotes ?? [])
    setLinks(task?.links ?? [])
  }, [open, task?.id, task?.subtasks, task?.linkedNotes, task?.links])

  useEffect(() => {
    if (!open) return
    if (!task?.id) return
    ;(async () => {
      try {
        const notes = await listNotes()
        setAllNotes(notes)
      } catch {
        // best-effort
      }
    })()
  }, [open, task?.id])

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
  const canEditLinks = Boolean(task?.id)
  const canEditNoteLinks = Boolean(task?.id)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        onClick={props.onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{isNew ? 'New Task' : 'Task Details'}</h2>
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
            className="rounded-xl p-2 text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-slate-700 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto px-4 py-4 bg-white dark:bg-gray-800">
          {error ? (
            <div className="mb-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                placeholder="e.g. Finish weekly report"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                >
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Priority</span>
                <select
                  value={priority ?? ''}
                  onChange={(e) => setPriority(e.target.value ? e.target.value as TaskPriority : null)}
                  className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                >
                  <option value="">None</option>
                  <option value="HIGH">🔴 High</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="LOW">🟢 Low</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Due date</span>
                <input
                  type="date"
                  value={dueDate ?? ''}
                  onChange={(e) => setDueDate(e.target.value ? e.target.value : null)}
                  className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20 dark:[color-scheme:dark]"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 grid gap-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Notes</span>
            <RichTextEditor
              content={notes}
              onChange={setNotes}
              placeholder="Optional details... (Paste images with Ctrl+V)"
            />
          </div>

          <div className="mt-4">
            <div className="mb-2">
              <p className="text-xs font-medium text-slate-700">Tags</p>
              <p className="text-xs text-slate-500">Select existing tags or create new ones.</p>
            </div>
            <TagInput
              selectedTags={tags}
              allTags={props.allTags}
              onTagsChange={setTags}
            />
          </div>

          <div className="mt-5 border-t border-zinc-200 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-700">Linked notes</p>
                <p className="text-xs text-slate-500">Connect notes to this task (or create one).</p>
              </div>
              {task?.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!task) return
                    setError(null)
                    try {
                      await createNoteFromTask(task.id)
                      await props.onRequestRefresh(task.id)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to create note')
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  disabled={busy}
                >
                  <Plus className="h-4 w-4" />
                  Create Note
                </button>
              ) : null}
            </div>

            {!canEditNoteLinks ? (
              <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-slate-600">
                Save this task first to link notes.
              </div>
            ) : (
              <>
                <div className="mt-2 space-y-2">
                  {linkedNotes.length ? (
                    linkedNotes.map((n) => (
                      <div key={n.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => props.onOpenNote?.(n.id)}
                            className="block truncate text-left text-sm font-medium text-slate-900 hover:underline"
                            title="Open note"
                          >
                            {n.title}
                          </button>
                          <p className="text-xs text-slate-500 tabular-nums" title={n.updatedAt}>
                            Updated: {formatDateTime(n.updatedAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!task) return
                            if (!confirm('Unlink this note from the task?')) return
                            setError(null)
                            try {
                              await unlinkNoteFromTask(task.id, n.id)
                              setLinkedNotes((prev) => prev.filter((x) => x.id !== n.id))
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Failed to unlink note')
                            }
                          }}
                          className="rounded-lg p-2 text-slate-500 hover:bg-zinc-100 hover:text-rose-700"
                          aria-label="Unlink note"
                          title="Unlink"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-slate-600">
                      No linked notes yet.
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <select
                    value={noteToLinkId}
                    onChange={(e) => setNoteToLinkId(e.target.value ? Number(e.target.value) : '')}
                    className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
                  >
                    <option value="">Link existing note…</option>
                    {allNotes
                      .filter((n) => !linkedNotes.some((ln) => ln.id === n.id))
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!task || !noteToLinkId) return
                      setError(null)
                      try {
                        await linkNoteToTask(task.id, noteToLinkId)
                        await props.onRequestRefresh(task.id)
                        setNoteToLinkId('')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to link note')
                      }
                    }}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-zinc-50"
                    disabled={!noteToLinkId || busy}
                  >
                    Link
                  </button>
                </div>
              </>
            )}
          </div>

          <LinkAttachmentsSection
            links={links}
            disabledReason={!canEditLinks ? 'Save this task first to add links.' : null}
            onAdd={async (url) => {
              if (!task) return
              setError(null)
              try {
                const created = await addTaskLink(task.id, url)
                setLinks((prev) => [created, ...prev])
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to add link')
              }
            }}
            onDelete={async (id) => {
              setError(null)
              try {
                await deleteLink(id)
                setLinks((prev) => prev.filter((l) => l.id !== id))
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete link')
              }
            }}
          />

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
                              if (!task) return
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
                            if (!task) return
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
            <div className="flex items-center gap-2">
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
              {task?.status === 'DONE' && props.onArchived ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!task) return
                    if (!confirm('Archive this completed task? You can restore it later from the Archive tab.')) return
                    setBusy(true)
                    setError(null)
                    try {
                      await archiveTask(task.id)
                      props.onArchived?.(task.id)
                      props.onClose()
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to archive task')
                    } finally {
                      setBusy(false)
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  disabled={busy}
                  title="Move to archive"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              ) : null}
            </div>
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
                  const payload = { title: trimmedTitle, notes, status, priority, dueDate, tags }
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

