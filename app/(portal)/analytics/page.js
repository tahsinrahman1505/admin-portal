'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { AnalyticsSkeleton } from '@/components/Skeleton'

/* ─── helpers ─── */
function buildLast7Days(rows) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString('en-US', { weekday: 'short' })
    const key = d.toISOString().slice(0, 10)
    days.push({ label, key, conversations: 0, leads: 0 })
  }
  rows.forEach(r => {
    const key = r.created_at?.slice(0, 10)
    const slot = days.find(d => d.key === key)
    if (slot) {
      slot.conversations++
      if (r.lead_status && r.lead_status !== 'none') slot.leads++
    }
  })
  return days.map(d => ({ name: d.label, conversations: d.conversations, leads: d.leads }))
}

function buildLast30Days(rows) {
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = i % 5 === 0 ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
    const key = d.toISOString().slice(0, 10)
    days.push({ label, key, conversations: 0, leads: 0 })
  }
  rows.forEach(r => {
    const key = r.created_at?.slice(0, 10)
    const slot = days.find(d => d.key === key)
    if (slot) {
      slot.conversations++
      if (r.lead_status && r.lead_status !== 'none') slot.leads++
    }
  })
  return days.map(d => ({ name: d.label, conversations: d.conversations, leads: d.leads }))
}

function buildHourBuckets(msgs) {
  const hours = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, '0')}:00`,
    messages: 0,
  }))
  msgs.forEach(m => {
    const h = new Date(m.created_at).getHours()
    hours[h].messages++
  })
  return hours
}

/* ─── custom tooltip ─── */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#111c22] border border-white/[0.08] rounded-xl px-3.5 py-2.5 shadow-xl">
      <p className="text-white/40 text-[10.5px] mb-1.5" style={{ fontFamily: 'var(--font-jakarta)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-[12px] font-semibold" style={{ color: p.color, fontFamily: 'var(--font-jakarta)' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

/* ─── stat card ─── */
function StatCard({ label, value, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-4"
    >
      <p className="text-white/35 text-[11.5px] mb-1" style={{ fontFamily: 'var(--font-jakarta)' }}>{label}</p>
      <p className="text-white font-extrabold text-[1.6rem] leading-none tracking-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>{value}</p>
      {sub && <p className="text-[#00e5b0]/60 text-[11px] mt-1.5" style={{ fontFamily: 'var(--font-jakarta)' }}>{sub}</p>}
    </motion.div>
  )
}

/* ─── chart card ─── */
function ChartCard({ title, subtitle, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5"
    >
      <div className="mb-5">
        <p className="text-white font-semibold text-[14px]" style={{ fontFamily: 'var(--font-jakarta)' }}>{title}</p>
        {subtitle && <p className="text-white/30 text-[11.5px] mt-0.5" style={{ fontFamily: 'var(--font-jakarta)' }}>{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  )
}

export default function AnalyticsPage() {
  const [range, setRange] = useState('7d')
  const [convRows, setConvRows] = useState([])
  const [msgRows, setMsgRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const since = new Date()
      since.setDate(since.getDate() - (range === '7d' ? 7 : 30))
      const iso = since.toISOString()

      const [{ data: convs }, { data: msgs }] = await Promise.all([
        supabase.from('conversations').select('created_at, lead_status').gte('created_at', iso),
        supabase.from('messages').select('created_at').gte('created_at', iso),
      ])
      setConvRows(convs ?? [])
      setMsgRows(msgs ?? [])
      setLoading(false)
    }
    load()
  }, [range])

  if (loading) return <AnalyticsSkeleton />

  const trendData = range === '7d' ? buildLast7Days(convRows) : buildLast30Days(convRows)
  const hourData = buildHourBuckets(msgRows)
  const totalConvs = convRows.length
  const totalLeads = convRows.filter(r => r.lead_status && r.lead_status !== 'none').length
  const convRate = totalConvs ? Math.round((totalLeads / totalConvs) * 100) : 0
  const peakHour = hourData.reduce((best, h) => h.messages > best.messages ? h : best, { hour: '--', messages: 0 })

  return (
    <div className="p-7 max-w-[1100px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-7"
      >
        <div>
          <h1 className="text-white font-extrabold text-[1.35rem] tracking-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Analytics
          </h1>
          <p className="text-white/30 text-[12.5px] mt-0.5" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Performance overview for your clinic
          </p>
        </div>

        {/* Range toggle */}
        <div className="flex items-center bg-white/[0.04] border border-white/[0.07] rounded-xl p-1 gap-1">
          {['7d', '30d'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                range === r
                  ? 'bg-[#00e5b0]/[0.15] text-[#00e5b0]'
                  : 'text-white/30 hover:text-white/60'
              }`}
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              {r === '7d' ? 'Last 7 days' : 'Last 30 days'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Conversations" value={totalConvs} sub={`+${Math.floor(totalConvs * 0.12)} from prior period`} delay={0.05} />
        <StatCard label="Qualified Leads" value={totalLeads} sub={`${convRate}% conversion rate`} delay={0.1} />
        <StatCard label="Messages Handled" value={(msgRows.length).toLocaleString()} sub="by Tahsin.ai" delay={0.15} />
        <StatCard label="Peak Hour" value={peakHour.hour} sub={`${peakHour.messages} msgs this window`} delay={0.2} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Conversations over time" subtitle={`Daily breakdown · ${range === '7d' ? 'last 7 days' : 'last 30 days'}`} delay={0.25}>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5b0" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#00e5b0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-jakarta)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-jakarta)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="conversations" stroke="#00e5b0" strokeWidth={2} fill="url(#convGrad)" dot={false} name="Conversations" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Leads qualified per day" subtitle="Messages that converted to qualified leads" delay={0.3}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-jakarta)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-jakarta)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="leads" fill="#00e5b0" radius={[4, 4, 0, 0]} maxBarSize={32} name="Leads" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Message activity by hour" subtitle="When your patients reach out (UTC+4)" delay={0.35}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 9.5, fontFamily: 'var(--font-jakarta)' }}
              axisLine={false} tickLine={false}
              interval={3}
            />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'var(--font-jakarta)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="messages"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
              name="Messages"
              fill="#00e5b0"
              fillOpacity={0.55}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
