'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * ⌘K command palette — the portal's signature navigation surface.
 *
 * Opens on ⌘K / Ctrl+K (or "/"), fuzzy-filters destinations + quick actions,
 * full keyboard control (↑ ↓ ↵ Esc). Frosted glass over a dimmed aurora, spring
 * entrance. Mounted once in the portal layout so it's reachable from every page.
 */
const COMMANDS = [
  { group: 'Go to', label: 'Dashboard',       href: '/dashboard',      kws: 'home overview' },
  { group: 'Go to', label: 'Conversations',   href: '/conversations',  kws: 'chats messages inbox' },
  { group: 'Go to', label: 'Leads',           href: '/leads',          kws: 'pipeline crm prospects' },
  { group: 'Go to', label: 'Bookings',        href: '/bookings',       kws: 'appointments calendar' },
  { group: 'Go to', label: 'Patients',        href: '/patients',       kws: 'people roster' },
  { group: 'Go to', label: 'Analytics',       href: '/analytics',      kws: 'stats charts reports' },
  { group: 'Go to', label: 'Activity',        href: '/activity',       kws: 'log timeline events' },
  { group: 'Go to', label: 'Knowledge Base',  href: '/knowledge-base', kws: 'kb faq bot training' },
  { group: 'Go to', label: 'Channels',        href: '/channels',       kws: 'whatsapp instagram messenger' },
  { group: 'Go to', label: 'Team',            href: '/team',           kws: 'doctors staff' },
  { group: 'Go to', label: 'Settings',        href: '/settings',       kws: 'config preferences greeting' },
]

const ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
)

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  // Global hotkeys: ⌘K / Ctrl+K to open, Esc to close.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return COMMANDS
    return COMMANDS.filter(c => (c.label + ' ' + c.kws).toLowerCase().includes(s))
  }, [q])

  useEffect(() => { setActive(0) }, [q])

  const run = (cmd) => { if (!cmd) return; setOpen(false); router.push(cmd.href) }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[active]) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={() => setOpen(false)}
        >
          {/* dimmed aurora backdrop */}
          <div className="absolute inset-0" style={{ background: 'rgba(4,6,9,0.5)', backdropFilter: 'blur(6px)' }} />

          <motion.div
            className="glass-strong sheen relative w-full max-w-[560px] rounded-[var(--r-lg)] overflow-hidden"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 26 } }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* search row */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 text-[var(--ink-3)] shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search pages and actions…"
                className="flex-1 bg-transparent outline-none text-[14.5px] text-[var(--ink-1)] placeholder-[var(--ink-3)]"
              />
              <kbd className="text-[10px] text-[var(--ink-3)] border border-white/[0.12] rounded px-1.5 py-0.5">ESC</kbd>
            </div>

            {/* results */}
            <div className="max-h-[46vh] overflow-y-auto py-2">
              {results.length === 0 && (
                <p className="text-[13px] text-[var(--ink-3)] text-center py-8">No matches for “{q}”.</p>
              )}
              {results.map((cmd, i) => (
                <button
                  key={cmd.href}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => run(cmd)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={active === i ? { background: 'var(--accent-soft)' } : undefined}
                >
                  <span className={active === i ? 'text-[#00e5b0]' : 'text-[var(--ink-3)]'}>{ICON}</span>
                  <span className={`text-[13.5px] ${active === i ? 'text-[var(--ink-1)]' : 'text-[var(--ink-2)]'}`}>{cmd.label}</span>
                  <span className="ml-auto text-[10.5px] uppercase tracking-wider text-[var(--ink-4)]">{cmd.group}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
