'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

// ─── Channel definitions ─────────────────────────────────────────────────────

const CHANNELS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    description: 'Direct WhatsApp Business messaging',
    color: '#25D366',
    bg: 'rgba(37,211,102,0.08)',
    border: 'rgba(37,211,102,0.18)',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram DM',
    description: 'Instagram Direct Message automation',
    color: '#E1306C',
    bg: 'rgba(225,48,108,0.08)',
    border: 'rgba(225,48,108,0.18)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5.5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    key: 'messenger',
    label: 'Messenger',
    description: 'Facebook Messenger automation',
    color: '#0084FF',
    bg: 'rgba(0,132,255,0.08)',
    border: 'rgba(0,132,255,0.18)',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.26.35.27.57l.05 1.78c.04.57.62.94 1.14.71l1.98-.87c.17-.08.36-.09.54-.04 1.03.28 2.12.43 3.24.43 5.64 0 10-4.13 10-9.7C22 6.13 17.64 2 12 2zm6 7.46l-2.93 4.66c-.47.74-1.47.93-2.18.4l-2.34-1.75a.6.6 0 00-.72 0l-3.16 2.4c-.42.32-.97-.18-.69-.63l2.93-4.66c.47-.74 1.47-.93 2.18-.4l2.34 1.75a.6.6 0 00.72 0l3.16-2.4c.42-.32.97.18.69.63z"/>
      </svg>
    ),
  },
]

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange, color }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0"
      style={{ background: enabled ? color : 'rgba(255,255,255,0.08)' }}
      aria-checked={enabled}
      role="switch"
    >
      <motion.span
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
        animate={{ left: enabled ? '1.375rem' : '0.25rem' }}
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
      />
    </button>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({ value, label, color }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-0">
      <span className="text-[1.35rem] font-extrabold tabular-nums" style={{ color }}>
        {value ?? '—'}
      </span>
      <span className="text-[10.5px] text-white/30 whitespace-nowrap">{label}</span>
    </div>
  )
}

// ─── Channel card ─────────────────────────────────────────────────────────────

