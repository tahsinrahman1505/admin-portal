'use client'

/**
 * ContextPanel — glass rail with a header (title + optional close) and a
 * scrollable body, for patient/lead/booking context alongside a list+detail
 * layout. Exports a companion named `ContextSection` for building the body:
 * a small uppercase label + content, optionally collapsible via a −/+
 * toggle. Each ContextSection owns its own open/closed state locally — there
 * is no shared expand/collapse-all controller; a caller wanting synced
 * sections should lift state itself and drive `children` conditionally.
 */

import { useState } from 'react'

export default function ContextPanel({ title, onClose, children }) {
  return (
    <div className="glass sheen rounded-[var(--r-lg)] h-full flex flex-col overflow-hidden" style={{ fontFamily: 'var(--font-jakarta)' }}>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-white/[0.06] shrink-0">
        <h2 className="text-[var(--ink-1)] text-[13.5px] font-semibold truncate">{title}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:bg-white/[0.06] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">{children}</div>
    </div>
  )
}

export function ContextSection({ label, children, collapsible = false }) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <div
        className={`flex items-center justify-between mb-2 ${collapsible ? 'cursor-pointer' : ''}`}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        <p className="text-[10.5px] font-semibold text-[var(--ink-4)] uppercase tracking-[0.12em]">{label}</p>
        {collapsible && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
            aria-expanded={open}
            className="w-4 h-4 rounded flex items-center justify-center text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors text-[12px] leading-none"
          >
            {open ? '−' : '+'}
          </button>
        )}
      </div>
      {open && <div className="text-[var(--ink-2)] text-[13px]">{children}</div>}
    </div>
  )
}
