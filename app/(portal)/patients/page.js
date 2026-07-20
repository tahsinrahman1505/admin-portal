'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { TableSkeleton } from '@/components/Skeleton'

const STATUS_COLORS = {
  hot:    { bg: 'bg-[#00e5b0]/[0.1]',   text: 'text-[#00e5b0]',   dot: 'bg-[#00e5b0]' },
  warm:   { bg: 'bg-yellow-400/[0.1]', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  cold:   { bg: 'bg-white/[0.06]',     text: 'text-white/40',   dot: 'bg-white/25' },
  booked: { bg: 'bg-blue-400/[0.1]',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  none:   { bg: 'bg-white/[0.04]',     text: 'text-white/25',   dot: 'bg-white/15' },
}

function maskPhone(phone) {
  if (!phone) return '—'
  const clean = phone.replace(/\D/g, '')
  if (clean.length >= 7) return `+${clean.slice(0, clean.length - 4).replace(/.(?=.{2})/g, '*')}${clean.slice(-4)}`
  return phone
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function PatientsPage() {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [convDetail, setConvDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, phone, created_at, lead_status, updated_at')
        .order('updated_at', { ascending: false })

      if (!convs) { setLoading(false); return }

      // Aggregate by phone
      const map = {}
      convs.forEach(c => {
        const phone = c.phone || 'unknown'
        if (!map[phone]) {
          map[phone] = {
            phone,
            firstSeen: c.created_at,
            lastSeen: c.updated_at ?? c.created_at,
            totalConvs: 0,
            latestStatus: c.lead_status ?? 'none',
            convIds: [],
          }
        }
        map[phone].totalConvs++
        map[phone].convIds.push(c.id)
        if (new Date(c.updated_at) > new Date(map[phone].lastSeen)) {
          map[phone].lastSeen = c.updated_at
          map[phone].latestStatus = c.lead_status ?? 'none'
        }
      })

      // Fetch message counts per conversation in bulk
      const allIds = Object.values(map).flatMap(p => p.convIds)
      let msgCounts = {}
      if (allIds.length) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', allIds)
        if (msgs) {
          msgs.forEach(m => {
            msgCounts[m.conversation_id] = (msgCounts[m.conversation_id] ?? 0) + 1
          })
        }
      }

      const patientList = Object.values(map).map(p => ({
        ...p,
        totalMessages: p.convIds.reduce((sum, id) => sum + (msgCounts[id] ?? 0), 0),
      }))

      setPatients(patientList)
      setLoading(false)
    }
    load()
  }, [])

  async function openPatient(patient) {
    setSelected(patient)
    setDetailLoading(true)
    // Load last conversation messages
    const lastId = patient.convIds[0]
    const { data: msgs } = await supabase
      .from('messages')
      .select('role, content, created_at')
      .eq('conversation_id', lastId)
      .order('created_at', { ascending: true })
      .limit(30)
    setConvDetail(msgs ?? [])
    setDetailLoading(false)
  }

  if (loading) return <TableSkeleton />

  const STATUS_OPTIONS = ['all', 'hot', 'warm', 'cold', 'booked', 'none']
  const filtered = patients.filter(p => {
    const matchSearch = !search || p.phone.includes(search)
    const matchFilter = filter === 'all' || (p.latestStatus ?? 'none') === filter
    return matchSearch && matchFilter
  })

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
            Patients Directory
          </h1>
          <p className="text-white/30 text-[12.5px] mt-0.5" style={{ fontFamily: 'var(--font-jakarta)' }}>
            {patients.length} unique contacts across all conversations
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="flex flex-wrap items-center gap-3 mb-5"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by phone…"
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2 text-[12.5px] text-white/70 placeholder-white/20 outline-none focus:border-[#00e5b0]/30 transition-colors"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          />
        </div>

        {/* Status filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all duration-150 capitalize ${
                filter === s
                  ? 'bg-[#00e5b0]/[0.15] text-[#00e5b0] border border-[#00e5b0]/20'
                  : 'bg-white/[0.04] text-white/30 border border-white/[0.06] hover:text-white/50'
              }`}
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              {s === 'all' ? `All (${patients.length})` : s}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="glass sheen rounded-[var(--r-md)] relative overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Contact', 'Last Active', 'Conversations', 'Messages', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-[10.5px] font-semibold text-white/25 uppercase tracking-wider px-5 py-3.5" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-white/20 text-[13px] py-12" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    No patients found
                  </td>
                </tr>
              ) : filtered.map((p, i) => {
                const sc = STATUS_COLORS[p.latestStatus] ?? STATUS_COLORS.none
                return (
                  <motion.tr
                    key={p.phone}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.03 }}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => openPatient(p)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#00e5b0]/[0.08] border border-[#00e5b0]/15 flex items-center justify-center shrink-0">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 text-[#00e5b0]/50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                          </svg>
                        </div>
                        <span className="text-white/75 text-[13px] font-medium" style={{ fontFamily: 'var(--font-jakarta)' }}>
                          {maskPhone(p.phone)}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white/35 text-[12.5px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                        {timeAgo(p.lastSeen)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white/60 text-[12.5px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                        {p.totalConvs}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-white/60 text-[12.5px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                        {p.totalMessages}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize ${sc.bg} ${sc.text}`} style={{ fontFamily: 'var(--font-jakarta)' }}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                        {p.latestStatus ?? 'none'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4 text-white/20">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/>
                      </svg>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => { setSelected(null); setConvDetail(null) }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className="fixed right-0 top-0 h-full w-[420px] glass-strong sheen border-l border-white/[0.08] z-50 flex flex-col shadow-2xl"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
                <div>
                  <p className="text-white font-semibold text-[14px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    {maskPhone(selected.phone)}
                  </p>
                  <p className="text-white/30 text-[11.5px] mt-0.5" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    {selected.totalConvs} conversation{selected.totalConvs !== 1 ? 's' : ''} · {selected.totalMessages} messages
                  </p>
                </div>
                <button onClick={() => { setSelected(null); setConvDetail(null) }} className="text-white/30 hover:text-white/70 transition-colors">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Stats strip */}
              <div className="flex gap-3 px-6 py-4 border-b border-white/[0.05]">
                {[
                  { label: 'Status', value: selected.latestStatus ?? 'none' },
                  { label: 'Last seen', value: timeAgo(selected.lastSeen) },
                  { label: 'First contact', value: new Date(selected.firstSeen).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
                ].map(s => (
                  <div key={s.label} className="flex-1 bg-white/[0.03] rounded-xl px-3 py-2.5">
                    <p className="text-white/25 text-[10px] mb-0.5" style={{ fontFamily: 'var(--font-jakarta)' }}>{s.label}</p>
                    <p className="text-white/70 text-[12.5px] font-semibold capitalize" style={{ fontFamily: 'var(--font-jakarta)' }}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                <p className="text-white/20 text-[10.5px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-jakarta)' }}>
                  Latest conversation
                </p>
                {detailLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`h-10 rounded-2xl bg-white/[0.04] animate-pulse ${i % 2 === 0 ? 'ml-auto w-3/4' : 'w-2/3'}`} />
                    ))}
                  </div>
                ) : convDetail?.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'customer' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[12.5px] leading-relaxed ${
                      msg.role === 'customer'
                        ? 'bg-[#005c4b] text-white rounded-tr-[4px]'
                        : 'bg-[#202c33] text-white rounded-tl-[4px]'
                    }`} style={{ fontFamily: 'var(--font-jakarta)' }}>
                      {msg.role === 'assistant' && (
                        <p className="text-[#00e5b0] text-[9.5px] font-bold uppercase tracking-wider mb-1">Tahsin.ai</p>
                      )}
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
