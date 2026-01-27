import { Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { LinkAttachment, NoteDetail, TaskSummary, TaskStatus } from '../types'
import { cn } from '../lib/cn'
import {
  addNoteLink,
  createNote,
  createTaskFromNote,
  deleteLink,
  deleteNote,
  linkTaskToNote,
  unlinkTaskFromNote,
  updateNote,
} from '../lib/api'
import { LinkAttachmentsSection } from './LinkAttachments'
import { RichTextEditor } from './RichTextEditor'

export function NoteDetailModal(props: {
  open: boolean
  note: NoteDetail | null
  onTaskCreated?: (task: TaskSummary) => void
  availableTasks?: TaskSummary[]
  onOpenTask?: (id: number) => void
  onClose: () => void
  onUpsertSummary: (note: { id: number; title: string; updatedAt: string; createdAt: string }) => void
  onDeleted: (id: number) => void
  onRequestRefresh: (id: number) => void | Promise<void>
}) {
  const { open, note } = props
  const isNew = !note

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [linkedTasks, setLinkedTasks] = useState<TaskSummary[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [existingTaskQuery, setExistingTaskQuery] = useState('')
  const [existingTaskId, setExistingTaskId] = useState<number | ''>('')
  const [links, setLinks] = useState<LinkAttachment[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializedForNoteId = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    setNewTaskTitle('')
    setExistingTaskQuery('')
    setExistingTaskId('')

    const nextId = note?.id ?? null
    if (initializedForNoteId.current !== nextId) {
      initializedForNoteId.current = nextId
      setTitle(note?.title ?? '')
      setBody(note?.body ?? '')
      setLinkedTasks(note?.linkedTasks ?? [])
      setLinks(note?.links ?? [])
    }
  }, [open, note?.id, note?.linkedTasks, note?.links])

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
  }, [open, props.onClose])

  const canCreateTasks = Boolean(note?.id)

  if (!open) return null

  const canEditLinks = Boolean(note?.id)
  const canEditTaskLinks = Boolean(note?.id)

  const availableToLink = (props.availableTasks ?? [])
    .filter((t) => !linkedTasks.some((x) => x.id === t.id))
    .filter((t) => {
      const q = existingTaskQuery.trim().toLowerCase()
      if (!q) return true
      return t.title.toLowerCase().includes(q)
    })
    .slice(0, 100)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
        onClick={props.onClose}
        aria-label="Close modal"
      />

      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{isNew ? 'New Note' : 'Note'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Write notes, create tasks, and attach links.</p>
          </div>

          <button
            type="button"
            onClick={props.onClose}
            className="rounded-xl p-2 text-slate-500 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-auto px-4 py-4">
          {error ? (
            <div className="mb-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">{error}</div>
          ) : null}

          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
              placeholder="e.g. CAP Build Guide"
            />
          </label>

          <div className="mt-3 grid gap-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Body</span>
            <RichTextEditor
              content={body}
              onChange={setBody}
              placeholder="Write your note... (Paste images with Ctrl+V)"
            />
          </div>

          <div className="mt-5 border-t border-zinc-200 dark:border-zinc-700 pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Linked tasks</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Create a new task from this note, or link an existing task.</p>
              </div>
            </div>

            {!canEditTaskLinks ? (
              <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
                Save this note first to create tasks.
              </div>
            ) : (
              <>
                <div className="mt-3 flex gap-2">
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      ;(async () => {
                        if (!note) return
                        const t = newTaskTitle.trim() || title.trim() || 'New task from note'
                        setBusy(true)
                        setError(null)
                        try {
                          const created = await createTaskFromNote(note.id, { title: t, status: 'TODO' as TaskStatus })
                          props.onTaskCreated?.(created)
                          await props.onRequestRefresh(note.id)
                          setLinkedTasks((prev) => [created, ...prev])
                          setNewTaskTitle('')
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to create task')
                        } finally {
                          setBusy(false)
                        }
                      })()
                    }}
                    className="h-10 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                    placeholder="New task title…"
                    disabled={!canCreateTasks || busy}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!note) return
                      const t = newTaskTitle.trim() || title.trim() || 'New task from note'
                      setBusy(true)
                      setError(null)
                      try {
                        const created = await createTaskFromNote(note.id, { title: t, status: 'TODO' as TaskStatus })
                        props.onTaskCreated?.(created)
                        await props.onRequestRefresh(note.id)
                        setLinkedTasks((prev) => [created, ...prev])
                        setNewTaskTitle('')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to create task')
                      } finally {
                        setBusy(false)
                      }
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 dark:bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-indigo-500"
                    disabled={!canCreateTasks || busy}
                    title="Create task (auto-linked)"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </div>

                <div className="mt-3 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700/40 p-3">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Link existing task</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs text-slate-600 dark:text-slate-400">Search</span>
                      <input
                        value={existingTaskQuery}
                        onChange={(e) => setExistingTaskQuery(e.target.value)}
                        className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                        placeholder="Type to filter tasks…"
                        disabled={!canCreateTasks || busy}
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs text-slate-600 dark:text-slate-400">Task</span>
                      <select
                        value={existingTaskId === '' ? '' : String(existingTaskId)}
                        onChange={(e) => setExistingTaskId(e.target.value ? Number(e.target.value) : '')}
                        className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                        disabled={!canCreateTasks || busy}
                      >
                        <option value="">
                          {availableToLink.length ? 'Select a task…' : 'No matching tasks'}
                        </option>
                        {availableToLink.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!note) return
                        if (!existingTaskId) return
                        const taskId = existingTaskId
                        setBusy(true)
                        setError(null)
                        try {
                          await linkTaskToNote(note.id, taskId)
                          const task = (props.availableTasks ?? []).find((t) => t.id === taskId)
                          if (task) setLinkedTasks((prev) => [task, ...prev])
                          await props.onRequestRefresh(note.id)
                          setExistingTaskId('')
                          setExistingTaskQuery('')
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to link task')
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-white dark:bg-gray-800 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 ring-1 ring-inset ring-zinc-200 dark:ring-zinc-600 hover:bg-zinc-100 dark:hover:bg-gray-700"
                      disabled={!canCreateTasks || busy || existingTaskId === ''}
                      title="Link selected task"
                    >
                      <Plus className="h-4 w-4" />
                      Link
                    </button>
                  </div>
                </div>

                <div className="mt-2 space-y-2">
                  {linkedTasks.length ? (
                    linkedTasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 py-2">
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => props.onOpenTask?.(t.id)}
                            className="block truncate text-left text-sm font-medium text-slate-900 dark:text-slate-100 hover:underline"
                            title="Open task"
                          >
                            {t.title}
                          </button>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{t.status}</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!note) return
                            if (!confirm('Unlink this task from the note?')) return
                            setError(null)
                            try {
                              await unlinkTaskFromNote(note.id, t.id)
                              setLinkedTasks((prev) => prev.filter((x) => x.id !== t.id))
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Failed to unlink task')
                            }
                          }}
                          className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-gray-600 hover:text-rose-700 dark:hover:text-rose-400"
                          aria-label="Unlink task"
                          title="Unlink"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
                      No linked tasks yet.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <LinkAttachmentsSection
            links={links}
            disabledReason={!canEditLinks ? 'Save this note first to add links.' : null}
            onAdd={async (url) => {
              if (!note) return
              setError(null)
              try {
                const created = await addNoteLink(note.id, url)
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
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-700 px-4 py-3">
          {!isNew ? (
            <button
              type="button"
              onClick={async () => {
                if (!note) return
                if (!confirm('Delete this note?')) return
                setBusy(true)
                setError(null)
                try {
                  await deleteNote(note.id)
                  props.onDeleted(note.id)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to delete note')
                } finally {
                  setBusy(false)
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/30 px-3 py-2 text-sm font-medium text-rose-800 dark:text-rose-200 hover:bg-rose-100 dark:hover:bg-rose-900/50"
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
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-gray-700"
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
                  const saved = isNew
                    ? await createNote({ title: trimmedTitle, body })
                    : await updateNote(note!.id, { title: trimmedTitle, body })

                  props.onUpsertSummary(saved)
                  props.onClose()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to save note')
                } finally {
                  setBusy(false)
                }
              }}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white shadow-sm',
                busy ? 'bg-slate-400 dark:bg-slate-600' : 'bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500'
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

