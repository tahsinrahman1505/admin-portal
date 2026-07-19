'use client'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

/* ─── event type config ─── */
const TYPES = {
  conversation: {
    label: 'Conversation',
    color: 'text-[#00e5b0]',
    ring:  'bg-[#00e5b0]/10 border-[#00e5b0]/20',
    dot:   'bg-[#00e5b0]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/>
      </svg>
    ),
  },
  lead: {
    label: 'Lead',
    color: 'text-blue-400',
    ring:  'bg-blue-400/10 border-blue-400/20',
    dot:   'bg-blue-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
      </svg>
    ),
  },
  booking: {
    label: 'Booking',
    color: 'text-amber-400',
    ring:  'bg-amber-400/10 border-amber-400/20',
    dot:   'bg-amber-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/>
      </svg>
    ),
  },
  bot: {
    label: 'Bot',
    color: 'text-purple-400',
    ring:  'bg-purple-400/10 border-purple-400/20',
    dot:   'bg-purple-400',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/>
      </svg>
    ),
  },
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })
}

function formatFull(iso) {
  return new Date(iso).toLocaleString('en-AE', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* group consecutive events of the same minute into a date separator */
function groupByDate(events) {
  const groups = []
  let lastDate = null
  events.forEach(ev => {
    const d = new Date(ev.ts).toLocaleDateString('en-AE', { weekday: 'long', month: 'long', day: 'numeric' })
    if (d !== lastDate) { groups.push({ type: 'separator', label: d }); lastDate = d }
    groups.push(ev)
  })
  return groups
}

/* ─── Event row ─── */
function EventRow({ ev, index }) {
  const t = TYPES[ev.type]
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay: index * 0.025 }}
      className="flex items-start gap-4 py-3.5 border-b border-white/[0.04] last:border-0 group"
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${t.ring} ${t.color}`}>
        {t.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-[13px] leading-snug">{ev.title}</p>
        {ev.sub && <p className="text-white/30 text-[11.5px] mt-0.5 truncate">{ev.sub}</p>}
      </div>

      {/* Type badge + time */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${t.color}`}>{t.label}</span>
        <span className="text-white/20 text-[11px]" title={formatFull(ev.ts)}>{timeAgo(ev.ts)}</span>
      </div>
    </motion.div>
  )
}

const FILTERS = ['all', 'conversation', 'lead', 'booking', 'bot']
const PAGE_SIZE = 40

