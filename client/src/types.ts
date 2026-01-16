export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW'

export type TaskSummary = {
  id: number
  title: string
  notes: string
  status: TaskStatus
  priority: TaskPriority | null
  dueDate: string | null
  tags: string[]
  createdAt: string
  subtaskTotal: number
  subtaskCompleted: number
  sortOrder: number
  archivedAt: string | null
}

export type LinkAttachment = {
  id: number
  ownerType: 'TASK' | 'NOTE'
  ownerId: number
  url: string
  title: string | null
  description: string | null
  imageUrl: string | null
  faviconUrl: string | null
  screenshotUrl: string | null
  lastFetchedAt: string | null
  createdAt: string
  updatedAt: string
}

export type NoteSummary = {
  id: number
  title: string
  excerpt: string
  createdAt: string
  updatedAt: string
  linkedTaskCount: number
  sortOrder: number
}

export type NoteDetail = {
  id: number
  title: string
  body: string
  createdAt: string
  updatedAt: string
  linkedTasks: TaskSummary[]
  links: LinkAttachment[]
}

export type Subtask = {
  id: number
  taskId: number
  content: string
  isCompleted: boolean
}

export type TaskLinkedNote = {
  id: number
  title: string
  createdAt: string
  updatedAt: string
}

export type TaskDetail = TaskSummary & {
  subtasks: Subtask[]
  linkedNotes: TaskLinkedNote[]
  links: LinkAttachment[]
}

export type Reminder = {
  id: number
  targetType: 'TASK' | 'NOTE'
  targetId: number
  dueAt: string
  message: string
  isDone: boolean
  firedAt: string | null
  createdAt: string
}

