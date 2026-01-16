import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/cn'
import { Check, ChevronDown, Plus, X } from 'lucide-react'

type TagInputProps = {
  selectedTags: string[]
  allTags: string[]
  onTagsChange: (tags: string[]) => void
}

export function TagInput({ selectedTags, allTags, onTagsChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on input
  const normalizedInput = inputValue.trim().toLowerCase()
  const suggestions = allTags.filter(
    (tag) =>
      tag.toLowerCase().includes(normalizedInput) &&
      !selectedTags.includes(tag)
  )

  // Check if the exact input already exists (case-insensitive)
  const exactMatch = allTags.find((t) => t.toLowerCase() === normalizedInput)
  const canCreateNew = normalizedInput.length > 0 && !exactMatch && !selectedTags.some((t) => t.toLowerCase() === normalizedInput)

  // Combined list: suggestions + "create new" option
  const options = [
    ...suggestions,
    ...(canCreateNew ? [`__CREATE__:${inputValue.trim()}`] : []),
  ]

  useEffect(() => {
    setHighlightedIndex(0)
  }, [inputValue])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function addTag(tag: string) {
    if (!selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag])
    }
    setInputValue('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function removeTag(tag: string) {
    onTagsChange(selectedTags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (options.length > 0 && highlightedIndex < options.length) {
        const selected = options[highlightedIndex]
        if (selected.startsWith('__CREATE__:')) {
          addTag(selected.replace('__CREATE__:', ''))
        } else {
          addTag(selected)
        }
      } else if (canCreateNew) {
        addTag(inputValue.trim())
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'Backspace' && inputValue === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1])
    }
  }

  return (
    <div className="space-y-2">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-slate-200 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input with dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length > 0 ? 'Add another tag...' : 'Click to see tags or type to create...'}
          className="h-10 w-full rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-700 pl-3 pr-8 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 dark:focus:border-slate-500 focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-slate-500/20"
        />
        <ChevronDown 
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 transition-transform pointer-events-none",
            isOpen && "rotate-180"
          )} 
        />

        {/* Dropdown - always show on focus */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-gray-800 py-1 shadow-lg"
          >
            {/* Header showing available tags count */}
            {allTags.length > 0 && inputValue === '' && (
              <div className="border-b border-zinc-100 dark:border-zinc-700 px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-zinc-50/50 dark:bg-gray-700/50">
                {suggestions.length} tag{suggestions.length !== 1 ? 's' : ''} available — click to add or type to create new
              </div>
            )}

            {options.length === 0 && !canCreateNew ? (
              <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                {inputValue ? 'No matching tags' : allTags.length === 0 ? 'Type to create your first tag' : 'All tags already added'}
              </div>
            ) : (
              options.map((option, index) => {
                const isCreate = option.startsWith('__CREATE__:')
                const displayText = isCreate ? option.replace('__CREATE__:', '') : option
                const isHighlighted = index === highlightedIndex

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      if (isCreate) {
                        addTag(displayText)
                      } else {
                        addTag(option)
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-900 dark:text-slate-100 transition-colors',
                      isHighlighted ? 'bg-slate-100 dark:bg-gray-700' : 'hover:bg-slate-50 dark:hover:bg-gray-700/50'
                    )}
                  >
                    {isCreate ? (
                      <>
                        <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span>
                          Create new: <span className="font-semibold text-emerald-700 dark:text-emerald-400">"{displayText}"</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-slate-400" />
                        <span>{option}</span>
                      </>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
