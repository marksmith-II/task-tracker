import { useMemo } from 'react'
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  TrendingUp, 
  Calendar,
  AlertTriangle,
  Target,
  Clock,
  Zap,
  ArrowUp,
  ArrowRight,
  ArrowDown
} from 'lucide-react'
import type { TaskPriority, TaskStatus, TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { getDueDateStatus, formatDueDate, dueDateStyles } from './taskStatus'

export type DashboardFilter = {
  status?: TaskStatus
  priority?: TaskPriority
  dueStatus?: 'overdue' | 'today' | 'soon'
}

type DashboardProps = {
  tasks: TaskSummary[]
  onOpenTask: (id: number) => void
  onNavigateToTasks: (filter?: DashboardFilter) => void
}

export function Dashboard({ tasks, onOpenTask, onNavigateToTasks }: DashboardProps) {
  const stats = useMemo(() => {
    const total = tasks.length
    const todo = tasks.filter(t => t.status === 'TODO').length
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length
    const done = tasks.filter(t => t.status === 'DONE').length
    
    const high = tasks.filter(t => t.priority === 'HIGH' && t.status !== 'DONE').length
    const medium = tasks.filter(t => t.priority === 'MEDIUM' && t.status !== 'DONE').length
    const low = tasks.filter(t => t.priority === 'LOW' && t.status !== 'DONE').length

    const overdue = tasks.filter(t => getDueDateStatus(t.dueDate) === 'overdue' && t.status !== 'DONE').length
    const dueToday = tasks.filter(t => getDueDateStatus(t.dueDate) === 'today' && t.status !== 'DONE').length
    const dueSoon = tasks.filter(t => getDueDateStatus(t.dueDate) === 'soon' && t.status !== 'DONE').length

    // Completion rate
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

    // Tasks completed this week
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    
    return {
      total,
      todo,
      inProgress,
      done,
      high,
      medium,
      low,
      overdue,
      dueToday,
      dueSoon,
      completionRate,
    }
  }, [tasks])

  const urgentTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'DONE')
      .filter(t => {
        const dueStatus = getDueDateStatus(t.dueDate)
        return dueStatus === 'overdue' || dueStatus === 'today' || t.priority === 'HIGH'
      })
      .sort((a, b) => {
        // Sort by: overdue first, then today, then high priority
        const aStatus = getDueDateStatus(a.dueDate)
        const bStatus = getDueDateStatus(b.dueDate)
        
        if (aStatus === 'overdue' && bStatus !== 'overdue') return -1
        if (bStatus === 'overdue' && aStatus !== 'overdue') return 1
        if (aStatus === 'today' && bStatus !== 'today') return -1
        if (bStatus === 'today' && aStatus !== 'today') return 1
        if (a.priority === 'HIGH' && b.priority !== 'HIGH') return -1
        if (b.priority === 'HIGH' && a.priority !== 'HIGH') return 1
        return 0
      })
      .slice(0, 5)
  }, [tasks])

  const recentlyCompleted = useMemo(() => {
    return tasks
      .filter(t => t.status === 'DONE')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
  }, [tasks])

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Tasks"
          value={stats.total}
          icon={Target}
          color="bg-indigo-500"
          onClick={() => onNavigateToTasks()}
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          icon={Loader2}
          color="bg-sky-500"
          iconAnimation="animate-spin"
          onClick={() => onNavigateToTasks({ status: 'IN_PROGRESS' })}
        />
        <StatCard
          title="Completed"
          value={stats.done}
          icon={CheckCircle2}
          color="bg-emerald-500"
          onClick={() => onNavigateToTasks({ status: 'DONE' })}
        />
        <StatCard
          title="Completion Rate"
          value={`${stats.completionRate}%`}
          icon={TrendingUp}
          color="bg-violet-500"
          onClick={() => onNavigateToTasks()}
        />
      </div>

      {/* Progress Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Status Breakdown</h3>
          <div className="space-y-4">
            <ProgressBar label="To Do" value={stats.todo} total={stats.total} color="bg-zinc-400" icon={Circle} onClick={() => onNavigateToTasks({ status: 'TODO' })} />
            <ProgressBar label="In Progress" value={stats.inProgress} total={stats.total} color="bg-sky-500" icon={Loader2} iconAnimation="animate-spin" onClick={() => onNavigateToTasks({ status: 'IN_PROGRESS' })} />
            <ProgressBar label="Done" value={stats.done} total={stats.total} color="bg-emerald-500" icon={CheckCircle2} onClick={() => onNavigateToTasks({ status: 'DONE' })} />
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Active by Priority</h3>
          <div className="space-y-4">
            <ProgressBar label="High Priority" value={stats.high} total={stats.todo + stats.inProgress} color="bg-rose-500" icon={ArrowUp} onClick={() => onNavigateToTasks({ priority: 'HIGH' })} />
            <ProgressBar label="Medium Priority" value={stats.medium} total={stats.todo + stats.inProgress} color="bg-amber-500" icon={ArrowRight} onClick={() => onNavigateToTasks({ priority: 'MEDIUM' })} />
            <ProgressBar label="Low Priority" value={stats.low} total={stats.todo + stats.inProgress} color="bg-sky-500" icon={ArrowDown} onClick={() => onNavigateToTasks({ priority: 'LOW' })} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(stats.overdue > 0 || stats.dueToday > 0) && (
        <div className="grid md:grid-cols-3 gap-4">
          {stats.overdue > 0 && (
            <AlertCard
              title="Overdue"
              count={stats.overdue}
              icon={AlertTriangle}
              color="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
              iconColor="text-rose-600 dark:text-rose-400"
              onClick={() => onNavigateToTasks({ dueStatus: 'overdue' })}
            />
          )}
          {stats.dueToday > 0 && (
            <AlertCard
              title="Due Today"
              count={stats.dueToday}
              icon={Calendar}
              color="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              iconColor="text-amber-600 dark:text-amber-400"
              onClick={() => onNavigateToTasks({ dueStatus: 'today' })}
            />
          )}
          {stats.dueSoon > 0 && (
            <AlertCard
              title="Due Soon"
              count={stats.dueSoon}
              icon={Clock}
              color="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
              iconColor="text-orange-600 dark:text-orange-400"
              onClick={() => onNavigateToTasks({ dueStatus: 'soon' })}
            />
          )}
        </div>
      )}

      {/* Task Lists */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Urgent Tasks */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Needs Attention</h3>
          </div>
          {urgentTasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">All caught up! 🎉</p>
              <p className="text-xs text-slate-400 mt-1">No urgent tasks right now</p>
            </div>
          ) : (
            <div className="space-y-2">
              {urgentTasks.map((task) => (
                <TaskListItem key={task.id} task={task} onClick={() => onOpenTask(task.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Recently Completed */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recently Completed</h3>
          </div>
          {recentlyCompleted.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-600 dark:text-slate-400">No completed tasks yet</p>
              <p className="text-xs text-slate-400 mt-1">Complete some tasks to see them here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentlyCompleted.map((task) => (
                <TaskListItem key={task.id} task={task} onClick={() => onOpenTask(task.id)} completed />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard(props: {
  title: string
  value: string | number
  icon: typeof Target
  color: string
  iconAnimation?: string
  onClick?: () => void
}) {
  const Icon = props.icon
  
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-gray-800 p-4 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600 transition-all text-left w-full cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{props.title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{props.value}</p>
        </div>
        <div className={cn('rounded-xl p-3', props.color)}>
          <Icon className={cn('h-5 w-5 text-white', props.iconAnimation)} />
        </div>
      </div>
    </button>
  )
}

function ProgressBar(props: {
  label: string
  value: number
  total: number
  color: string
  icon: typeof Circle
  iconAnimation?: string
  onClick?: () => void
}) {
  const Icon = props.icon
  const percentage = props.total > 0 ? (props.value / props.total) * 100 : 0
  
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="w-full text-left rounded-lg p-2 -mx-2 hover:bg-zinc-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-3.5 w-3.5 text-slate-500 dark:text-slate-400', props.iconAnimation)} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{props.label}</span>
        </div>
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{props.value}</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', props.color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </button>
  )
}

function AlertCard(props: {
  title: string
  count: number
  icon: typeof AlertTriangle
  color: string
  iconColor: string
  onClick?: () => void
}) {
  const Icon = props.icon
  
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn('rounded-xl border p-4 w-full text-left hover:opacity-80 transition-opacity cursor-pointer', props.color)}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn('h-5 w-5', props.iconColor)} />
        <div>
          <p className="text-2xl font-bold">{props.count}</p>
          <p className="text-sm font-medium">{props.title}</p>
        </div>
      </div>
    </button>
  )
}

function TaskListItem(props: {
  task: TaskSummary
  onClick: () => void
  completed?: boolean
}) {
  const { task, onClick, completed } = props
  const dueStatus = getDueDateStatus(task.dueDate)
  const dueStyles = dueDateStyles(dueStatus)
  
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 rounded-xl p-2.5 text-left transition-colors',
        'hover:bg-zinc-50 dark:hover:bg-gray-700',
        completed && 'opacity-60'
      )}
    >
      <div className={cn(
        'h-2 w-2 rounded-full flex-shrink-0',
        completed ? 'bg-emerald-500' :
        task.priority === 'HIGH' ? 'bg-rose-500' :
        task.priority === 'MEDIUM' ? 'bg-amber-500' :
        task.priority === 'LOW' ? 'bg-sky-500' :
        'bg-zinc-300 dark:bg-zinc-600'
      )} />
      <div className="min-w-0 flex-1">
        <p className={cn(
          'text-sm font-medium truncate',
          completed ? 'text-slate-500 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-slate-100'
        )}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {task.dueDate && !completed && (
            <span className={cn('text-xs', dueStyles.text)}>
              {formatDueDate(task.dueDate)}
            </span>
          )}
          {task.subtaskTotal > 0 && (
            <span className="text-xs text-slate-400">
              {task.subtaskCompleted}/{task.subtaskTotal} subtasks
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
