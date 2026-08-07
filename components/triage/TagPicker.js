'use client'

/**
 * TagPicker — current tags rendered as removable Tag chips, plus a
 * "+ Add tag" combobox for applying an existing catalogue tag or creating a
 * new one. Tag identity is by NAME (conversation_meta.tags is text[]), so all
 * matching goes through lib/triage.js's normalizeTagName/findExistingTag
 * rather than ad-hoc lowercasing — keeps this component's notion of "does
 * this tag exist" identical to the parent's. Purely a signal layer: onAdd/
 * onRemove/onCreateTag fire intent, the parent owns persistence (including
 * actually inserting a new client_tags row on create).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Tag } from '@/components/ui'
import { normalizeTagName, findExistingTag } from '@/lib/triage'

export default function TagPicker({ tags, catalogue, onAdd, onRemove, onCreateTag }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const appliedTags = tags || []
  const tagCatalogue = catalogue || []
  const appliedNorm = useMemo(
    () => new Set((tags || []).map(normalizeTagName)),
    [tags]
  )

  const suggestions = useMemo(() => {
    const q = normalizeTagName(query)
    return (catalogue || []).filter((t) => {
      const norm = normalizeTagName(t.name)
      if (appliedNorm.has(norm)) return false
      return q ? norm.includes(q) : true
    })
  }, [catalogue, query, appliedNorm])

  const trimmed = query.trim()
  const exactMatch = findExistingTag(tagCatalogue, query)
  const showCreate = trimmed.length > 0 && !exactMatch

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  function colorFor(name) {
    const match = findExistingTag(tagCatalogue, name)
    return match?.color || 'var(--accent)'
  }

  function pick(name) {
    onAdd(name)
    setQuery('')
    inputRef.current?.focus()
  }

  function create() {
    onCreateTag(trimmed)
    setQuery('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key !== 'Enter') return
    // Enter only auto-commits an exact, unambiguous catalogue match — a
    // literal not-yet-in-catalogue name still requires the explicit
    // "Create" button so a typo can't silently mint a new tag.
    if (exactMatch && !appliedNorm.has(normalizeTagName(exactMatch.name))) {
      e.preventDefault()
      pick(exactMatch.name)
    }
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <div className="flex flex-wrap items-center gap-1.5">
        {appliedTags.map((name) => (
          <Tag key={name} label={name} color={colorFor(name)} onRemove={() => onRemove(name)} size="sm" />
        ))}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={open}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-medium text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-white/[0.06] transition-colors border border-dashed border-[var(--glass-border)]"
          style={{ fontFamily: 'var(--font-jakarta)' }}
        >
          + Add tag
        </button>
      </div>

      {open && (
        <div
          className="glass-overlay sheen absolute left-0 top-full mt-1.5 w-56 rounded-[var(--r-sm)] z-50 overflow-hidden"
        >
          <div className="p-2 border-b border-[var(--glass-border)]">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or create tag..."
              aria-label="Search or create tag"
              role="combobox"
              aria-expanded="true"
              aria-controls="tag-picker-listbox"
              autoComplete="off"
              className="w-full px-2.5 py-1.5 rounded-[var(--r-sm)] text-[12.5px] bg-white/[0.05] border border-[var(--glass-border)] text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:outline-none"
              style={{ fontFamily: 'var(--font-jakarta)' }}
            />
          </div>
          <div id="tag-picker-listbox" role="listbox" aria-label="Tag suggestions" className="max-h-56 overflow-y-auto py-1">
            {suggestions.map((t) => (
              <button
                key={t.id}
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => pick(t.name)}
                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-white/[0.06] transition-colors"
                style={{ fontFamily: 'var(--font-jakarta)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: t.color || 'var(--accent)' }}
                  aria-hidden="true"
                />
                <span className="text-[var(--ink-1)] truncate">{t.name}</span>
              </button>
            ))}
            {suggestions.length === 0 && !showCreate && (
              <p className="px-3 py-2 text-[12px] text-[var(--ink-3)]">No matching tags</p>
            )}
            {showCreate && (
              <button
                type="button"
                onClick={create}
                className="w-full text-left px-3 py-1.5 text-[12.5px] text-[var(--accent)] hover:bg-white/[0.06] transition-colors"
                style={{ fontFamily: 'var(--font-jakarta)' }}
              >
                Create &ldquo;{trimmed}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
