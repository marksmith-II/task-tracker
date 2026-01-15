import { Bell, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { NoteSummary, Reminder, TaskSummary } from '../types'
import { createReminder, deleteReminder, listNotes, listReminders, updateReminder } from '../lib/api'
import { cn } from '../lib/cn'

function fromDatetimeLocalValue(v: string) {
  const d = new Date(v)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString()
}

export function RemindersPanel(props: { allTasks: TaskSummary[] }) {
  const [notes, setNotes] = useState<NoteSummary[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeDone, setIncludeDone] = useState(false)

  const [targetType, setTargetType] = useState<'TASK' | 'NOTE'>('TASK')
  const [targetId, setTargetId] = useState<number | ''>('')
  const [dueAtLocal, setDueAtLocal] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const [r, n] = await Promise.all([listReminders({ includeDone }), listNotes()])
      setReminders(r)
      setNotes(n)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reminders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeDone])

  const targets = useMemo(() => {
    return targetType === 'TASK'
      ? props.allTasks.map((t) => ({ id: t.id, label: t.title }))
      : notes.map((n) => ({ id: n.id, label: n.title }))
  }, [targetType, props.allTasks, notes])

  const canCreate = Boolean(targetId) && Boolean(dueAtLocal) && !busy

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">Reminders</p>
          <p className="text-sm text-slate-600">
            {loading ? 'Loading…' : `Showing ${reminders.length}${includeDone ? '' : ' (active only)'}`}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} className="h-4 w-4 accent-slate-900" />
          Include done
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-xs font-medium text-slate-700">New reminder</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-xs text-slate-600">Type</span>
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value as 'TASK' | 'NOTE')
                setTargetId('')
              }}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none"
              disabled={busy}
            >
              <option value="TASK">Task</option>
              <option value="NOTE">Note</option>
            </select>
          </label>

          <label className="grid gap-1 sm:col-span-2">
            <span className="text-xs text-slate-600">Target</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value ? Number(e.target.value) : '')}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none"
              disabled={busy}
            >
              <option value="">{targetType === 'TASK' ? 'Select task…' : 'Select note…'}</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs text-slate-600">When</span>
            <input
              type="datetime-local"
              value={dueAtLocal}
              onChange={(e) => setDueAtLocal(e.target.value)}
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none"
              disabled={busy}
            />
          </label>
        </div>

        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none"
            placeholder="Message (optional)…"
            disabled={busy}
          />
          <button
            type="button"
            onClick={async () => {
              if (!canCreate || !targetId) return
              const dueAt = fromDatetimeLocalValue(dueAtLocal)
              if (!dueAt) {
                setError('Invalid date/time')
                return
              }
              setBusy(true)
              setError(null)
              try {
                const created = await createReminder({ targetType, targetId, dueAt, message })
                setReminders((prev) => [...prev, created].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)))
                setMessage('')
                setDueAtLocal('')
                setTargetId('')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create reminder')
              } finally {
                setBusy(false)
              }
            }}
            className={cn(
              'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800',
              !canCreate ? 'opacity-60' : ''
            )}
            disabled={!canCreate}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="text-sm text-slate-600">Loading…</div>
        ) : reminders.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-slate-600">No reminders yet.</div>
        ) : (
          reminders
            .slice()
            .sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
            .map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-slate-500" />
                    <p className={cn('truncate text-sm font-medium', r.isDone ? 'text-slate-500 line-through' : 'text-slate-900')}>
                      {r.message || 'Reminder'}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {r.targetType} #{r.targetId} • {new Date(r.dueAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={r.isDone}
                      onChange={async (e) => {
                        setError(null)
                        try {
                          const updated = await updateReminder(r.id, { isDone: e.target.checked })
                          setReminders((prev) => prev.map((x) => (x.id === r.id ? updated : x)))
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to update reminder')
                        }
                      }}
                      className="h-4 w-4 accent-slate-900"
                    />
                    Done
                  </label>

                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm('Delete this reminder?')) return
                      setError(null)
                      try {
                        await deleteReminder(r.id)
                        setReminders((prev) => prev.filter((x) => x.id !== r.id))
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Failed to delete reminder')
                      }
                    }}
                    className="rounded-lg p-2 text-slate-500 hover:bg-zinc-100 hover:text-rose-700"
                    aria-label="Delete reminder"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
        )}
      </div>

      <button
        type="button"
        onClick={refresh}
        className="mt-4 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-zinc-50"
      >
        Refresh
      </button>
    </div>
  )
}

