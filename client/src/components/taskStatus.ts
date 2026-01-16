import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { TaskPriority, TaskSummary } from '../types'

export function statusLabel(status: TaskSummary['status']) {
  return status === 'IN_PROGRESS' ? 'In Progress' : status === 'DONE' ? 'Done' : 'Todo'
}

export function statusStyles(status: TaskSummary['status']) {
  switch (status) {
    case 'DONE':
      return {
        ring: 'ring-emerald-200 dark:ring-emerald-800',
        badge: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-700',
        icon: CheckCircle2,
        border: 'border-emerald-200/60 dark:border-emerald-700/60',
      }
    case 'IN_PROGRESS':
      return {
        ring: 'ring-sky-200 dark:ring-sky-800',
        badge: 'bg-sky-50 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 ring-sky-200 dark:ring-sky-700',
        icon: Loader2,
        border: 'border-sky-200/60 dark:border-sky-700/60',
      }
    default:
      return {
        ring: 'ring-zinc-200 dark:ring-zinc-700',
        badge: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 ring-zinc-200 dark:ring-zinc-700',
        icon: Circle,
        border: 'border-zinc-200/60 dark:border-zinc-700/60',
      }
  }
}

// Priority utilities
export function priorityLabel(priority: TaskPriority | null) {
  switch (priority) {
    case 'HIGH':
      return 'High'
    case 'MEDIUM':
      return 'Medium'
    case 'LOW':
      return 'Low'
    default:
      return 'None'
  }
}

export function priorityStyles(priority: TaskPriority | null) {
  switch (priority) {
    case 'HIGH':
      return {
        badge: 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 ring-rose-200 dark:ring-rose-700',
        icon: ArrowUp,
        iconColor: 'text-rose-600 dark:text-rose-400',
        dot: 'bg-rose-500',
      }
    case 'MEDIUM':
      return {
        badge: 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 ring-amber-200 dark:ring-amber-700',
        icon: ArrowRight,
        iconColor: 'text-amber-600 dark:text-amber-400',
        dot: 'bg-amber-500',
      }
    case 'LOW':
      return {
        badge: 'bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 ring-sky-200 dark:ring-sky-700',
        icon: ArrowDown,
        iconColor: 'text-sky-600 dark:text-sky-400',
        dot: 'bg-sky-500',
      }
    default:
      return {
        badge: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ring-zinc-200 dark:ring-zinc-700',
        icon: Circle,
        iconColor: 'text-zinc-400',
        dot: 'bg-zinc-300 dark:bg-zinc-600',
      }
  }
}

// Due date intelligence
export type DueDateStatus = 'overdue' | 'today' | 'soon' | 'upcoming' | 'none'

export function getDueDateStatus(dueDate: string | null): DueDateStatus {
  if (!dueDate) return 'none'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'overdue'
  if (diffDays === 0) return 'today'
  if (diffDays <= 3) return 'soon'
  return 'upcoming'
}

export function dueDateStyles(status: DueDateStatus) {
  switch (status) {
    case 'overdue':
      return {
        badge: 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 ring-rose-300 dark:ring-rose-700',
        text: 'text-rose-700 dark:text-rose-400',
        icon: AlertTriangle,
        label: 'Overdue',
      }
    case 'today':
      return {
        badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 ring-amber-300 dark:ring-amber-700',
        text: 'text-amber-700 dark:text-amber-400',
        icon: null,
        label: 'Due today',
      }
    case 'soon':
      return {
        badge: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 ring-orange-200 dark:ring-orange-700',
        text: 'text-orange-600 dark:text-orange-400',
        icon: null,
        label: 'Due soon',
      }
    default:
      return {
        badge: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 ring-zinc-200 dark:ring-zinc-700',
        text: 'text-slate-600 dark:text-slate-400',
        icon: null,
        label: null,
      }
  }
}

export function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
