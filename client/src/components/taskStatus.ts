import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { TaskSummary } from '../types'

export function statusLabel(status: TaskSummary['status']) {
  return status === 'IN_PROGRESS' ? 'In Progress' : status === 'DONE' ? 'Done' : 'Todo'
}

export function statusStyles(status: TaskSummary['status']) {
  switch (status) {
    case 'DONE':
      return {
        ring: 'ring-emerald-200',
        badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
        icon: CheckCircle2,
        border: 'border-emerald-200/60',
      }
    case 'IN_PROGRESS':
      return {
        ring: 'ring-sky-200',
        badge: 'bg-sky-50 text-sky-800 ring-sky-200',
        icon: Loader2,
        border: 'border-sky-200/60',
      }
    default:
      return {
        ring: 'ring-zinc-200',
        badge: 'bg-zinc-50 text-zinc-800 ring-zinc-200',
        icon: Circle,
        border: 'border-zinc-200/60',
      }
  }
}

