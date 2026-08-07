'use client'

/**
 * PrioritySelector — popover priority picker. Shows the current priority via
 * PriorityBadge ("No priority" in muted text when `value` is null). Click
 * opens a menu listing all four PRIORITIES from lib/triage.js plus a "Clear"
 * option. Closes on outside click and Escape — same relative/absolute +
 * document-listener pattern as the other dropdowns in this codebase (see
 * components/NotificationBell.js): no portal/floating-ui needed.
 */

import { useEffect, useRef, useState } from 'react'
import { PriorityBadge } from '@/components/ui'
import { PRIORITIES } from '@/lib/triage'

const SIZES = {
  sm: { trigger: 'px-2 py-1', menuItem: 'px-2.5 py-1.5 text-[12px]' },
  md: { trigger: 'px-2.5 py-1.5', menuItem: 'px-3 py-2 text-[13px]' },
}

export default function PrioritySelector({ value, onChange, size = 'md' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const s = SIZES[size] || SIZES.md

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function select(priority) {
    onChange(priority)
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={value ? `Priority: ${value}. Click to change` : 'No priority set. Click to set priority'}
        className={`inline-flex items-center gap-1.5 rounded-full transition-colors hover:bg-white/[0.06] ${s.trigger}`}
        style={{ fontFamily: 'var(--font-jakarta)' }}
      >
        {value ? (
          <PriorityBadge priority={value} />
        ) : (
          <span className="text-[12px] text-[var(--ink-3)]">No priority</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Set priority"
          className="glass-overlay sheen absolute left-0 top-full mt-1.5 w-40 rounded-[var(--r-sm)] z-50 overflow-hidden py-1"
        >
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              role="menuitem"
              onClick={() => select(p)}
              className={`w-full text-left flex items-center ${s.menuItem} hover:bg-white/[0.06] transition-colors`}
            >
              <PriorityBadge priority={p} />
            </button>
          ))}
          <div className="my-1 border-t border-[var(--glass-border)]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => select(null)}
            className={`w-full text-left ${s.menuItem} text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors`}
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
