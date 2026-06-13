'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { DashboardSkeleton } from '@/components/Skeleton'
import Link from 'next/link'

/* ─── Revenue Pipeline (Feature 3) ─── */
const AVG_BOOKING_AED = 500
const AVG_LEAD_AED    = 350

function FunnelBar({ label, count, maxCount, color }) {
  const pct = maxCount > 0 ? Math.max(6, (count / maxCount) * 100) : 6
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <span className="text-white font-bold text-[1.15rem] tabular-nums">{count.toLocaleString()}</span>
      <div className="w-full h-8 rounded-xl overflow-hidden bg-white/[0.04] relative flex items-center justify-center">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-xl"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
        <span className="relative text-[10px] font-semibold text-white/50 z-10 px-2 truncate">{label}</span>
      </div>
    </div>
  )
}

function RevenuePipeline({ conversations, leadsTotal, hotWarmLeads, confirmedBookings, inView }) {
  const revenue  = confirmedBookings * AVG_BOOKING_AED
  const pipeline = hotWarmLeads * AVG_LEAD_AED
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 mb-5 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00e5b0]/30 to-transparent" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-[13px] font-semibold text-white/60 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 text-[#00e5b0]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Revenue Pipeline
          </p>
          <p className="text-white/25 text-[11.5px] mt-0.5">Est. AED {AVG_BOOKING_AED} avg per booking · AED {AVG_LEAD_AED} per active lead</p>
        </div>
        <Link href="/analytics" className="text-[11.5px] text-[#00e5b0]/60 hover:text-[#00e5b0] transition-colors shrink-0">
          Full analytics →
        </Link>
      </div>
      {/* Revenue cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-[#00e5b0]/[0.06] border border-[#00e5b0]/12 rounded-xl p-4">
          <p className="text-[#00e5b0]/60 text-[11px] mb-1">Confirmed Revenue</p>
          <p className="text-[#00e5b0] font-extrabold text-[1.35rem] leading-none tabular-nums">AED {revenue.toLocaleString()}</p>
          <p className="text-[#00e5b0]/40 text-[10.5px] mt-1">{confirmedBookings} bookings confirmed</p>
        </div>
        <div className="bg-white/[0.025] border border-white/[0.06] rounded-xl p-4">
          <p className="text-white/35 text-[11px] mb-1">Pipeline (projected)</p>
          <p className="text-white/70 font-extrabold text-[1.35rem] leading-none tabular-nums">AED {pipeline.toLocaleString()}</p>
          <p className="text-white/25 text-[10.5px] mt-1">{hotWarmLeads} active leads</p>
        </div>
        <div className="bg-white/[0.025] border border-white/[0.06] rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-white/35 text-[11px] mb-1">Total Potential</p>
          <p className="text-white/50 font-extrabold text-[1.35rem] leading-none tabular-nums">AED {(revenue + pipeline).toLocaleString()}</p>
          <p className="text-white/25 text-[10.5px] mt-1">{leadsTotal > 0 ? Math.round((confirmedBookings / leadsTotal) * 100) : 0}% lead → booking</p>
        </div>
      </div>
      {/* Funnel */}
      <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Conversion Funnel</p>
      <div className="flex items-center gap-2">
        <FunnelBar label="Conversations" count={conversations} maxCount={conversations} color="rgba(0,229,176,0.2)" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-white/15 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        <FunnelBar label="Leads" count={leadsTotal} maxCount={conversations} color="rgba(96,165,250,0.3)" />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-white/15 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        <FunnelBar label="Bookings" count={confirmedBookings} maxCount={conversations} color="rgba(0,229,176,0.55)" />
      </div>
    </motion.div>
  )
}

// B — Count-up hook
function useCountUp(target, inView, duration = 1200) {
  const [val, setVal] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (!inView || target === 'N/A') return
    const num = parseFloat(target)
    if (isNaN(num)) return
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(num % 1 === 0 ? Math.floor(ease * num) : (ease * num).toFixed(1))
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, inView, duration])
  return target === 'N/A' ? 'N/A' : val
}

