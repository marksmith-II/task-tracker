import { Download, LayoutGrid, List, Plus } from 'lucide-react'
import { cn } from '../lib/cn'

export type ViewMode = 'cards' | 'list'

export function Header(props: {
  onNewTask: () => void
  onExport: () => void
  viewMode: ViewMode
  onChangeViewMode: (mode: ViewMode) => void
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">Local Task Tracker</h1>
          <p className="hidden text-sm text-slate-600 sm:block">Local-only. SQLite-backed. Fast.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => props.onChangeViewMode('cards')}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium',
                props.viewMode === 'cards' ? 'bg-zinc-100 text-slate-900' : 'text-slate-700 hover:bg-zinc-50'
              )}
              aria-pressed={props.viewMode === 'cards'}
              aria-label="Card view"
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => props.onChangeViewMode('list')}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium',
                props.viewMode === 'list' ? 'bg-zinc-100 text-slate-900' : 'text-slate-700 hover:bg-zinc-50'
              )}
              aria-pressed={props.viewMode === 'list'}
              aria-label="List view"
              title="List view"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
          <button
            type="button"
            onClick={props.onNewTask}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
          <button
            type="button"
            onClick={props.onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-zinc-50"
          >
            <Download className="h-4 w-4" />
            Export Data
          </button>
        </div>
      </div>
    </header>
  )
}

