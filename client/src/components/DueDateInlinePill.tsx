import { useRef, useState } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '../lib/cn'
import { formatDueDate } from './taskStatus'

export function DueDateInlinePill(props: {
  dueDate: string | null
  badgeClassName: string
  disabled?: boolean
  showCalendarIcon?: boolean
  leadingIcon?: React.ReactNode
  variant?: 'pill' | 'chip'
  title?: string
  onChange: (nextDueDate: string | null) => void | Promise<void>
}) {
  const { disabled = false, showCalendarIcon = true, variant = 'pill' } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  const effectiveDisabled = disabled || saving
  const label = props.dueDate ? formatDueDate(props.dueDate) : 'Set due'

  async function handleChange(next: string | null) {
    setSaving(true)
    try {
      await props.onChange(next)
    } finally {
      setSaving(false)
    }
  }

  function openPicker(e: React.SyntheticEvent) {
    e.stopPropagation()
    if (effectiveDisabled) return
    const el = inputRef.current
    if (!el) return
    // Chromium supports showPicker(); fallback to focus/click.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(el as any).showPicker?.()
    el.focus()
    el.click()
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={openPicker}
        disabled={effectiveDisabled}
        className={cn(
          variant === 'chip'
            ? 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium transition'
            : 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset transition',
          props.badgeClassName,
          effectiveDisabled && 'cursor-not-allowed opacity-70'
        )}
        title={props.title ?? 'Edit due date'}
        aria-label="Edit due date"
      >
        {props.leadingIcon}
        {showCalendarIcon ? <Calendar className="h-3.5 w-3.5" /> : null}
        {label}
      </button>

      <input
        ref={inputRef}
        type="date"
        value={props.dueDate ?? ''}
        onChange={(e) => void handleChange(e.target.value ? e.target.value : null)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="sr-only"
      />
    </span>
  )
}

