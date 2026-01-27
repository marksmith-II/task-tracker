import type { TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { htmlToPlainText } from '../lib/text'
import { DueDateInlinePill } from './DueDateInlinePill'
import { TagBadge } from './TagBadge'
import { statusLabel, statusStyles, priorityStyles, getDueDateStatus, dueDateStyles, getOverdueLevel, overdueCardStyles } from './taskStatus'
import { QuickPriorityPill, QuickSelectCheckbox, QuickStatusBadge, useSnooze } from './InlineTaskQuickEdit'

export function TaskRow(props: {
  task: TaskSummary
  onOpen: () => void
  onChangeDueDate: (nextDueDate: string | null) => void | Promise<void>
  onChangeStatus?: (nextStatus: TaskSummary['status']) => void | Promise<void>
  onChangePriority?: (nextPriority: TaskSummary['priority']) => void | Promise<void>
  selected?: boolean
  onToggleSelected?: (selected: boolean) => void
  domId?: string
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
  const { addDays } = useSnooze()

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
    <div
      id={props.domId}
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
        'group relative flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200',
        'active:scale-[0.99]',
        rowBackground,
        rowBorder,
        'dark:border-zinc-700'
      )}
    >
      {/* Bulk select checkbox (shows on hover or when selected) */}
      {props.onToggleSelected ? (
        <div
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/80 dark:bg-gray-900/60 backdrop-blur px-2 py-1',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            props.selected && 'opacity-100'
          )}
        >
          <QuickSelectCheckbox checked={Boolean(props.selected)} onChange={props.onToggleSelected} />
        </div>
      ) : null}

      {/* Priority indicator dot */}
      {task.status !== 'DONE' && props.onChangePriority ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            const order: Array<TaskSummary['priority']> = [null, 'LOW', 'MEDIUM', 'HIGH']
            const idx = order.indexOf(task.priority ?? null)
            const dir: 1 | -1 = e.shiftKey ? -1 : 1
            const next = order[(idx + dir + order.length) % order.length] ?? null
            void props.onChangePriority?.(next)
          }}
          className={cn(
            'absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900 transition',
            task.priority ? pStyles.dot : 'bg-zinc-200 dark:bg-zinc-700',
            'hover:scale-110'
          )}
          title="Click to cycle priority (Shift+Click backwards)"
          aria-label="Quick edit priority"
        />
      ) : task.priority && task.status !== 'DONE' ? (
        <div className={cn('absolute -left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full ring-2 ring-white', pStyles.dot)} />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {props.onChangeStatus ? (
            <QuickStatusBadge status={task.status} onChange={props.onChangeStatus} />
          ) : (
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset', styles.badge)}>
              <Icon className={cn('h-3.5 w-3.5', task.status === 'IN_PROGRESS' ? 'animate-spin' : '')} />
              {statusLabel(task.status)}
            </span>
          )}

          {/* Priority badge */}
          {props.onChangePriority ? (
            <QuickPriorityPill
              priority={task.priority}
              done={task.status === 'DONE'}
              hideWhenDone
              onChange={props.onChangePriority}
            />
          ) : task.priority && task.status !== 'DONE' ? (
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset', pStyles.badge)}>
              <PriorityIcon className={cn('h-3 w-3', pStyles.iconColor)} />
              {task.priority === 'HIGH' ? 'High' : task.priority === 'MEDIUM' ? 'Med' : 'Low'}
            </span>
          ) : null}

          {progressText ? <span className="text-xs font-medium text-slate-600">{progressText} subtasks</span> : null}

          {task.dueDate ? (
            <>
              <DueDateInlinePill
                dueDate={task.dueDate}
                badgeClassName={task.status !== 'DONE' ? dueStyles.badge : 'bg-zinc-50 text-zinc-600 ring-zinc-200'}
                leadingIcon={dueStyles.icon && task.status !== 'DONE' ? <dueStyles.icon className="h-3 w-3" /> : null}
                onChange={props.onChangeDueDate}
                title="Edit due date"
              />
              {dueDateStatus === 'overdue' && task.status !== 'DONE' ? (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!task.dueDate) return
                    void props.onChangeDueDate(addDays(task.dueDate, 1))
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium rounded-full px-2 py-0.5 bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100"
                  title="Snooze +1 day"
                >
                  Snooze +1d
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="mt-2 min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{task.title}</p>
          {notesPreview ? <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">{notesPreview}</p> : null}
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
    </div>
  )
}
