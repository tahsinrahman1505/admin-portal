'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { resolveBotClientId } from '@/lib/clientId'

/* Per-action-type visual identity — icon, accent, and the verb on the CTA. */
const TYPES = {
  handoff:      { label: 'Waiting',  color: '#ff6b6b', cta: 'Reply now',
    icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z' },
  lead:         { color: '#60a5fa', label: 'Lead', cta: 'Open lead',
    icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0A17.9 17.9 0 0112 21.75c-2.7 0-5.2-.6-7.5-1.65z' },
  no_show_risk: { color: '#fbbf24', label: 'Risk', cta: 'View booking',
    icon: 'M12 9v3.75m-9.3 3.4c-.77 1.33.19 3 1.73 3h15.14c1.54 0 2.5-1.67 1.73-3L13.73 4.1c-.77-1.34-2.7-1.34-3.46 0L2.7 16.15zM12 15.75h.01' },
  kb_gap:       { color: '#c084fc', label: 'Teach', cta: 'Teach the bot',
    icon: 'M12 6.04A5.5 5.5 0 003.5 12v6.5A2.5 2.5 0 006 21a4 4 0 006-3.5A4 4 0 0018 21a2.5 2.5 0 002.5-2.5V12A5.5 5.5 0 0012 6.04z' },
  recall:       { color: '#00e5b0', label: 'Recall', cta: 'Open recall',
    icon: 'M16.023 9.348h4.992V4.356M2.985 19.644V14.65h4.992m-4.354-3.006a8.25 8.25 0 0113.803-3.7L21 8.35m-18 7.3l3.574 2.4a8.25 8.25 0 0013.803-3.7' },
}

function StatChip({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2">
      <span className="text-[1.05rem] font-bold tabular-nums" style={{ color: accent }}>{value}</span>
      <span className="text-[11px] text-white/45 leading-tight">{label}</span>
    </div>
  )
}

function ActionCard({ action, index, onDismiss }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const t = TYPES[action.type] || TYPES.lead
  const draft = action.draft

  const copy = async () => {
    try { await navigator.clipboard.writeText(draft); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 sm:p-5 relative overflow-hidden"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: t.color, opacity: 0.7 }} />
      <div className="flex items-start gap-3.5 pl-1.5">
        <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5"
             style={{ background: `${t.color}1a`, border: `1px solid ${t.color}33` }}>
          <svg viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth={1.7} className="w-[19px] h-[19px]">
            <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ color: t.color, background: `${t.color}14` }}>{t.label}</span>
            <h3 className="text-white font-semibold text-[14px] leading-snug">{action.title}</h3>
          </div>
          {action.context && <p className="text-white/45 text-[12px] mt-1">{action.context}</p>}

          <div className="flex items-center gap-2.5 mt-3 flex-wrap">
            <Link href={action.link}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ color: t.color, background: `${t.color}14` }}>
              {t.cta} →
            </Link>
            {draft && (
              <button onClick={() => setOpen(o => !o)}
                      className="text-[12px] text-white/50 hover:text-white/80 transition-colors px-2 py-1.5">
                {open ? 'Hide draft' : 'View draft'}
              </button>
            )}
            {action.draftable && !draft && (
              <span className="text-[11px] text-white/30">Reply drafts on open</span>
            )}
            <button onClick={() => onDismiss(action)}
                    className="text-[12px] text-white/30 hover:text-white/60 transition-colors px-2 py-1.5 ml-auto">
              Dismiss
            </button>
          </div>

          <AnimatePresence>
            {open && draft && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                className="overflow-hidden">
                <div className="mt-3 bg-black/25 border border-white/[0.06] rounded-xl p-3.5">
                  <p className="text-white/75 text-[13px] leading-relaxed whitespace-pre-wrap">{draft}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={copy}
                            className="text-[11.5px] font-medium text-[#00e5b0] bg-[#00e5b0]/[0.1] hover:bg-[#00e5b0]/20 transition-colors px-2.5 py-1.5 rounded-lg">
                      {copied ? '✓ Copied' : 'Copy draft'}
                    </button>
                    <span className="text-[10.5px] text-white/25">Review before sending — the copilot drafts, you decide.</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

export default function CopilotPage() {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [dismissed, setDismissed] = useState(() => new Set())

  const load = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const clientId = await resolveBotClientId()
      const res = await fetch(`/api/rag/copilot/briefing?client_id=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!data || data.ok === false) throw new Error(data?.error || 'Could not load your briefing.')
      setState({ loading: false, error: null, data })
    } catch (e) {
      setState({ loading: false, error: e.message || 'Something went wrong.', data: null })
    }
  }, [])

  useEffect(() => { load() }, [load])

  const data = state.data
  const actions = (data?.actions || []).filter(a => !dismissed.has(`${a.type}:${a.ref}`))
  const s = data?.summary || {}
  const onDismiss = (a) => setDismissed(prev => new Set(prev).add(`${a.type}:${a.ref}`))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="#00e5b0" strokeWidth={1.7} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <h1 className="text-white font-bold text-[1.35rem] tracking-tight">Morning Huddle</h1>
          </div>
          <p className="text-white/40 text-[13px] mt-1">
            {data?.clinic_name ? `${data.clinic_name} · ` : ''}Your copilot's read on what needs you today
          </p>
        </div>
        <button onClick={load} disabled={state.loading}
                className="shrink-0 text-[12px] text-white/50 hover:text-white/80 disabled:opacity-40 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className={`w-3.5 h-3.5 ${state.loading ? 'animate-spin' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644V14.65h4.992m-4.354-3.006a8.25 8.25 0 0113.803-3.7L21 8.35m-18 7.3l3.574 2.4a8.25 8.25 0 0013.803-3.7" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Loading */}
      {state.loading && (
        <div className="space-y-3">
          <div className="h-28 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          <div className="h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          <div className="h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        </div>
      )}

      {/* Error */}
      {!state.loading && state.error && (
        <div className="bg-red-400/[0.06] border border-red-400/20 rounded-2xl p-5 text-center">
          <p className="text-red-300/80 text-[13px]">{state.error}</p>
          <button onClick={load} className="mt-2 text-[12px] text-white/60 hover:text-white underline">Try again</button>
        </div>
      )}

      {/* Briefing */}
      {!state.loading && !state.error && data && (
        <>
          {/* Headline card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-gradient-to-br from-[#00e5b0]/[0.08] to-white/[0.02] border border-[#00e5b0]/20 rounded-2xl p-5 sm:p-6 mb-5 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00e5b0]/40 to-transparent" />
            <p className="text-white/90 text-[15px] sm:text-[16px] leading-relaxed">{data.headline}</p>
          </motion.div>

          {/* Summary chips */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
            className="flex flex-wrap gap-2 mb-6">
            <StatChip label="waiting for a human" value={s.unanswered_handoffs} accent="#ff6b6b" />
            <StatChip label="leads to call" value={s.leads_to_call} accent="#60a5fa" />
            <StatChip label="no-show risks" value={s.no_show_risks} accent="#fbbf24" />
            <StatChip label="recalls due" value={s.recalls_due} accent="#00e5b0" />
            <StatChip label="to teach the bot" value={s.kb_gaps} accent="#c084fc" />
            <StatChip label="chats yesterday" value={s.conversations_yesterday} accent="#ffffff99" />
            <StatChip label="booked yesterday" value={s.bookings_yesterday} accent="#00e5b0" />
          </motion.div>

          {/* Action queue */}
          {actions.length > 0 ? (
            <>
              <p className="text-[11px] text-white/30 uppercase tracking-widest mb-3">Needs you · {actions.length}</p>
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {actions.map((a, i) => (
                    <ActionCard key={`${a.type}:${a.ref}`} action={a} index={i} onDismiss={onDismiss} />
                  ))}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              className="text-center py-14 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-white/70 text-[15px] font-medium">You're all caught up</p>
              <p className="text-white/35 text-[13px] mt-1">Nothing needs your attention right now.</p>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
