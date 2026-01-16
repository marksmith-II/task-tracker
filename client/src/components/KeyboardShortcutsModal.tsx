import { useEffect } from 'react'
import { X } from 'lucide-react'

const shortcuts = [
  { keys: ['⌘', 'K'], description: 'Open search', windowsKeys: ['Ctrl', 'K'] },
  { keys: ['N'], description: 'Create new task' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
  { keys: ['Esc'], description: 'Close modal / dialog' },
  { keys: ['↑', '↓'], description: 'Navigate search results' },
  { keys: ['Enter'], description: 'Open selected item' },
]

export function KeyboardShortcutsModal(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Keyboard Shortcuts</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-zinc-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => {
              const keys = isMac ? shortcut.keys : (shortcut.windowsKeys || shortcut.keys)
              return (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((key, keyIndex) => (
                      <kbd
                        key={keyIndex}
                        className="inline-flex min-w-[24px] items-center justify-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-xs font-medium text-slate-600"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 rounded-b-2xl">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs font-medium">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
