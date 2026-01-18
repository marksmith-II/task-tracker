import { Calendar } from 'lucide-react'
import type { TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { TagBadge } from './TagBadge'
import { statusLabel, statusStyles, priorityStyles, getDueDateStatus, dueDateStyles, formatDueDate, getOverdueLevel, overdueCardStyles } from './taskStatus'

export function TaskRow(props: { task: TaskSummary; onOpen: () => void; index?: number }) {
  const { task, index = 0 } = props
  const styles = statusStyles(task.status)
  const Icon = styles.icon
  const isEven = index % 2 === 0

  const pStyles = priorityStyles(task.priority)
  const PriorityIcon = pStyles.icon

  const dueDateStatus = getDueDateStatus(task.dueDate)
  const dueStyles = dueDateStyles(dueDateStatus)

  // Get overdue level for escalating visual urgency (only for non-DONE tasks)
  const overdueLevel = task.status !== 'DONE' ? getOverdueLevel(task.dueDate) : 0
  const overdueStyles = overdueCardStyles(overdueLevel)

  const progressText =
    task.subtaskTotal > 0 ? `${Math.min(task.subtaskCompleted, task.subtaskTotal)}/${task.subtaskTotal}` : null

  // Determine row border based on overdue status first, then priority
  const rowBorder = overdueLevel > 0
    ? overdueStyles.border
    : task.priority === 'HIGH' && task.status !== 'DONE'
      ? 'border-rose-300/70'
      : task.priority === 'MEDIUM' && task.status !== 'DONE'
        ? 'border-amber-200/70'
        : styles.border

  // Determine row background - overdue styling takes precedence
  const rowBackground = overdueLevel > 0
    ? `${overdueStyles.background} hover:brightness-95 dark:hover:brightness-110`
    : isEven ? 'bg-white dark:bg-gray-800 hover:bg-zinc-50 dark:hover:bg-gray-700' : 'bg-amber-50/40 dark:bg-gray-800/60 hover:bg-amber-50/60 dark:hover:bg-gray-700/60'

  return (
    <button
      type="button"
      onClick={props.onOpen}
      className={cn(
        'group relative flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200',
        'active:scale-[0.99]',
        rowBackground,
        rowBorder,
        'dark:border-zinc-700'
      )}
    >
      {/* Priority indicator dot */}
      {task.priority && task.status !== 'DONE' && (
        <div className={cn('absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-2 ring-white', pStyles.dot)} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset', styles.badge)}
          >
            <Icon className={cn('h-3.5 w-3.5', task.status === 'IN_PROGRESS' ? 'animate-spin' : '')} />
            {statusLabel(task.status)}
          </span>

          {/* Priority badge */}
          {task.priority && task.status !== 'DONE' && (
            <span
              className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset', pStyles.badge)}
            >
              <PriorityIcon className={cn('h-3 w-3', pStyles.iconColor)} />
              {task.priority === 'HIGH' ? 'High' : task.priority === 'MEDIUM' ? 'Med' : 'Low'}
            </span>
          )}

          {progressText ? <span className="text-xs font-medium text-slate-600">{progressText} subtasks</span> : null}

          {task.dueDate ? (
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
              task.status !== 'DONE' ? dueStyles.badge : 'bg-zinc-50 text-zinc-600 ring-zinc-200'
            )}>
              {dueStyles.icon && task.status !== 'DONE' && <dueStyles.icon className="h-3 w-3" />}
              <Calendar className="h-3.5 w-3.5" />
              {formatDueDate(task.dueDate)}
            </span>
          ) : null}
        </div>

        <div className="mt-2 min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</p>
          {task.notes?.trim() ? <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">{task.notes.trim()}</p> : null}
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

      <span className="shrink-0 self-center rounded-lg px-2 py-1 text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300">Open</span>
    </button>
  )
}
