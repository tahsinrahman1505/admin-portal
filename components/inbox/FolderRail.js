'use client'

/**
 * FolderRail — vertical folder tree for the 3-pane inbox, replacing the old
 * horizontal channel tabs (see ChannelTabs in the reference conversations
 * page). Rows: "All Channels" then one row per CHANNELS entry from
 * lib/inbox.js, each showing a channel-colored dot and its count from
 * `counts` (shape: { all, whatsapp, instagram, messenger }, any key may be
 * absent — missing counts render as 0).
 *
 * Keyboard-navigable: every row is a real <button>; ArrowUp/ArrowDown move
 * focus between rows (wrapping at the ends) so the whole rail is operable
 * without a mouse, matching the "each row a real <button>, arrow keys move
 * between them" requirement.
 */

import { useRef } from 'react'
import { CHANNELS, CHANNEL_LABEL } from '@/lib/inbox'

const CH_DOT = {
  whatsapp: 'var(--ch-whatsapp)',
  instagram: 'var(--ch-instagram)',
  messenger: 'var(--ch-messenger)',
}

const ROWS = [
  { value: 'all', label: 'All Channels' },
  ...CHANNELS.map((ch) => ({ value: ch, label: CHANNEL_LABEL[ch] })),
]

export default function FolderRail({ channel, onChannelChange, counts = {} }) {
  const btnRefs = useRef([])

  const focusRow = (idx) => {
    const el = btnRefs.current[idx]
    el?.focus()
  }

  const handleKeyDown = (e, idx) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const dir = e.key === 'ArrowDown' ? 1 : -1
    const next = (idx + dir + ROWS.length) % ROWS.length
    focusRow(next)
  }

  return (
    <nav
      aria-label="Channel folders"
      className="shrink-0 h-full flex flex-col gap-0.5 py-3 px-2 border-r border-white/[0.06]"
      style={{ width: 'var(--pane-folders)', fontFamily: 'var(--font-jakarta)' }}
    >
      {ROWS.map((row, idx) => {
        const active = (channel || 'all') === row.value
        const dot = CH_DOT[row.value]
        const count = counts[row.value] ?? 0

        return (
          <button
            key={row.value}
            ref={(el) => {
              btnRefs.current[idx] = el
            }}
            type="button"
            onClick={() => onChannelChange?.(row.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            aria-current={active ? 'true' : undefined}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-[var(--r-sm)] text-[12.5px] font-medium text-left transition-colors duration-200 ${
              active
                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-white/[0.04]'
            }`}
          >
            {dot ? (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} aria-hidden="true" />
            ) : (
              <span
                className="w-2 h-2 rounded-full shrink-0 border border-current opacity-50"
                aria-hidden="true"
              />
            )}
            <span className="flex-1 truncate">{row.label}</span>
            <span
              className={`tnum text-[10.5px] leading-none px-1.5 py-0.5 rounded-full shrink-0 ${
                active ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-white/[0.06] text-[var(--ink-3)]'
              }`}
            >
              {count}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