export default function ActivityPage() {
  const [events, setEvents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
  const [page, setPage]         = useState(1)
  const [search, setSearch]     = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)

      // Pull last 30 days of data
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const iso = since.toISOString()

      const [
        { data: convs },
        { data: leads },
        { data: bookings },
      ] = await Promise.all([
        supabase.from('conversations')
          .select('id, session_id, phone_number, role, message, created_at, session_status')
          .gte('created_at', iso)
          .eq('role', 'customer')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('leads')
          .select('id, name, phone, service_interest, status, created_at')
          .gte('created_at', iso)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('pending_bookings')
          .select('id, status, created_at')
          .gte('created_at', iso)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      const raw = []

      // Deduplicate conversations by session_id (show first message per session)
      const seenSessions = new Set()
      ;(convs ?? []).forEach(c => {
        if (seenSessions.has(c.session_id)) return
        seenSessions.add(c.session_id)
        raw.push({
          id:    `conv-${c.id}`,
          type:  'conversation',
          ts:    c.created_at,
          title: `New conversation started`,
          sub:   `${c.phone_number || 'Unknown'} · "${(c.message || '').slice(0, 60)}${(c.message || '').length > 60 ? '…' : ''}"`,
        })
      })

      // Bot activity — handled sessions
      ;(convs ?? []).filter(c => c.session_status === 'Handled by Bot').slice(0, 30).forEach(c => {
        raw.push({
          id:    `bot-${c.id}`,
          type:  'bot',
          ts:    c.created_at,
          title: 'Tahsin.ai responded to a patient',
          sub:   c.phone_number || 'Unknown number',
        })
      })

      // Leads
      ;(leads ?? []).forEach(l => {
        raw.push({
          id:    `lead-${l.id}`,
          type:  'lead',
          ts:    l.created_at,
          title: `Lead captured${l.name ? ` — ${l.name}` : ''}`,
          sub:   [l.phone, l.service_interest, `Status: ${l.status || 'New'}`].filter(Boolean).join(' · '),
        })
      })

      // Bookings
      ;(bookings ?? []).forEach(b => {
        raw.push({
          id:    `booking-${b.id}`,
          type:  'booking',
          ts:    b.created_at,
          title: `Booking ${b.status || 'created'}`,
          sub:   `Booking #${b.id} · ${new Date(b.created_at).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}`,
        })
      })

      // Sort newest first
      raw.sort((a, b) => new Date(b.ts) - new Date(a.ts))
      setEvents(raw)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = events.filter(ev => {
    const matchFilter = filter === 'all' || ev.type === filter
    const matchSearch = !search || ev.title.toLowerCase().includes(search.toLowerCase()) || (ev.sub || '').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore   = paginated.length < filtered.length
  const grouped   = groupByDate(paginated)

  // Stats strip
  const stats = {
    conversations: events.filter(e => e.type === 'conversation').length,
    leads:         events.filter(e => e.type === 'lead').length,
    bookings:      events.filter(e => e.type === 'booking').length,
    bot:           events.filter(e => e.type === 'bot').length,
  }

  return (
    <div className="p-7 max-w-[860px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-7"
      >
        <h1 className="text-white font-extrabold text-[1.35rem] tracking-tight">Activity Log</h1>
        <p className="text-white/30 text-[12.5px] mt-0.5">Everything that happened in the last 30 days</p>
      </motion.div>

      {/* Stats strip */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          {[
            { label: 'Conversations', count: stats.conversations, type: 'conversation' },
            { label: 'Leads',         count: stats.leads,         type: 'lead' },
            { label: 'Bookings',      count: stats.bookings,      type: 'booking' },
            { label: 'Bot Actions',   count: stats.bot,           type: 'bot' },
          ].map(s => {
            const t = TYPES[s.type]
            return (
              <button
                key={s.type}
                onClick={() => setFilter(filter === s.type ? 'all' : s.type)}
                className={`text-left p-4 rounded-2xl border transition-all duration-150 ${
                  filter === s.type
                    ? `${t.ring} ${t.color}`
                    : 'bg-white/[0.025] border-white/[0.06] text-white/40 hover:border-white/[0.1]'
                }`}
              >
                <p className="text-[1.4rem] font-extrabold tabular-nums leading-none mb-1">{s.count}</p>
                <p className="text-[11px]">{s.label}</p>
              </button>
            )
          })}
        </motion.div>
      )}

      {/* Search + filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="flex flex-wrap items-center gap-3 mb-5"
      >
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search activity…"
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2 text-[12.5px] text-white/70 placeholder-white/20 outline-none focus:border-[#00e5b0]/30 transition-colors"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all duration-150 capitalize ${
                filter === f
                  ? 'bg-[#00e5b0]/[0.15] text-[#00e5b0] border border-[#00e5b0]/20'
                  : 'bg-white/[0.04] text-white/30 border border-white/[0.06] hover:text-white/50'
              }`}
            >
              {f === 'all' ? `All (${events.length})` : f}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Feed */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="bg-white/[0.02] border border-white/[0.07] rounded-2xl px-6 py-2"
      >
        {loading ? (
          <div className="space-y-4 py-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-1">
                <div className="w-8 h-8 rounded-xl bg-white/[0.05] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-white/[0.05] rounded-full animate-pulse w-2/3" />
                  <div className="h-2.5 bg-white/[0.03] rounded-full animate-pulse w-1/2" />
                </div>
                <div className="h-3 w-12 bg-white/[0.04] rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-white/20 text-[13px] py-16">
            No activity found
          </div>
        ) : (
          <>
            <AnimatePresence mode="popLayout">
              {grouped.map((item, i) =>
                item.type === 'separator' ? (
                  <motion.div
                    key={`sep-${item.label}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 py-3 sticky top-0 bg-[var(--surface-overlay)]/80 backdrop-blur-sm z-10"
                  >
                    <div className="h-px flex-1 bg-white/[0.05]" />
                    <span className="text-[10.5px] text-white/20 font-semibold uppercase tracking-widest shrink-0">{item.label}</span>
                    <div className="h-px flex-1 bg-white/[0.05]" />
                  </motion.div>
                ) : (
                  <EventRow key={item.id} ev={item} index={i} />
                )
              )}
            </AnimatePresence>

            {hasMore && (
              <div className="py-4 text-center">
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="text-[12.5px] text-white/30 hover:text-[#00e5b0] transition-colors border border-white/[0.07] hover:border-[#00e5b0]/25 px-5 py-2 rounded-xl"
                >
                  Load more · {filtered.length - paginated.length} remaining
                </button>
              </div>
            )}
          </>
        )}
      </motion.div>

      <p className="text-white/15 text-[11px] mt-4 text-center">
        Showing last 30 days · {events.length} total events synthesized
      </p>
    </div>
  )
}
