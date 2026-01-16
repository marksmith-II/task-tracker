import { ExternalLink, Link as LinkIcon, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { LinkAttachment } from '../types'
import { cn } from '../lib/cn'

function normalizeUrl(raw: string) {
  const t = raw.trim()
  return t
}

export function LinkAttachmentCard(props: { link: LinkAttachment; onDelete?: () => void }) {
  const { link } = props
  const previewImage = link.screenshotUrl || link.imageUrl

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 p-3 hover:bg-zinc-50/70 dark:hover:bg-gray-600/70"
    >
      <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-600">
        {previewImage ? (
          <img src={previewImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500 dark:text-slate-400">
            <LinkIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {link.faviconUrl ? <img src={link.faviconUrl} alt="" className="h-4 w-4 rounded-sm" /> : null}
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{link.title ?? link.url}</p>
            </div>
            {link.description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{link.description}</p> : null}
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{link.url}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-lg p-2 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200" aria-hidden="true" title="Open">
              <ExternalLink className="h-4 w-4" />
            </span>
            {props.onDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  props.onDelete?.()
                }}
                className="rounded-lg p-2 text-slate-500 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-gray-600 hover:text-rose-700 dark:hover:text-rose-400"
                aria-label="Remove link"
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </a>
  )
}

export function LinkAttachmentsSection(props: {
  title?: string
  links: LinkAttachment[]
  disabledReason?: string | null
  onAdd: (url: string) => Promise<void> | void
  onDelete: (id: number) => Promise<void> | void
}) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const disabled = Boolean(props.disabledReason)

  const canAdd = useMemo(() => Boolean(draft.trim()) && !busy && !disabled, [draft, busy, disabled])

  return (
    <div className="mt-5 border-t border-zinc-200 dark:border-zinc-700 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{props.title ?? 'Links'}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Add a URL to see a preview (and optional screenshot).</p>
        </div>
      </div>

      {disabled ? (
        <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">{props.disabledReason}</div>
      ) : null}

      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canAdd) {
              e.preventDefault()
              ;(async () => {
                setBusy(true)
                try {
                  const url = normalizeUrl(draft)
                  await props.onAdd(url)
                  setDraft('')
                } finally {
                  setBusy(false)
                }
              })()
            }
          }}
          className={cn(
            'h-10 flex-1 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 px-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20',
            disabled ? 'opacity-60' : ''
          )}
          placeholder="https://example.com"
          disabled={disabled || busy}
        />
        <button
          type="button"
          onClick={async () => {
            if (!canAdd) return
            setBusy(true)
            try {
              const url = normalizeUrl(draft)
              await props.onAdd(url)
              setDraft('')
            } finally {
              setBusy(false)
            }
          }}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 dark:bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-indigo-500',
            !canAdd ? 'opacity-60' : ''
          )}
          disabled={!canAdd}
        >
          <LinkIcon className="h-4 w-4" />
          Add
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {props.links.length ? (
          props.links.map((l) => (
            <LinkAttachmentCard
              key={l.id}
              link={l}
              onDelete={async () => {
                if (!confirm('Remove this link?')) return
                await props.onDelete(l.id)
              }}
            />
          ))
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-slate-600 dark:text-slate-400">No links yet.</div>
        )}
      </div>
    </div>
  )
}

