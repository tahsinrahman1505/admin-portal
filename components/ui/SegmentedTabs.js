'use client'

/**
 * SegmentedTabs — pill-style segmented control with a framer-motion
 * `layoutId` sliding indicator, matching the active-nav-pill pattern in
 * app/(portal)/layout.js (NavItem). `options` is [{ value, label, count }];
 * `count`, when present (including 0), renders as a small trailing badge.
 *
 * The layoutId is namespaced with `useId()` so two SegmentedTabs instances
 * mounted on the same page don't fight over one shared sliding indicator —
 * framer-motion only needs the id to be unique per animating group, not
 * globally, but scoping it here avoids accidental cross-talk.
 */

import { useId } from 'react'
import { motion } from 'framer-motion'

const SIZES = {
  sm: { pad: 'px-2.5 py-1.5', text: 'text-[11.5px]', gap: 'gap-1' },
  md: { pad: 'px-3.5 py-2', text: 'text-[13px]', gap: 'gap-1.5' },
}

export default function SegmentedTabs({ options, value, onChange, size = 'md' }) {
  const uid = useId()
  const s = SIZES[size] || SIZES.md
  const layoutId = `segmented-tabs-${uid}`

  return (
    <div
      role="tablist"
      className={`inline-flex items-center ${s.gap} p-1 rounded-[var(--r-sm)] bg-white/[0.03] border border-white/[0.07]`}
      style={{ fontFamily: 'var(--font-jakarta)' }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`relative flex items-center ${s.gap} ${s.pad} ${s.text} rounded-[calc(var(--r-sm)-2px)] font-medium transition-colors duration-200 ${
              active ? 'text-[var(--ink-1)]' : 'text-[var(--ink-3)] hover:text-[var(--ink-2)]'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-[calc(var(--r-sm)-2px)] bg-white/[0.08] border border-white/[0.08]"
                style={{ boxShadow: 'inset 0 1px 0 0 var(--glass-edge)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
            {opt.count != null && (
              <span
                className={`relative z-10 tnum text-[10.5px] leading-none px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-white/[0.06] text-[var(--ink-3)]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
