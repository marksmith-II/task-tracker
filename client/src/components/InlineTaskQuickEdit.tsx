import { useMemo } from 'react'
import type { TaskPriority, TaskStatus } from '../types'
import { cn } from '../lib/cn'
import { priorityLabel, priorityStyles, statusLabel, statusStyles } from './taskStatus'
import { ChevronRight } from 'lucide-react'

function cycle<T>(items: readonly T[], current: T, dir: 1 | -1) {
  const idx = items.indexOf(current)
  if (idx === -1) return items[0]
  const next = (idx + dir + items.length) % items.length
  return items[next]
}

const STATUS_ORDER: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE'] as const
const PRIORITY_ORDER: readonly (TaskPriority | null)[] = [null, 'LOW', 'MEDIUM', 'HIGH'] as const

export function QuickStatusBadge(props: {
  status: TaskStatus
  disabled?: boolean
  className?: string
  title?: string
  onChange: (next: TaskStatus) => void | Promise<void>
}) {
  const styles = statusStyles(props.status)
  const Icon = styles.icon

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (props.disabled) return
        const dir: 1 | -1 = e.shiftKey ? -1 : 1
        props.onChange(cycle(STATUS_ORDER, props.status, dir))
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset transition',
        styles.badge,
        'hover:brightness-[0.98] dark:hover:brightness-110',
        props.disabled && 'cursor-not-allowed opacity-70',
        props.className
      )}
      title={props.title ?? 'Click to cycle status (Shift+Click to go backwards)'}
      aria-label="Quick edit status"
      disabled={props.disabled}
    >
      <Icon className={cn('h-3.5 w-3.5', props.status === 'IN_PROGRESS' ? 'animate-spin' : '')} />
      {statusLabel(props.status)}
      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
    </button>
  )
}

export function QuickPriorityPill(props: {
  priority: TaskPriority | null
  disabled?: boolean
  hideWhenDone?: boolean
  done?: boolean
  className?: string
  title?: string
  onChange: (next: TaskPriority | null) => void | Promise<void>
}) {
  const styles = priorityStyles(props.priority)
  const Icon = styles.icon

  const shouldHide = Boolean(props.hideWhenDone && props.done)
  if (shouldHide) return null

  return (
    <button
      type="button"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        if (props.disabled) return
        const dir: 1 | -1 = e.shiftKey ? -1 : 1
        props.onChange(cycle(PRIORITY_ORDER, props.priority, dir))
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset transition',
        styles.badge,
        'hover:brightness-[0.98] dark:hover:brightness-110',
        props.disabled && 'cursor-not-allowed opacity-70',
        props.className
      )}
      title={props.title ?? 'Click to cycle priority (Shift+Click to go backwards)'}
      aria-label="Quick edit priority"
      disabled={props.disabled}
    >
      <Icon className={cn('h-3 w-3', styles.iconColor)} />
      {priorityLabel(props.priority) === 'None' ? 'None' : priorityLabel(props.priority)}
      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-70 transition-opacity" />
    </button>
  )
}

export function QuickSelectCheckbox(props: {
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
  title?: string
}) {
  // Keep this as a plain checkbox for accessibility.
  return (
    <input
      type="checkbox"
      checked={props.checked}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => props.onChange(e.target.checked)}
      className={cn('h-4 w-4 accent-slate-900 dark:accent-slate-200', props.className)}
      title={props.title ?? 'Select task'}
      aria-label="Select task"
    />
  )
}

export function useSnooze() {
  return useMemo(() => {
    function addDays(dateStr: string, days: number) {
      const [y, m, d] = dateStr.split('-').map(Number)
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
      dt.setDate(dt.getDate() + days)
      const yyyy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }

    return { addDays }
  }, [])
}

