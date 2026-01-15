import { Calendar } from 'lucide-react'
import type { TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { TagBadge } from './TagBadge'
import { statusLabel, statusStyles } from './taskStatus'

export function TaskRow(props: { task: TaskSummary; onOpen: () => void }) {
  const { task } = props
  const styles = statusStyles(task.status)
  const Icon = styles.icon

  const progressText =
    task.subtaskTotal > 0 ? `${Math.min(task.subtaskCompleted, task.subtaskTotal)}/${task.subtaskTotal}` : null

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={cn(
        'group flex w-full items-start justify-between gap-3 rounded-xl border bg-white px-3 py-3 text-left transition',
        'hover:bg-zinc-50/70',
        styles.border
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset', styles.badge)}
          >
            <Icon className={cn('h-3.5 w-3.5', task.status === 'IN_PROGRESS' ? 'animate-spin' : '')} />
            {statusLabel(task.status)}
          </span>

          {progressText ? <span className="text-xs font-medium text-slate-600">{progressText} subtasks</span> : null}

          {task.dueDate ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                styles.ring,
                'text-slate-700'
              )}
            >
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              {task.dueDate}
            </span>
          ) : null}
        </div>

        <div className="mt-2 min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
          {task.notes?.trim() ? <p className="mt-1 truncate text-sm text-slate-600">{task.notes.trim()}</p> : null}
        </div>

        {task.tags.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.tags.slice(0, 10).map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
            {task.tags.length > 10 ? <span className="text-xs text-slate-500">+{task.tags.length - 10}</span> : null}
          </div>
        ) : null}
      </div>

      <span className="shrink-0 self-center rounded-lg px-2 py-1 text-xs text-slate-500 group-hover:text-slate-700">Open</span>
    </button>
  )
}

