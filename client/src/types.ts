export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'

export type TaskSummary = {
  id: number
  title: string
  notes: string
  status: TaskStatus
  dueDate: string | null
  tags: string[]
  createdAt: string
  subtaskTotal: number
  subtaskCompleted: number
}

export type Subtask = {
  id: number
  taskId: number
  content: string
  isCompleted: boolean
}

export type TaskDetail = TaskSummary & {
  subtasks: Subtask[]
}