// D — Animated bar
function AnimatedBar({ val, color, inView }) {
  return (
    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${val}%` } : { width: 0 }}
        transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  )
}

// J — Onboarding checklist
const CHECKLIST_KEY = 'tahsin_onboarding_dismissed'
function OnboardingChecklist({ metrics, hasKnowledge }) {
  const [dismissed, setDismissed] = useState(true)
  useEffect(() => {
    setDismissed(!!localStorage.getItem(CHECKLIST_KEY))
  }, [])
  if (dismissed) return null

  const steps = [
    { label: 'Sign in to your portal', done: true },
    { label: 'Upload knowledge base document', done: hasKnowledge, href: '/knowledge-base' },
    { label: 'Set your bot greeting', done: false, href: '/settings' },
    { label: 'First conversation received', done: (metrics?.totalConversations ?? 0) > 0, href: '/conversations' },
    { label: 'First lead captured', done: (metrics?.leadsCount ?? 0) > 0, href: '/leads' },
  ]
  const doneCount = steps.filter(s => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mb-6 bg-white/[0.025] border border-[#00e5b0]/15 rounded-2xl p-5 relative overflow-hidden"
    >
      {/* Glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00e5b0]/30 to-transparent" />

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[13.5px] font-semibold text-white">Getting started</p>
          <p className="text-[12px] text-white/35 mt-0.5">{doneCount} of {steps.length} steps complete</p>
        </div>
        <button
          onClick={() => { localStorage.setItem(CHECKLIST_KEY, '1'); setDismissed(true) }}
          className="text-white/20 hover:text-white/50 transition-colors p-1"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/[0.06] rounded-full mb-4 overflow-hidden">
        <motion.div
          className="h-full bg-[#00e5b0] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
          >
            {step.href && !step.done ? (
              <Link href={step.href} className="flex items-center gap-2.5 group">
                <CheckIcon done={step.done} />
                <span className="text-[12.5px] text-white/50 group-hover:text-white/80 transition-colors">{step.label}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-white/20 group-hover:text-[#00e5b0] ml-auto transition-colors">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/>
                </svg>
              </Link>
            ) : (
              <div className="flex items-center gap-2.5">
                <CheckIcon done={step.done} />
                <span className={`text-[12.5px] ${step.done ? 'text-white/60 line-through' : 'text-white/40'}`}>{step.label}</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function CheckIcon({ done }) {
  return done ? (
    <div className="w-4 h-4 rounded-full bg-[#00e5b0] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-2.5 h-2.5 text-[#080808]">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
      </svg>
    </div>
  ) : (
    <div className="w-4 h-4 rounded-full border border-white/[0.15] shrink-0" />
  )
}

// Metric card with count-up
function MetricCard({ card, index, inView }) {
  const count = useCountUp(card.rawValue, inView)
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: 0.05 + index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6 hover:-translate-y-1 hover:border-white/[0.12] hover:shadow-[0_8px_32px_rgba(0,229,176,0.06)] transition-all duration-250 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00e5b0]/25 to-transparent" />
      <div className="text-[#00e5b0]/70 mb-4">{card.icon}</div>
      <div className="text-[2.4rem] font-extrabold text-white leading-none mb-1.5 tabular-nums">
        {card.rawValue === 'N/A' ? 'N/A' : count}
      </div>
      <div className="text-white/35 text-[12.5px] mb-3">{card.label}</div>
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#00e5b0] bg-[#00e5b0]/10 rounded-full px-2.5 py-1">
        ↑ {card.change} this week
      </span>
    </motion.div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [metrics, setMetrics]           = useState(null)
  const [pipeline, setPipeline]         = useState({ hotWarm: 0 })
  const [lastUpdated, setLastUpdated]   = useState(null)
  const [loading, setLoading]           = useState(true)
  const [clientName, setClientName]     = useState('')
  const [botStatus, setBotStatus]       = useState(null)
  const [hasKnowledge, setHasKnowledge] = useState(false)
  const [inView, setInView]             = useState(false)
  const containerRef = useRef(null)

  // Trigger count-up when content is visible
  useEffect(() => {
    if (!loading) setTimeout(() => setInView(true), 80)
  }, [loading])

  useEffect(() => {
    fetch('/api/rag/health')
      .then(r => r.json()).then(d => setBotStatus(d.status))
      .catch(() => setBotStatus('unreachable'))
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: clientRow } = await supabase.from('clients').select('id, client_name').eq('user_id', user.id).single()
      if (!clientRow) return

      setClientName(clientRow.client_name || 'Client')
      const clientId = clientRow.id

      const [
        { count: totalConversations },
        { count: leadsCount },
        { count: appointmentsCount },
        { data: reviewsData },
        { count: kbCount },
        { data: leadsData },
      ] = await Promise.all([
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('pending_bookings').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'confirmed'),
        supabase.from('reviews').select('rating').eq('client_id', clientId),
        supabase.from('knowledge_documents').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('leads').select('status').eq('client_id', clientId),
      ])

      const avgRating = reviewsData?.length > 0
        ? (reviewsData.reduce((s, r) => s + r.rating, 0) / reviewsData.length).toFixed(1)
        : 'N/A'

      // Count hot/warm leads for pipeline (New = hot intent, Called = warm)
      const hotWarm = (leadsData ?? []).filter(l => l.status === 'New' || l.status === 'Called').length

      setMetrics({ totalConversations: totalConversations ?? 0, leadsCount: leadsCount ?? 0, appointmentsCount: appointmentsCount ?? 0, avgRating })
      setPipeline({ hotWarm })
      setHasKnowledge((kbCount ?? 0) > 0)
      setLastUpdated(new Date().toLocaleTimeString())
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return <DashboardSkeleton />

  const statusConfig = {
    ok:          { label: 'Bot Online',  cls: 'bg-[#00e5b0]/10 text-[#00e5b0] border-[#00e5b0]/20',  dot: 'bg-[#00e5b0]' },
    degraded:    { label: 'Degraded',    cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',  dot: 'bg-amber-400' },
    unreachable: { label: 'Bot Offline', cls: 'bg-red-500/10 text-red-400 border-red-500/20',        dot: 'bg-red-400' },
  }
  const status = statusConfig[botStatus] || { label: 'Checking…', cls: 'bg-white/5 text-white/30 border-white/10', dot: 'bg-white/20' }

  const iconCls = 'w-5 h-5'
  const cards = [
    {
      label: 'Total Conversations', rawValue: metrics.totalConversations, change: '+12%',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={iconCls}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/></svg>
    },
    {
      label: 'Leads Captured', rawValue: metrics.leadsCount, change: '+8%',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={iconCls}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>
    },
    {
      label: 'Appointments Booked', rawValue: metrics.appointmentsCount, change: '+5%',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={iconCls}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>
    },
    {
      label: 'Avg Rating', rawValue: metrics.avgRating, change: '+0.2',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={iconCls}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
    },
  ]

  const scores = [
    { label: 'Response Rate',         val: 94, color: '#00e5b0' },
    { label: 'Lead Conversion',       val: 68, color: '#60a5fa' },
    { label: 'Booking Rate',          val: 75, color: '#fbbf24' },
    { label: 'Customer Satisfaction', val: 90, color: '#f472b6' },
  ]

  const activity = [
    { text: 'New conversation started',     time: '2m ago',  color: 'bg-[#00e5b0]' },
    { text: 'Lead captured — Ahmed Rahman', time: '14m ago', color: 'bg-blue-400' },
    { text: 'Appointment confirmed',         time: '1h ago',  color: 'bg-amber-400' },
    { text: 'New 5★ review received',       time: '3h ago',  color: 'bg-pink-400' },
  ]

  return (
    <div className="p-8 max-w-[1100px]" ref={containerRef}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="mb-7"
      >
        <p className="text-white/30 text-[13px] mb-1">Good morning 👋</p>
        <h1 className="text-[1.75rem] font-extrabold text-white tracking-tight">
          <span className="text-[#00e5b0]">{clientName}</span> Dashboard
        </h1>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00e5b0] opacity-40" />
              <span className="relative inline-flex rounded-full w-2 h-2 bg-[#00e5b0]" />
            </span>
            <span className="text-white/30 text-[12px]">Live · Last updated {lastUpdated}</span>
          </div>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium border ${status.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </div>
        </div>
      </motion.div>

      {/* J — Onboarding */}
      <OnboardingChecklist metrics={metrics} hasKnowledge={hasKnowledge} />

      {/* B — Metric cards with count-up */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        {cards.map((card, i) => (
          <MetricCard key={card.label} card={card} index={i} inView={inView} />
        ))}
      </div>

      {/* 3 — Revenue Pipeline */}
      <RevenuePipeline
        conversations={metrics.totalConversations}
        leadsTotal={metrics.leadsCount}
        hotWarmLeads={pipeline.hotWarm}
        confirmedBookings={metrics.appointmentsCount}
        inView={inView}
      />

      {/* Bottom panels */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
        >
          <p className="text-[13px] font-semibold text-white/60 mb-5 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 text-[#00e5b0]"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
            Recent Activity
          </p>
          <div className="space-y-0">
            {activity.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.07 }}
                className="flex items-center gap-3 py-3 border-b border-white/[0.04] last:border-0"
              >
                <div className={`w-2 h-2 rounded-full shrink-0 ${item.color}`} />
                <span className="text-[13px] text-white/50 flex-1">{item.text}</span>
                <span className="text-[11px] text-white/20">{item.time}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* D — Animated performance bars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6"
        >
          <p className="text-[13px] font-semibold text-white/60 mb-5 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 text-[#00e5b0]"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>
            Performance Score
          </p>
          <div className="space-y-4">
            {scores.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ duration: 0.3, delay: 0.55 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <span className="text-[12.5px] text-white/40 w-44 shrink-0">{s.label}</span>
                <AnimatedBar val={s.val} color={s.color} inView={inView} />
                <span className="text-[12.5px] text-white/50 w-9 text-right tabular-nums shrink-0">{s.val}%</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <p className="text-white/15 text-[11.5px] mt-6 flex items-center gap-1.5">
        <span className="text-[#00e5b0]/40">◎</span> Dashboard refreshes automatically on each login
      </p>
    </div>
  )
}
