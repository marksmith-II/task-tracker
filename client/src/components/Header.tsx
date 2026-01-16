import { Download, LayoutGrid, List, Plus, Search, Keyboard, Moon, Sun, Monitor, Columns3, ChevronDown, FileText, CheckSquare } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/cn'
import { useTheme } from '../lib/theme'

export type ViewMode = 'cards' | 'list' | 'kanban'

export function Header(props: {
  onNewTask: () => void
  onNewNote: () => void
  onExport: () => void
  onSearch: () => void
  onShowShortcuts: () => void
  viewMode: ViewMode
  onChangeViewMode: (mode: ViewMode) => void
}) {
  const { theme, setTheme } = useTheme()
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const newMenuRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newMenuRef.current && !newMenuRef.current.contains(event.target as Node)) {
        setNewMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200/70 dark:border-zinc-700 bg-zinc-50/80 dark:bg-gray-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Focus</h1>
          <p className="hidden text-sm text-slate-600 dark:text-slate-400 sm:block">Less noise, more progress.</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search button */}
          <button
            type="button"
            onClick={props.onSearch}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 shadow-sm hover:bg-zinc-50 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-slate-200"
            title="Search (⌘K)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline-flex items-center rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-medium text-slate-400">
              ⌘K
            </kbd>
          </button>

          {/* View mode toggle */}
          <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-1 shadow-sm">
            <button
              type="button"
              onClick={() => props.onChangeViewMode('cards')}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium',
                props.viewMode === 'cards' ? 'bg-zinc-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-gray-700'
              )}
              aria-pressed={props.viewMode === 'cards'}
              aria-label="Card view"
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden lg:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => props.onChangeViewMode('list')}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium',
                props.viewMode === 'list' ? 'bg-zinc-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-gray-700'
              )}
              aria-pressed={props.viewMode === 'list'}
              aria-label="List view"
              title="List view"
            >
              <List className="h-4 w-4" />
              <span className="hidden lg:inline">List</span>
            </button>
            <button
              type="button"
              onClick={() => props.onChangeViewMode('kanban')}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium',
                props.viewMode === 'kanban' ? 'bg-zinc-100 dark:bg-gray-700 text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-gray-700'
              )}
              aria-pressed={props.viewMode === 'kanban'}
              aria-label="Kanban view"
              title="Kanban view"
            >
              <Columns3 className="h-4 w-4" />
              <span className="hidden lg:inline">Kanban</span>
            </button>
          </div>

          {/* New dropdown button */}
          <div className="relative" ref={newMenuRef}>
            <button
              type="button"
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 dark:hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New</span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', newMenuOpen && 'rotate-180')} />
            </button>
            
            {newMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 shadow-lg z-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    props.onNewTask()
                    setNewMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-gray-700"
                >
                  <CheckSquare className="h-4 w-4 text-indigo-500" />
                  New Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    props.onNewNote()
                    setNewMenuOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-zinc-50 dark:hover:bg-gray-700"
                >
                  <FileText className="h-4 w-4 text-amber-500" />
                  New Note
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={props.onExport}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-slate-900 dark:text-slate-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <button
            type="button"
            onClick={props.onShowShortcuts}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-2 text-slate-500 dark:text-slate-400 shadow-sm hover:bg-zinc-50 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-slate-200"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={cycleTheme}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-2 text-slate-500 dark:text-slate-400 shadow-sm hover:bg-zinc-50 dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-slate-200"
            title={`Theme: ${theme} (click to change)`}
          >
            {theme === 'light' ? (
              <Sun className="h-4 w-4" />
            ) : theme === 'dark' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Monitor className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

