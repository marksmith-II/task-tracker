import { 
  CheckCircle2, 
  FileText, 
  Bell, 
  Archive, 
  Search, 
  Inbox,
  Target,
  Coffee,
  Sparkles,
  type LucideIcon 
} from 'lucide-react'
import { cn } from '../lib/cn'

type EmptyStateVariant = 
  | 'tasks' 
  | 'notes' 
  | 'reminders' 
  | 'archive' 
  | 'search' 
  | 'filtered'
  | 'success'

type EmptyStateProps = {
  variant: EmptyStateVariant
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

const variants: Record<EmptyStateVariant, { 
  icon: LucideIcon 
  title: string 
  description: string 
  color: string 
  bg: string 
}> = {
  tasks: {
    icon: Inbox,
    title: 'No tasks yet',
    description: 'Create your first task to get started with tracking your work.',
    color: 'text-indigo-500',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
  },
  notes: {
    icon: FileText,
    title: 'No notes yet',
    description: 'Create a note to capture ideas, meeting notes, or documentation.',
    color: 'text-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  reminders: {
    icon: Bell,
    title: 'No reminders set',
    description: 'Add reminders to tasks or notes to stay on top of deadlines.',
    color: 'text-violet-500',
    bg: 'bg-violet-100 dark:bg-violet-900/30',
  },
  archive: {
    icon: Archive,
    title: 'Archive is empty',
    description: 'Completed tasks that you archive will appear here.',
    color: 'text-slate-500',
    bg: 'bg-slate-100 dark:bg-slate-800',
  },
  search: {
    icon: Search,
    title: 'No results found',
    description: 'Try adjusting your search or filters to find what you\'re looking for.',
    color: 'text-sky-500',
    bg: 'bg-sky-100 dark:bg-sky-900/30',
  },
  filtered: {
    icon: Target,
    title: 'No matching tasks',
    description: 'Try changing your filters, or create a new task that matches.',
    color: 'text-rose-500',
    bg: 'bg-rose-100 dark:bg-rose-900/30',
  },
  success: {
    icon: CheckCircle2,
    title: 'All caught up!',
    description: 'You\'ve completed everything. Time for a well-deserved break!',
    color: 'text-emerald-500',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
}

// Fun messages for the success state
const successMessages = [
  { icon: Coffee, text: 'Time for a coffee break! ☕' },
  { icon: Sparkles, text: 'You\'re crushing it! ✨' },
  { icon: Target, text: 'Productivity level: Expert! 🎯' },
]

export function EmptyState({ variant, title, description, action, className }: EmptyStateProps) {
  const config = variants[variant]
  const Icon = config.icon
  
  // Random success message
  const successMsg = successMessages[Math.floor(Math.random() * successMessages.length)]
  const isSuccess = variant === 'success'

  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-600 py-12 px-6 text-center animate-fadeIn',
      className
    )}>
      <div className={cn(
        'mb-4 rounded-2xl p-4 transition-transform hover:scale-105',
        config.bg
      )}>
        <Icon className={cn('h-8 w-8', config.color)} />
      </div>
      
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title || config.title}
      </h3>
      
      <p className="mt-1 max-w-sm text-sm text-slate-600 dark:text-slate-400">
        {description || config.description}
      </p>

      {isSuccess && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <successMsg.icon className="h-4 w-4" />
          <span>{successMsg.text}</span>
        </div>
      )}
      
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
