import type { TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { htmlToPlainText } from '../lib/text'
import { DueDateInlinePill } from './DueDateInlinePill'
import { TagBadge } from './TagBadge'
import { statusLabel, statusStyles, priorityStyles, getDueDateStatus, dueDateStyles, getOverdueLevel, overdueCardStyles } from './taskStatus'

export function TaskCard(props: {
  task: TaskSummary
  onOpen: () => void
  onChangeDueDate: (nextDueDate: string | null) => void | Promise<void>
  index?: number
}) {
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

  const notesPreview = htmlToPlainText(task.notes)

  // Determine card border based on overdue status first, then priority
  const cardBorder = overdueLevel > 0
    ? overdueStyles.border
    : task.priority === 'HIGH' && task.status !== 'DONE'
      ? 'border-rose-300/70'
      : task.priority === 'MEDIUM' && task.status !== 'DONE'
        ? 'border-amber-200/70'
        : styles.border

  // Determine card background - overdue styling takes precedence
  const cardBackground = overdueLevel > 0
    ? overdueStyles.background
    : isEven ? 'bg-white dark:bg-gray-800' : 'bg-slate-50/60 dark:bg-gray-800/60'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={props.onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          props.onOpen()
        }
      }}
      className={cn(
        'group relative w-full rounded-2xl border p-4 text-left shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]',
        cardBackground,
        cardBorder,
        'dark:border-zinc-700'
      )}
    >
      {/* Priority indicator dot */}
      {task.priority && task.status !== 'DONE' && (
        <div className={cn('absolute -left-1.5 top-4 h-3 w-3 rounded-full ring-2 ring-white', pStyles.dot)} />
      )}

      <div className="flex items-start justify-between gap-3">
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

            {progressText ? (
              <span className="text-xs font-medium text-slate-600">{progressText} subtasks</span>
            ) : null}
          </div>

          <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</span>
          </h3>
        </div>
      </div>

      {notesPreview ? (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap">{notesPreview}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-slate-500/70 dark:text-slate-500">No notes</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {task.dueDate ? (
          <DueDateInlinePill
            dueDate={task.dueDate}
            badgeClassName={task.status !== 'DONE' ? dueStyles.badge : 'bg-zinc-50 text-zinc-600 ring-zinc-200'}
            leadingIcon={dueStyles.icon && task.status !== 'DONE' ? <dueStyles.icon className="h-3 w-3" /> : null}
            onChange={props.onChangeDueDate}
            title="Edit due date"
          />
        ) : null}

        {task.tags.slice(0, 6).map((tag) => (
          <TagBadge key={tag} tag={tag} />
        ))}
        {task.tags.length > 6 ? <span className="text-xs text-slate-500">+{task.tags.length - 6}</span> : null}
      </div>
    </div>
  )
}
