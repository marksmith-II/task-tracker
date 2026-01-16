import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { GripVertical } from 'lucide-react'

type SortableItemProps = {
  id: number
  children: ReactNode
  className?: string
}

export function SortableItem({ id, children, className }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group/sortable',
        isDragging && 'z-50 opacity-90 shadow-2xl scale-[1.02]',
        className
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-1 cursor-grab active:cursor-grabbing',
          'opacity-0 group-hover/sortable:opacity-100 transition-opacity',
          'touch-none'
        )}
        title="Drag to reorder"
      >
        <GripVertical className="h-5 w-5 text-slate-400 hover:text-slate-600" />
      </div>
      {children}
    </div>
  )
}
