import { Calendar } from 'lucide-react'
import type { TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { TagBadge } from './TagBadge'
import { statusLabel, statusStyles } from './taskStatus'

export function TaskCard(props: { task: TaskSummary; onOpen: () => void }) {
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
        'group relative w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition',
        'hover:-translate-y-0.5 hover:shadow-md',
        styles.border
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset', styles.badge)}
            >
              <Icon className={cn('h-3.5 w-3.5', task.status === 'IN_PROGRESS' ? 'animate-spin' : '')} />
              {statusLabel(task.status)}
            </span>

            {progressText ? (
              <span className="text-xs font-medium text-slate-600">{progressText} subtasks</span>
            ) : null}
          </div>

          <h3 className="mt-2 text-sm font-semibold text-slate-900">
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</span>
          </h3>
        </div>
      </div>

      {task.notes?.trim() ? (
        <p className="mt-2 text-sm text-slate-600">
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{task.notes.trim()}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-500/70">No notes</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {task.dueDate ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', styles.ring, 'text-slate-700')}>
            <Calendar className="h-3.5 w-3.5 text-slate-500" />
            {task.dueDate}
          </span>
        ) : null}

        {task.tags.slice(0, 6).map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
        {task.tags.length > 6 ? <span className="text-xs text-slate-500">+{task.tags.length - 6}</span> : null}
      </div>
    </button>
  )
}

