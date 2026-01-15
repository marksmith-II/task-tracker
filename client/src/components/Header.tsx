import { Download, Plus } from 'lucide-react'

export function Header(props: { onNewTask: () => void; onExport: () => void }) {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-zinc-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">Local Task Tracker</h1>
          <p className="hidden text-sm text-slate-600 sm:block">Local-only. SQLite-backed. Fast.</p>
        </div>

        <div className="flex items-center gap-2">
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

