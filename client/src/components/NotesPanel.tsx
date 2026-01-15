import { Plus, StickyNote } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { NoteDetail, NoteSummary, TaskSummary } from '../types'
import { getNote, listNotes } from '../lib/api'
import { cn } from '../lib/cn'
import { NoteDetailModal } from './NoteDetailModal'

export function NotesPanel(props: { allTasks: TaskSummary[] }) {
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<NoteDetail | null>(null)

  const [query, setQuery] = useState('')

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
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                title: detail.title,
                excerpt: detail.body.trim().replace(/\s+/g, ' ').slice(0, 180),
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

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Notes</p>
          <p className="text-sm text-slate-600">
            {loading ? 'Loading…' : `Showing ${filtered.length} of ${notes.length}`}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-slate-700">Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/5"
              placeholder="Title or text…"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              setModalOpen(true)
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Note
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      {loading ? (
        <div className="mt-6 text-sm text-slate-600">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">No notes yet.</p>
          <p className="mt-1 text-sm text-slate-600">Create one to start linking tasks and collecting resources.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openNote(n.id)}
              className={cn('group w-full rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm hover:bg-zinc-50/70')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-4 w-4 text-slate-500" />
                    <p className="truncate text-sm font-semibold text-slate-900">{n.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{n.excerpt || '—'}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{n.linkedTaskCount} linked tasks</span>
                <span>Updated {n.updatedAt}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <NoteDetailModal
        open={modalOpen}
        note={selected}
        allTasks={props.allTasks}
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

