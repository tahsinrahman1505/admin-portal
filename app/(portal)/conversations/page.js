'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ConversationsSkeleton } from '@/components/Skeleton'

const API_URL     = '/api/rag'
const API_HEADERS = { 'Content-Type': 'application/json' }

// ── Channel helpers ─────────────────────────────────────────────────────────

const CHANNEL_META = {
  whatsapp:  { label: 'WhatsApp',   color: '#25D366', bg: 'bg-[#25D366]/10', border: 'border-[#25D366]/20', text: 'text-[#25D366]',  icon: '💬' },
  instagram: { label: 'Instagram',  color: '#E1306C', bg: 'bg-[#E1306C]/10', border: 'border-[#E1306C]/20', text: 'text-[#E1306C]',  icon: '📸' },
  messenger: { label: 'Messenger',  color: '#0084FF', bg: 'bg-[#0084FF]/10', border: 'border-[#0084FF]/20', text: 'text-[#0084FF]',  icon: '💙' },
}

function ChannelBadge({ channel }) {
  const m = CHANNEL_META[channel] || CHANNEL_META.whatsapp
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${m.bg} ${m.text} border ${m.border}`}>
      <span>{m.icon}</span>{m.label}
    </span>
  )
}

// ── Identity helpers ─────────────────────────────────────────────────────────

function maskIdentity(id, channel) {
  if (!id) return 'Unknown'
  if (channel === 'instagram') return `@ig_${id.slice(-6)}`
  if (channel === 'messenger') return `msg_${id.slice(-6)}`
  // WhatsApp: mask phone
  return id.slice(0, -6) + '***-**' + id.slice(-2)
}

function displayIdentity(id, channel) {
  if (!id) return 'Unknown'
  if (channel === 'instagram') return `Instagram user`
  if (channel === 'messenger') return `Messenger user`
  return id
}

function normalizeIdentity(id) {
  // For WhatsApp: strip leading +; for IG/Messenger: keep as-is
  return id ? id.replace(/^\+/, '') : ''
}

function formatTimestamp(ts) {
  const date = new Date(ts)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ', ' + date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    'Handled by Bot': 'bg-[#00e5b0]/10 text-[#00e5b0] border border-[#00e5b0]/20',
    'Handed Off':     'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    'Pending':        'bg-red-500/10 text-red-400 border border-red-500/20',
  }
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[status] || 'bg-white/5 text-white/30'}`}>
      {status || 'Unknown'}
    </span>
  )
}

// ── Channel filter tabs ───────────────────────────────────────────────────────

const CHANNEL_TABS = ['all', 'whatsapp', 'instagram', 'messenger']