function ChannelCard({ ch, config, stats, saving, onToggle, onConfigChange, onSave, index }) {
  const isEnabled = config?.enabled ?? false
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border overflow-hidden"
      style={{
        background: isEnabled ? ch.bg : 'rgba(255,255,255,0.015)',
        borderColor: isEnabled ? ch.border : 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Top highlight line */}
      <div
        className="h-px w-full"
        style={{ background: isEnabled ? `linear-gradient(90deg, transparent, ${ch.color}50, transparent)` : 'transparent' }}
      />

      {/* Card header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: isEnabled ? `${ch.color}18` : 'rgba(255,255,255,0.04)', color: isEnabled ? ch.color : 'rgba(255,255,255,0.2)' }}
            >
              {ch.icon}
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white">{ch.label}</p>
              <p className="text-[11.5px] text-white/30 mt-0.5">{ch.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            {/* Status dot */}
            <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: isEnabled ? ch.color : 'rgba(255,255,255,0.2)' }}>
              <span className="relative flex w-2 h-2">
                {isEnabled && (
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                    style={{ background: ch.color }}
                  />
                )}
                <span
                  className="relative inline-flex rounded-full w-2 h-2"
                  style={{ background: isEnabled ? ch.color : 'rgba(255,255,255,0.15)' }}
                />
              </span>
              {isEnabled ? 'Active' : 'Disabled'}
            </span>
            <Toggle enabled={isEnabled} onChange={(val) => onToggle(ch.key, val)} color={ch.color} />
          </div>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-3 gap-2 py-4 rounded-xl mb-0"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <StatPill value={stats?.messages?.toLocaleString()} label="Messages" color={isEnabled ? ch.color : 'rgba(255,255,255,0.3)'} />
          <div className="w-px bg-white/[0.05]" />
          <StatPill value={stats?.leads} label="Leads" color={isEnabled ? ch.color : 'rgba(255,255,255,0.3)'} />
          <div className="col-span-3 h-px bg-white/[0.04]" />
          <StatPill value={stats?.bookings} label="Bookings" color={isEnabled ? ch.color : 'rgba(255,255,255,0.3)'} />
          <div className="w-px bg-white/[0.05]" />
          <StatPill
            value={stats?.leads > 0 ? `${Math.round((stats.bookings / stats.leads) * 100)}%` : '—'}
            label="Conv. rate"
            color={isEnabled ? ch.color : 'rgba(255,255,255,0.3)'}
          />
        </div>
      </div>

      {/* Expandable settings */}
      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-6 py-3.5 text-[12.5px] text-white/35 hover:text-white/60 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            Channel settings
          </span>
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            className="w-3.5 h-3.5 transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/>
          </svg>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 space-y-4">
                {/* Greeting */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">
                    Channel greeting
                  </label>
                  <textarea
                    rows={2}
                    placeholder={`Hi! How can we help you today via ${ch.label}?`}
                    value={config?.greeting ?? ''}
                    onChange={e => onConfigChange(ch.key, 'greeting', e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[13px] text-white/80 placeholder:text-white/20 resize-none focus:outline-none focus:border-white/20 transition-colors"
                    style={{ fontFamily: 'var(--font-jakarta)' }}
                  />
                </div>

                {/* Auto-reply delay */}
                <div>
                  <label className="block text-[11.5px] font-semibold text-white/40 mb-1.5 uppercase tracking-wider">
                    Auto-reply delay
                  </label>
                  <select
                    value={config?.reply_delay ?? '0'}
                    onChange={e => onConfigChange(ch.key, 'reply_delay', e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[13px] text-white/70 focus:outline-none focus:border-white/20 transition-colors appearance-none"
                    style={{ fontFamily: 'var(--font-jakarta)' }}
                  >
                    <option value="0">Instant (0s)</option>
                    <option value="5">5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="60">1 minute</option>
                  </select>
                </div>

                {/* Feature toggles */}
                <div className="space-y-2.5">
                  {[
                    { key: 'lead_capture', label: 'Lead capture', desc: 'Collect name + phone from new patients' },
                    { key: 'booking_flow', label: 'Booking flow',  desc: 'Offer appointment booking in chat' },
                    { key: 'handoff',      label: 'Human handoff', desc: 'Escalate complex cases to staff' },
                  ].map(feat => (
                    <div key={feat.key} className="flex items-center justify-between gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
                      <div>
                        <p className="text-[12.5px] text-white/60">{feat.label}</p>
                        <p className="text-[11px] text-white/25 mt-0.5">{feat.desc}</p>
                      </div>
                      <Toggle
                        enabled={config?.[feat.key] ?? true}
                        onChange={val => onConfigChange(ch.key, feat.key, val)}
                        color={ch.color}
                      />
                    </div>
                  ))}
                </div>

                {/* Save button */}
                <button
                  onClick={() => onSave(ch.key)}
                  disabled={saving === ch.key}
                  className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{
                    background: `${ch.color}18`,
                    color: ch.color,
                    border: `1px solid ${ch.color}30`,
                  }}
                >
                  {saving === ch.key ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Saving…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                      </svg>
                      Save {ch.label} settings
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ allStats, channelConfigs }) {
  const totalMessages = Object.values(allStats).reduce((s, v) => s + (v.messages ?? 0), 0)
  const totalLeads    = Object.values(allStats).reduce((s, v) => s + (v.leads    ?? 0), 0)
  const totalBookings = Object.values(allStats).reduce((s, v) => s + (v.bookings ?? 0), 0)
  const activeCount   = CHANNELS.filter(ch => channelConfigs[ch.key]?.enabled).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-5 mb-6 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00e5b0]/25 to-transparent" />
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-0.5">Active channels</p>
          <p className="text-[1.5rem] font-extrabold text-white tabular-nums">{activeCount} <span className="text-white/20 text-[1rem] font-medium">/ 3</span></p>
        </div>
        <div className="w-px h-10 bg-white/[0.06]" />
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-0.5">Total messages</p>
          <p className="text-[1.5rem] font-extrabold text-white tabular-nums">{totalMessages.toLocaleString()}</p>
        </div>
        <div className="w-px h-10 bg-white/[0.06]" />
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-0.5">Total leads</p>
          <p className="text-[1.5rem] font-extrabold text-[#00e5b0] tabular-nums">{totalLeads}</p>
        </div>
        <div className="w-px h-10 bg-white/[0.06]" />
        <div>
          <p className="text-[11px] text-white/30 uppercase tracking-wider mb-0.5">Total bookings</p>
          <p className="text-[1.5rem] font-extrabold text-white tabular-nums">{totalBookings}</p>
        </div>
        <div className="ml-auto hidden sm:block">
          {/* Channel proportion mini-bars */}
          <p className="text-[10.5px] text-white/25 mb-1.5">Message share</p>
          <div className="flex gap-1.5">
            {CHANNELS.map(ch => {
              const share = totalMessages > 0 ? Math.round(((allStats[ch.key]?.messages ?? 0) / totalMessages) * 100) : 0
              return (
                <div key={ch.key} title={`${ch.label}: ${share}%`}>
                  <div className="w-14 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${share}%`, background: ch.color }} />
                  </div>
                  <p className="text-[10px] mt-1 text-center tabular-nums" style={{ color: ch.color }}>{share}%</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const router = useRouter()
  const [loading, setLoading]             = useState(true)
  const [clientId, setClientId]           = useState(null)
  const [channelConfigs, setChannelConfigs] = useState({})
  const [allStats, setAllStats]           = useState({ whatsapp: {}, instagram: {}, messenger: {} })
  const [saving, setSaving]               = useState(null)   // channel key being saved
  const [savedFlash, setSavedFlash]       = useState(null)   // flash message per key

  // ── Auth + load ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: clientRow } = await supabase
        .from('clients').select('id').eq('user_id', user.id).single()
      if (!clientRow) { setLoading(false); return }

      const cid = clientRow.id
      setClientId(cid)

      // Load channel configs (one row per channel in channel_configs table,
      // or fall back to a default if the table / row doesn't exist yet)
      const { data: cfgs } = await supabase
        .from('channel_configs')
        .select('*')
        .eq('client_id', cid)

      const configMap = {}
      CHANNELS.forEach(ch => {
        const row = cfgs?.find(r => r.channel === ch.key)
        configMap[ch.key] = row ?? {
          channel:    ch.key,
          client_id:  cid,
          enabled:    ch.key === 'whatsapp', // WhatsApp on by default
          greeting:   '',
          reply_delay: '0',
          lead_capture: true,
          booking_flow: true,
          handoff:      true,
        }
      })
      setChannelConfigs(configMap)

      // Load per-channel stats in parallel
      await loadStats(cid)
      setLoading(false)
    }
    init()
  }, [])

  const loadStats = useCallback(async (cid) => {
    const stats = { whatsapp: {}, instagram: {}, messenger: {} }
    await Promise.all(
      CHANNELS.map(async ch => {
        try {
          const [{ count: messages }, { count: leads }, { count: bookings }] = await Promise.all([
            supabase.from('conversations').select('*', { count: 'exact', head: true })
              .eq('client_id', cid).eq('channel', ch.key),
            supabase.from('leads').select('*', { count: 'exact', head: true })
              .eq('client_id', cid).eq('channel', ch.key),
            supabase.from('leads').select('*', { count: 'exact', head: true })
              .eq('client_id', cid).eq('channel', ch.key).eq('status', 'booked'),
          ])
          stats[ch.key] = { messages: messages ?? 0, leads: leads ?? 0, bookings: bookings ?? 0 }
        } catch {
          stats[ch.key] = { messages: 0, leads: 0, bookings: 0 }
        }
      })
    )
    setAllStats(stats)
  }, [])

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function handleToggle(chKey, val) {
    setChannelConfigs(prev => ({
      ...prev,
      [chKey]: { ...prev[chKey], enabled: val },
    }))
  }

  // ── Config field change ────────────────────────────────────────────────────
  function handleConfigChange(chKey, field, val) {
    setChannelConfigs(prev => ({
      ...prev,
      [chKey]: { ...prev[chKey], [field]: val },
    }))
  }

  // ── Save single channel ────────────────────────────────────────────────────
  async function handleSave(chKey) {
    if (!clientId) return
    setSaving(chKey)
    try {
      const cfg = { ...channelConfigs[chKey], client_id: clientId, channel: chKey }
      const { error } = await supabase
        .from('channel_configs')
        .upsert(cfg, { onConflict: 'client_id,channel' })
      if (!error) {
        setSavedFlash(chKey)
        setTimeout(() => setSavedFlash(null), 2500)
      }
    } catch (e) {
      console.error('Save error', e)
    }
    setSaving(null)
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 max-w-[1100px]">
        <div className="h-8 w-48 bg-white/[0.05] rounded-xl mb-3 animate-pulse" />
        <div className="h-4 w-72 bg-white/[0.03] rounded-lg mb-8 animate-pulse" />
        <div className="h-24 bg-white/[0.03] rounded-2xl mb-6 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-72 bg-white/[0.03] rounded-2xl animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1100px]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-7"
      >
        <p className="text-white/30 text-[13px] mb-1">Configuration</p>
        <h1 className="text-[1.75rem] font-extrabold text-white tracking-tight">
          Channel <span className="text-[#00e5b0]">Control Panel</span>
        </h1>
        <p className="text-white/35 text-[13.5px] mt-1.5 max-w-lg">
          Enable, configure, and monitor each patient messaging channel from one place.
          Changes take effect immediately.
        </p>
      </motion.div>

      {/* Summary bar */}
      <SummaryBar allStats={allStats} channelConfigs={channelConfigs} />

      {/* Save-flash banner */}
      <AnimatePresence>
        {savedFlash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-[#00e5b0]/10 border border-[#00e5b0]/20 text-[#00e5b0] text-[13px] font-medium"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
            </svg>
            {CHANNELS.find(c => c.key === savedFlash)?.label} settings saved successfully.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {CHANNELS.map((ch, i) => (
          <ChannelCard
            key={ch.key}
            ch={ch}
            index={i}
            config={channelConfigs[ch.key]}
            stats={allStats[ch.key]}
            saving={saving}
            onToggle={handleToggle}
            onConfigChange={handleConfigChange}
            onSave={handleSave}
          />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-white/15 text-[11.5px] mt-7 flex items-center gap-1.5">
        <span className="text-[#00e5b0]/40">◎</span>
        Channel settings are stored per clinic and synced across all AI agents in real time.
        Stats update on page load.
      </p>
    </div>
  )
}
