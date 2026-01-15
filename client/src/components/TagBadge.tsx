import { cn } from '../lib/cn'
import { tagBadgeClasses } from '../lib/tags'

export function TagBadge(props: { tag: string; onRemove?: () => void }) {
  const { tag, onRemove } = props
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tagBadgeClasses(tag)
      )}
    >
      <span className="truncate">{tag}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="rounded-full px-1 text-[11px]/[1] text-slate-700/70 hover:text-slate-900 hover:bg-white/50"
          aria-label={`Remove tag ${tag}`}
          title="Remove"
        >
          ×
        </button>
      ) : null}
    </span>
  )
}