function ChannelTabs({ active, onChange, counts }) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] overflow-x-auto scrollbar-none" style={{ scrollbarWidth: 'none' }}>
      {CHANNEL_TABS.map(ch => {
        const m = ch === 'all' ? null : CHANNEL_META[ch]
        const count = counts[ch] || 0
        return (
          <button
            key={ch}
            onClick={() => onChange(ch)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors shrink-0 ${
              active === ch
                ? 'bg-white/10 text-white'
                : 'text-white/35 hover:text-white/60 hover:bg-white/5'
            }`}
          >
            {m ? m.icon : '🌐'}
            <span className="capitalize">{ch === 'all' ? 'All' : m.label}</span>
            {count > 0 && (
              <span className={`text-[10px] px-1 rounded-full ${active === ch ? 'bg-white/20' : 'bg-white/5'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const router = useRouter()
  const [threads, setThreads]           = useState([])
  const [selected, setSelected]         = useState(null)
  const [search, setSearch]             = useState('')
  const [channelTab, setChannelTab]     = useState('all')
  const [loading, setLoading]           = useState(true)
  const [handoffSessions, setHandoffSessions] = useState([]) // [{sender_id, channel, ...}]
  const [botClientId, setBotClientId]   = useState('')
  const [portalClientId, setPortalClientId] = useState(null)
  const [resuming, setResuming]         = useState(null)
  const [replyText, setReplyText]       = useState('')
  const [sending, setSending]           = useState(false)
  const [summary, setSummary]           = useState(null)
  const [summarizing, setSummarizing]   = useState(false)

  const [liveMessages, setLiveMessages] = useState([])
  const bottomRef   = useRef(null)
  const realtimeRef = useRef(null)


  // ── Load handoff sessions ──
  const loadHandoffSessions = useCallback(async (botCid) => {
    if (!botCid) return
    try {
      const { data } = await supabase
        .from('sessions')
        .select('session_id, state, channel')
        .eq('state', 'handoff')
        .like('session_id', `${botCid}::%`)
      if (data) {
        const sessions = data.map(r => ({
          sender_id: r.session_id.replace(`${botCid}::`, ''),
          channel:   r.channel || 'whatsapp',
        }))
        setHandoffSessions(sessions)
      }
    } catch (e) {
      console.error('loadHandoffSessions error:', e)
    }
  }, [])

  // ── Initial data load ──
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, bot_client_id')
        .eq('user_id', user.id)
        .single()
      if (!clientRow) { setLoading(false); return }

      const botCid = clientRow.bot_client_id || ''
      setBotClientId(botCid)
      setPortalClientId(clientRow.id)

      const { data: rows } = await supabase
        .from('conversations')
        .select('*')
        .eq('client_id', clientRow.id)
        .order('created_at', { ascending: true })

      if (!rows) { setLoading(false); return }

      const map = {}
      for (const row of rows) {
        const sid = row.session_id || ('nosession_' + row.id)
        if (!map[sid]) map[sid] = []
        map[sid].push(row)
      }

      const threadList = Object.entries(map).map(([sid, messages]) => ({
        session_id:   sid,
        sender_id:    messages[0]?.phone_number || sid,
        channel:      messages[0]?.channel || 'whatsapp',
        // keep phone for compat
        phone:        messages[0]?.phone_number || 'Unknown',
        status:       messages[0]?.session_status || 'Handed Off',
        firstMessage: messages.find(m => m.role === 'customer')?.message || messages[0]?.message,
        lastAt:       messages[messages.length - 1]?.created_at,
        messages,
      })).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))

      setThreads(threadList)
      if (threadList.length > 0) {
        setSelected(threadList[0])
        setLiveMessages(threadList[0].messages)
      }

      await loadHandoffSessions(botCid)
      setLoading(false)
    }
    load()
  }, [loadHandoffSessions])

  // ── Supabase Realtime ──
  useEffect(() => {
    if (!portalClientId) return

    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)

    const channel = supabase
      .channel('conversations-inbox')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'conversations',
        filter: `client_id=eq.${portalClientId}`,
      }, (payload) => {
        const newRow = payload.new
        // Refresh handoff sessions whenever a handoff status row arrives
        if (newRow.session_status === 'Handed Off') {
          loadHandoffSessions(botClientId)
        }
        setThreads(prev => {
          const idx = prev.findIndex(t => t.session_id === newRow.session_id)
          if (idx === -1) {
            const newThread = {
              session_id:   newRow.session_id,
              sender_id:    newRow.phone_number || newRow.session_id,
              channel:      newRow.channel || 'whatsapp',
              phone:        newRow.phone_number || 'Unknown',
              status:       newRow.session_status || 'Handed Off',
              firstMessage: newRow.role === 'customer' ? newRow.message : '',
              lastAt:       newRow.created_at,
              messages:     [newRow],
            }
            return [newThread, ...prev]
          }
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            lastAt:   newRow.created_at,
            status:   newRow.session_status || updated[idx].status,
            channel:  newRow.channel || updated[idx].channel,
            messages: [...updated[idx].messages, newRow],
          }
          return updated.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
        })
        setSelected(sel => {
          if (sel && sel.session_id === newRow.session_id) {
            setLiveMessages(prev => [...prev, newRow])
          }
          return sel
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversations',
        filter: `client_id=eq.${portalClientId}`,
      }, (payload) => {
        const updated = payload.new
        setThreads(prev => prev.map(t => {
          if (t.session_id !== updated.session_id) return t
          return {
            ...t,
            status: updated.session_status || t.status,
            messages: t.messages.map(m => m.id === updated.id ? updated : m),
          }
        }))
        setLiveMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
      })
      .subscribe()

    realtimeRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [portalClientId, botClientId, loadHandoffSessions])

  // ── Switch liveMessages when selected thread changes ──
  useEffect(() => {
    if (selected) { setLiveMessages(selected.messages); setSummary(null) }
  }, [selected?.session_id]) // eslint-disable-line

  // ── Auto-scroll ──
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [liveMessages])

  // ── Handoff check — now channel-aware ──
  function isHandedOff(thread) {
    const norm = normalizeIdentity(thread.sender_id || thread.phone)
    return handoffSessions.some(h => h.sender_id === norm)
  }

  function getStatus(thread) {
    return isHandedOff(thread) ? 'Handed Off' : thread.status
  }

  function getThreadChannel(thread) {
    // Try to find the channel from handoff sessions for accuracy
    const norm = normalizeIdentity(thread.sender_id || thread.phone)
    const hs   = handoffSessions.find(h => h.sender_id === norm)
    return hs?.channel || thread.channel || 'whatsapp'
  }

  // ── Resume Bot ──
  async function handleResume(thread) {
    const norm = normalizeIdentity(thread.sender_id || thread.phone)
    setResuming(norm)
    try {
      const res = await fetch(`${API_URL}/session/resume`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ session_id: norm, client_id: botClientId || 'dental_demo' })
      })
      if (res.ok) {
        setHandoffSessions(prev => prev.filter(h => h.sender_id !== norm))
      }
    } catch (e) { console.error('Resume error:', e) }
    finally { setResuming(null) }
  }

  // ── AI Summary ──
  async function handleSummarize() {
    if (!selected || summarizing) return
    setSummarizing(true); setSummary(null)
    try {
      const res = await fetch(`${API_URL}/session/summary`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ session_id: selected.session_id, client_id: botClientId || 'dental_demo' })
      })
      const data = await res.json()
      setSummary(data.summary || 'No summary available.')
    } catch { setSummary('Failed to generate summary. Please try again.') }
    finally { setSummarizing(false) }
  }

  // ── Owner reply — channel-aware ──
  async function handleSend() {
    if (!replyText.trim() || !selected || sending) return
    const msgText  = replyText.trim()
    const threadCh = getThreadChannel(selected)
    const norm     = normalizeIdentity(selected.sender_id || selected.phone)
    setReplyText(''); setSending(true)

    const optimisticMsg = {
      id: `opt_${Date.now()}`, session_id: selected.session_id,
      phone_number: selected.phone, role: 'owner', message: msgText,
      session_status: 'Handed Off', created_at: new Date().toISOString(),
    }
    setLiveMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch(`${API_URL}/session/send`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({
          session_id: norm,
          message:    msgText,
          client_id:  botClientId || 'dental_demo',
          channel:    threadCh,
        })
      })
      if (!res.ok) {
        setLiveMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
        console.error('Send failed:', await res.text())
      }
    } catch (e) {
      setLiveMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      console.error('Send error:', e)
    } finally { setSending(false) }
  }

  // ── Channel counts for tabs ──
  const channelCounts = threads.reduce((acc, t) => {
    const ch = t.channel || 'whatsapp'
    acc[ch] = (acc[ch] || 0) + 1
    acc.all = (acc.all || 0) + 1
    return acc
  }, {})

  // ── Filter threads by channel tab + search ──
  const filtered = threads.filter(t => {
    if (channelTab !== 'all' && (t.channel || 'whatsapp') !== channelTab) return false
    const q = search.toLowerCase()
    if (!q) return true
    return (
      (t.sender_id || t.phone || '').toLowerCase().includes(q) ||
      t.messages.some(m => m.message?.toLowerCase().includes(q))
    )
  })

  if (loading) return <ConversationsSkeleton />

  const selectedHandedOff  = selected ? isHandedOff(selected) : false
  const selectedStatus     = selected ? getStatus(selected)   : null
  const selectedChannel    = selected ? getThreadChannel(selected) : 'whatsapp'
  const channelMeta        = CHANNEL_META[selectedChannel] || CHANNEL_META.whatsapp

  return (
    <div className="flex h-full overflow-hidden text-white">
      {/* ── Thread list ── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.015] overflow-x-auto">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[13px] font-semibold text-white">All Conversations</h1>
            <span className="text-[11px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </div>
          <input
            type="text"
            placeholder="Search message…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-[#00e5b0]/40 transition-colors"
          />
        </div>

        {/* Channel filter tabs */}
        <ChannelTabs active={channelTab} onChange={setChannelTab} counts={channelCounts} />

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-white/20 text-xs p-4">No conversations found.</p>
          )}
          {filtered.map(thread => {
            const liveStatus = getStatus(thread)
            const threadCh   = thread.channel || 'whatsapp'
            return (
              <button
                key={thread.session_id}
                onClick={() => { setSelected(thread); setLiveMessages(thread.messages); loadHandoffSessions(botClientId) }}
                className={`w-full text-left px-4 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
                  selected?.session_id === thread.session_id
                    ? 'bg-[#00e5b0]/[0.05] border-l-2 border-l-[#00e5b0]/50'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[12.5px] font-medium text-white leading-tight truncate">
                    {maskIdentity(thread.sender_id || thread.phone, threadCh)}
                  </span>
                  <ChannelBadge channel={threadCh} />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={liveStatus} />
                </div>
                <p className="text-[12px] text-white/35 truncate">{thread.firstMessage}</p>
                <p className="text-[11px] text-white/20 mt-1">{formatTimestamp(thread.lastAt)}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Chat panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080808]">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-white/20 text-sm">
            Select a conversation to view
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="shrink-0 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13.5px] font-semibold text-white">
                      {maskIdentity(selected.sender_id || selected.phone, selectedChannel)}
                    </p>
                    <ChannelBadge channel={selectedChannel} />
                  </div>
                  <p className="text-[12px] text-white/30">
                    {liveMessages.length} messages · Last active {formatTimestamp(selected.lastAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedStatus} />

                  {liveMessages.length > 0 && (
                    <button
                      onClick={handleSummarize}
                      disabled={summarizing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                                 bg-white/[0.05] text-white/50 border border-white/[0.08]
                                 hover:bg-white/[0.08] hover:text-white/70 transition-colors
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {summarizing ? (
                        <><span className="w-3 h-3 border border-white/40 border-t-white/70 rounded-full animate-spin" />Summarizing…</>
                      ) : <>✦ Summary</>}
                    </button>
                  )}

                  {selectedHandedOff && (
                    <button
                      onClick={() => handleResume(selected)}
                      disabled={resuming === normalizeIdentity(selected.sender_id || selected.phone)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                                 bg-[#00e5b0]/10 text-[#00e5b0] border border-[#00e5b0]/25
                                 hover:bg-[#00e5b0]/20 transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resuming === normalizeIdentity(selected.sender_id || selected.phone) ? (
                        <><span className="w-3 h-3 border border-[#00e5b0]/60 border-t-[#00e5b0] rounded-full animate-spin" />Resuming…</>
                      ) : <>🤖 Resume Bot</>}
                    </button>
                  )}
                </div>
              </div>

              {summary && (
                <div className="mx-6 mb-4 bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 flex gap-3">
                  <span className="text-[#00e5b0] text-[14px] shrink-0 mt-0.5">✦</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#00e5b0] font-semibold uppercase tracking-wider mb-1.5">AI Summary</p>
                    <p className="text-[12.5px] text-white/70 leading-relaxed">{summary}</p>
                  </div>
                  <button onClick={() => setSummary(null)} className="text-white/20 hover:text-white/50 transition-colors shrink-0 self-start">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Message thread */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {liveMessages.map((msg, i) => {
                const role       = msg.role
                const isCustomer = role === 'customer'
                const isOwner    = role === 'owner'
                const isBot      = role === 'bot'
                const msgChannel = msg.channel || selectedChannel

                return (
                  <div key={msg.id || i} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[62%] rounded-2xl px-4 py-2.5 ${
                      isCustomer
                        ? 'bg-[#005c4b] text-white rounded-tr-sm'
                        : isOwner
                          ? 'bg-indigo-600/80 text-white rounded-tl-sm'
                          : 'bg-white/[0.05] border border-white/[0.07] text-white/80 rounded-tl-sm'
                    }`}>
                      {isBot && (
                        <p className="text-[10px] text-[#00e5b0] font-semibold uppercase tracking-wider mb-1">Tahsin.ai</p>
                      )}
                      {isOwner && (
                        <p className="text-[10px] text-indigo-300 font-semibold uppercase tracking-wider mb-1">You</p>
                      )}
                      {isCustomer && msgChannel !== 'whatsapp' && (
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${CHANNEL_META[msgChannel]?.text || ''}`}>
                          via {CHANNEL_META[msgChannel]?.label || msgChannel}
                        </p>
                      )}
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-[10.5px] mt-1.5 ${isCustomer ? 'text-white/40' : 'text-white/25'}`}>
                        {isCustomer ? 'Customer' : isOwner ? 'Owner' : 'Bot'} · {formatTimestamp(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}

              {selectedHandedOff && (
                <div className="flex justify-center py-2">
                  <span className="text-[11px] text-amber-400/60 bg-amber-500/5 border border-amber-500/10 px-3 py-1 rounded-full">
                    ⏸ Human handling this conversation
                  </span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Reply box — only during handoff */}
            {selectedHandedOff && (
              <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder={`Reply via ${channelMeta.label}… (Enter to send)`}
                    rows={2}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5
                               text-[13px] text-white placeholder-white/25 outline-none resize-none
                               focus:border-indigo-500/40 transition-colors"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!replyText.trim() || sending}
                    className="shrink-0 px-4 py-2.5 rounded-xl text-[12.5px] font-medium
                               bg-indigo-600 text-white hover:bg-indigo-500 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <span className="w-4 h-4 border border-white/40 border-t-white rounded-full animate-spin inline-block" />
                    ) : 'Send'}
                  </button>
                </div>
                <p className="text-[10.5px] text-white/20 mt-1.5 px-1">
                  {channelMeta.icon} Replies go back on {channelMeta.label} · Resume Bot to hand back to AI
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
