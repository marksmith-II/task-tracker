import { useCallback } from 'react'
import { Circle, Loader2, CheckCircle2, Plus } from 'lucide-react'
import type { TaskStatus, TaskSummary } from '../types'
import { cn } from '../lib/cn'
import { htmlToPlainText } from '../lib/text'
import { DueDateInlinePill } from './DueDateInlinePill'
import { priorityStyles, getDueDateStatus, dueDateStyles, formatDueDate, getOverdueLevel, overdueCardStyles } from './taskStatus'
import { updateTask } from '../lib/api'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'

const columns: { id: TaskStatus; title: string; icon: typeof Circle; color: string; bg: string }[] = [
  { id: 'TODO', title: 'To Do', icon: Circle, color: 'text-zinc-600', bg: 'bg-zinc-100 dark:bg-zinc-800' },
  { id: 'IN_PROGRESS', title: 'In Progress', icon: Loader2, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/30' },
  { id: 'DONE', title: 'Done', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
]

export function KanbanBoard(props: {
  tasks: TaskSummary[]
  onOpenTask: (id: number) => void
  onNewTask: () => void
  onTaskStatusChange: (taskId: number, newStatus: TaskStatus) => void
  onTaskDueDateChange?: (taskId: number, nextDueDate: string | null) => void | Promise<void>
}) {
  const { tasks, onOpenTask, onNewTask, onTaskStatusChange, onTaskDueDateChange } = props
  const [activeTask, setActiveTask] = useState<TaskSummary | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task || null)
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    
    if (!over) return

    const taskId = active.id as number
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Determine the target column
    let targetStatus: TaskStatus | null = null
    
    // Check if dropped on a column droppable
    if (typeof over.id === 'string' && ['TODO', 'IN_PROGRESS', 'DONE'].includes(over.id)) {
      targetStatus = over.id as TaskStatus
    } else {
      // Dropped on another task - find which column that task is in
      const overTask = tasks.find(t => t.id === over.id)
      if (overTask) {
        targetStatus = overTask.status
      }
    }

    if (targetStatus && targetStatus !== task.status) {
      // Optimistically update via callback
      onTaskStatusChange(taskId, targetStatus)
      
      // Persist to server
      try {
        await updateTask(taskId, { status: targetStatus })
      } catch (error) {
        // Revert on error - the parent will refresh
        console.error('Failed to update task status:', error)
      }
    }
  }, [tasks, onTaskStatusChange])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map((column) => {
          const columnTasks = tasks.filter(t => t.status === column.id)
          return (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={columnTasks}
              onOpenTask={onOpenTask}
              onNewTask={column.id === 'TODO' ? onNewTask : undefined}
              onTaskDueDateChange={onTaskDueDateChange}
            />
          )
        })}
      </div>

      <DragOverlay>
        {activeTask ? <KanbanCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumn(props: {
  column: typeof columns[0]
  tasks: TaskSummary[]
  onOpenTask: (id: number) => void
  onNewTask?: () => void
  onTaskDueDateChange?: (taskId: number, nextDueDate: string | null) => void | Promise<void>
}) {
  const { column, tasks, onOpenTask, onNewTask } = props
  const Icon = column.icon
  
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-2xl border border-zinc-200 dark:border-zinc-700 p-3 min-h-[400px] transition-colors',
        column.bg,
        isOver && 'ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-gray-900'
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', column.color, column.id === 'IN_PROGRESS' && 'animate-spin')} />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{column.title}</h3>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-gray-700 rounded-full px-2 py-0.5">
            {tasks.length}
          </span>
        </div>
        {onNewTask && (
          <button
            type="button"
            onClick={onNewTask}
            className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-gray-700 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Add task"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 p-4 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">No tasks</p>
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onOpen={() => onOpenTask(task.id)}
                onDueDateChange={props.onTaskDueDateChange}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function KanbanCard(props: {
  task: TaskSummary
  onOpen: () => void
  onDueDateChange?: (taskId: number, nextDueDate: string | null) => void | Promise<void>
}) {
  const { task, onOpen } = props
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const pStyles = task.priority ? priorityStyles(task.priority) : null
  const dueDateStatus = getDueDateStatus(task.dueDate)
  const dueStyles = dueDateStyles(dueDateStatus)
  const notesPreview = htmlToPlainText(task.notes)

  // Get overdue level for escalating visual urgency (only for non-DONE tasks)
  const overdueLevel = task.status !== 'DONE' ? getOverdueLevel(task.dueDate) : 0
  const overdueStyles = overdueCardStyles(overdueLevel)

  // Determine card background and border based on overdue status
  const cardBackground = overdueLevel > 0
    ? overdueStyles.background
    : 'bg-white dark:bg-gray-800'

  const cardBorder = overdueLevel > 0
    ? overdueStyles.border
    : 'border-zinc-200 dark:border-zinc-600'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        'group relative rounded-xl border p-3 shadow-sm cursor-pointer transition-all',
        cardBackground,
        cardBorder,
        'hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-500',
        isDragging && 'opacity-50 shadow-lg scale-105',
        task.priority === 'HIGH' && task.status !== 'DONE' && overdueLevel === 0 && 'border-l-4 border-l-rose-400',
        task.priority === 'MEDIUM' && task.status !== 'DONE' && overdueLevel === 0 && 'border-l-4 border-l-amber-400',
        task.priority === 'LOW' && task.status !== 'DONE' && overdueLevel === 0 && 'border-l-4 border-l-sky-400'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{task.title}</h4>
        {task.priority && task.status !== 'DONE' && pStyles && (
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-1.5', pStyles.dot)} />
        )}
      </div>

      {notesPreview ? (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{notesPreview}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {task.dueDate ? (
          props.onDueDateChange ? (
            <DueDateInlinePill
              dueDate={task.dueDate}
              variant="chip"
              showCalendarIcon={false}
              badgeClassName={task.status !== 'DONE' ? dueStyles.badge : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'}
              onChange={(next) => props.onDueDateChange?.(task.id, next)}
              title="Edit due date"
            />
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium',
                task.status !== 'DONE' ? dueStyles.badge : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
              )}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )
        ) : null}
        
        {task.subtaskTotal > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ✓ {task.subtaskCompleted}/{task.subtaskTotal}
          </span>
        )}

        {task.tags.length > 0 && (
          <span className="text-xs text-slate-400 truncate max-w-[100px]">
            {task.tags[0]}
            {task.tags.length > 1 && ` +${task.tags.length - 1}`}
          </span>
        )}
      </div>
    </div>
  )
}

function KanbanCardOverlay(props: { task: TaskSummary }) {
  const { task } = props
  const pStyles = task.priority ? priorityStyles(task.priority) : null

  // Get overdue level for escalating visual urgency (only for non-DONE tasks)
  const overdueLevel = task.status !== 'DONE' ? getOverdueLevel(task.dueDate) : 0
  const overdueStyles = overdueCardStyles(overdueLevel)

  // Determine card background and border based on overdue status
  const cardBackground = overdueLevel > 0
    ? overdueStyles.background
    : 'bg-white dark:bg-gray-800'

  const cardBorder = overdueLevel > 0
    ? overdueStyles.border
    : 'border-zinc-200 dark:border-zinc-600'

  return (
    <div
      className={cn(
        'rounded-xl border p-3 shadow-xl cursor-grabbing',
        cardBackground,
        cardBorder,
        task.priority === 'HIGH' && task.status !== 'DONE' && overdueLevel === 0 && 'border-l-4 border-l-rose-400',
        task.priority === 'MEDIUM' && task.status !== 'DONE' && overdueLevel === 0 && 'border-l-4 border-l-amber-400',
        task.priority === 'LOW' && task.status !== 'DONE' && overdueLevel === 0 && 'border-l-4 border-l-sky-400'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{task.title}</h4>
        {task.priority && task.status !== 'DONE' && pStyles && (
          <span className={cn('h-2 w-2 rounded-full flex-shrink-0 mt-1.5', pStyles.dot)} />
        )}
      </div>
    </div>
  )
}
