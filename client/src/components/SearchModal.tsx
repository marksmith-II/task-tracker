import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Search, X, CheckSquare } from 'lucide-react'
import type { NoteSummary, TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { statusStyles, priorityStyles, getDueDateStatus, dueDateStyles, formatDueDate } from './taskStatus'

type SearchResult = 
  | { type: 'task'; item: TaskSummary }
  | { type: 'note'; item: NoteSummary }

export function SearchModal(props: {
  open: boolean
  tasks: TaskSummary[]
  notes: NoteSummary[]
  onClose: () => void
  onOpenTask: (id: number) => void
  onOpenNote: (id: number) => void
}) {
  const { open, tasks, notes, onClose, onOpenTask, onOpenNote } = props
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Search results
  const results = useMemo<SearchResult[]>(() => {
    const q = query.toLowerCase().trim()
    if (!q) {
      // Show recent items when no query
      const recentTasks: SearchResult[] = tasks.slice(0, 5).map(t => ({ type: 'task', item: t }))
      const recentNotes: SearchResult[] = notes.slice(0, 3).map(n => ({ type: 'note', item: n }))
      return [...recentTasks, ...recentNotes]
    }

    const matchedTasks: SearchResult[] = tasks
      .filter(t => 
        t.title.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      )
      .slice(0, 10)
      .map(t => ({ type: 'task', item: t }))

    const matchedNotes: SearchResult[] = notes
      .filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map(n => ({ type: 'note', item: n }))

    return [...matchedTasks, ...matchedNotes]
  }, [query, tasks, notes])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results.length, query])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      }
      
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        const selected = results[selectedIndex]
        if (selected.type === 'task') {
          onOpenTask(selected.item.id)
        } else {
          onOpenNote(selected.item.id)
        }
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, results, selectedIndex, onClose, onOpenTask, onOpenNote])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close search"
      />

      <div className="relative w-full max-w-xl rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks and notes..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <div className="flex items-center gap-2">
            <kbd className="hidden sm:inline-flex items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              ESC
            </kbd>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-zinc-100 hover:text-slate-700 sm:hidden"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-slate-500">No results found for "{query}"</p>
              <p className="mt-1 text-xs text-slate-400">Try a different search term</p>
            </div>
          ) : (
            <div className="py-2">
              {!query && (
                <p className="px-4 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Recent items
                </p>
              )}
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.item.id}`}
                  type="button"
                  data-selected={index === selectedIndex}
                  onClick={() => {
                    if (result.type === 'task') {
                      onOpenTask(result.item.id)
                    } else {
                      onOpenNote(result.item.id)
                    }
                    onClose()
                  }}
                  className={cn(
                    'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors',
                    index === selectedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                  )}
                >
                  {result.type === 'task' ? (
                    <TaskSearchResult task={result.item as TaskSummary} query={query} />
                  ) : (
                    <NoteSearchResult note={result.item as NoteSummary} query={query} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-200 bg-white px-1 py-0.5 font-mono">↑</kbd>
              <kbd className="rounded border border-zinc-200 bg-white px-1 py-0.5 font-mono">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono">↵</kbd>
              to open
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskSearchResult(props: { task: TaskSummary; query: string }) {
  const { task } = props
  const sStyles = statusStyles(task.status)
  const StatusIcon = sStyles.icon
  const pStyles = task.priority ? priorityStyles(task.priority) : null
  const dueDateStatus = getDueDateStatus(task.dueDate)
  const dueStyles = dueDateStyles(dueDateStatus)

  return (
    <>
      <div className={cn(
        'mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg',
        task.status === 'DONE' ? 'bg-emerald-100 text-emerald-600' : 
        task.status === 'IN_PROGRESS' ? 'bg-sky-100 text-sky-600' : 
        'bg-zinc-100 text-zinc-600'
      )}>
        <CheckSquare className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
          {task.priority && task.status !== 'DONE' && pStyles && (
            <span className={cn('h-2 w-2 rounded-full flex-shrink-0', pStyles.dot)} />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
            sStyles.badge
          )}>
            <StatusIcon className={cn('h-3 w-3', task.status === 'IN_PROGRESS' ? 'animate-spin' : '')} />
            {task.status === 'IN_PROGRESS' ? 'In Progress' : task.status === 'DONE' ? 'Done' : 'Todo'}
          </span>
          {task.dueDate && (
            <span className={cn('text-xs', task.status !== 'DONE' ? dueStyles.text : 'text-slate-500')}>
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {task.tags.length > 0 && (
            <span className="text-xs text-slate-400 truncate">
              {task.tags.slice(0, 3).join(', ')}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

function NoteSearchResult(props: { note: NoteSummary; query: string }) {
  const { note } = props

  return (
    <>
      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{note.title}</p>
        <p className="truncate text-xs text-slate-500 mt-0.5">{note.excerpt || 'No content'}</p>
      </div>
    </>
  )
}
