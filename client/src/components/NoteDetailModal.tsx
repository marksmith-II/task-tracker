import { Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  allTasks: TaskSummary[]
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
  const [taskToLinkId, setTaskToLinkId] = useState<number | ''>('')
  const [links, setLinks] = useState<LinkAttachment[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initializedForNoteId = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    setTaskToLinkId('')

    const nextId = note?.id ?? null
    if (initializedForNoteId.current !== nextId) {
      initializedForNoteId.current = nextId
      setTitle(note?.title ?? '')
      setBody(note?.body ?? '')
    }

    setLinkedTasks(note?.linkedTasks ?? [])
    setLinks(note?.links ?? [])
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

  const availableTasks = useMemo(() => {
    const linkedIds = new Set(linkedTasks.map((t) => t.id))
    return props.allTasks.filter((t) => !linkedIds.has(t.id))
  }, [linkedTasks, props.allTasks])

  if (!open) return null

  const canEditLinks = Boolean(note?.id)
  const canEditTaskLinks = Boolean(note?.id)

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
            <p className="text-xs text-slate-500 dark:text-slate-400">Write notes, link tasks, and attach links.</p>
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
                <p className="text-xs text-slate-500 dark:text-slate-400">Connect tasks to this note (or create one).</p>
              </div>
              {note?.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!note) return
                    setError(null)
                    try {
                      const created = await createTaskFromNote(note.id, { title: title.trim() || 'New task from note', status: 'TODO' as TaskStatus })
                      // Refresh note (so the new task appears linked) and also let the parent update task list if desired.
                      await props.onRequestRefresh(note.id)
                      setLinkedTasks((prev) => [created, ...prev])
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to create task')
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-indigo-500"
                  disabled={busy}
                >
                  <Plus className="h-4 w-4" />
                  Create Task
                </button>
              ) : null}
            </div>

            {!canEditTaskLinks ? (
              <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">
                Save this note first to link tasks.
              </div>
            ) : (
              <>
                <div className="mt-2 space-y-2">
                  {linkedTasks.length ? (
                    linkedTasks.map((t) => (
                      <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
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

                <div className="mt-3 flex gap-2">
                  <select
                    value={taskToLinkId}
                    onChange={(e) => setTaskToLinkId(e.target.value ? Number(e.target.value) : '')}
                    className="h-10 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
                  >
                    <option value="">Link existing task…</option>
                    {availableTasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!note || !taskToLinkId) return
                      setError(null)
                      try {
                        await linkTaskToNote(note.id, taskToLinkId)
                        const linked = props.allTasks.find((t) => t.id === taskToLinkId)
                        if (linked) setLinkedTasks((prev) => [linked, ...prev])
                        setTaskToLinkId('')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to link task')
                      }
                    }}
                    className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm font-medium text-slate-900 dark:text-slate-100 hover:bg-zinc-50 dark:hover:bg-gray-600"
                    disabled={!taskToLinkId || busy}
                  >
                    Link
                  </button>
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

