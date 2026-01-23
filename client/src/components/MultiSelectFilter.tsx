import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../lib/cn'

export type FilterOption<T extends string> = {
  value: T
  label: string
  icon?: string
}

type MultiSelectFilterProps<T extends string> = {
  label: string
  options: FilterOption<T>[]
  selected: T[]
  onChange: (selected: T[]) => void
  allLabel?: string
}

export function MultiSelectFilter<T extends string>({
  label,
  options,
  selected,
  onChange,
  allLabel = 'All',
}: MultiSelectFilterProps<T>) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on escape
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const isAllSelected = selected.length === 0
  const selectedCount = selected.length

  const toggleOption = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const selectAll = () => {
    onChange([])
  }

  const getDisplayLabel = () => {
    if (isAllSelected) return allLabel
    if (selectedCount === 1) {
      const opt = options.find((o) => o.value === selected[0])
      return opt ? `${opt.icon ? opt.icon + ' ' : ''}${opt.label}` : allLabel
    }
    return `${selectedCount} selected`
  }

  return (
    <div className="grid gap-1" ref={containerRef}>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none',
            'hover:border-zinc-300 dark:hover:border-zinc-500',
            'focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20',
            open && 'border-slate-400 dark:border-slate-500 ring-4 ring-slate-900/5 dark:ring-slate-500/20'
          )}
        >
          <span className="truncate">{getDisplayLabel()}</span>
          <ChevronDown className={cn('h-4 w-4 text-slate-500 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[160px] rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-800 p-1 shadow-lg">
            {/* All option */}
            <button
              type="button"
              onClick={selectAll}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left transition-colors',
                'hover:bg-zinc-50 dark:hover:bg-gray-700',
                isAllSelected && 'bg-zinc-50 dark:bg-gray-700'
              )}
            >
              <div
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded border',
                  isAllSelected
                    ? 'border-slate-900 dark:border-slate-400 bg-slate-900 dark:bg-slate-500'
                    : 'border-zinc-300 dark:border-zinc-600'
                )}
              >
                {isAllSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="text-slate-700 dark:text-slate-300">{allLabel}</span>
            </button>

            <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-700" />

            {/* Individual options */}
            {options.map((option) => {
              const isSelected = selected.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-left transition-colors',
                    'hover:bg-zinc-50 dark:hover:bg-gray-700',
                    isSelected && 'bg-zinc-50 dark:bg-gray-700'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      isSelected
                        ? 'border-slate-900 dark:border-slate-400 bg-slate-900 dark:bg-slate-500'
                        : 'border-zinc-300 dark:border-zinc-600'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">
                    {option.icon && <span className="mr-1">{option.icon}</span>}
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
