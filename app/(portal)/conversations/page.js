'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ConversationsSkeleton } from '@/components/Skeleton'

const API_URL     = process.env.NEXT_PUBLIC_API_URL || ''
const API_SECRET  = process.env.NEXT_PUBLIC_RAG_API_SECRET || ''
const API_HEADERS = { 'Content-Type': 'application/json', 'x-api-key': API_SECRET }

function maskPhone(phone) {
  if (!phone) return 'Unknown'
  return phone.slice(0, -6) + '***-**' + phone.slice(-2)
}

function formatTimestamp(ts) {
  const date = new Date(ts)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ', ' + date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function normalizePhone(phone) {
  return phone ? phone.replace(/^\+/, '') : ''
}

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

export default function ConversationsPage() {
  const router = useRouter()
  const [threads, setThreads]         = useState([])
  const [selected, setSelected]       = useState(null)
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [handoffPhones, setHandoffPhones] = useState(new Set())
  const [botClientId, setBotClientId] = useState('')
  const [portalClientId, setPortalClientId] = useState(null)
  const [resuming, setResuming]       = useState(null)
  const [replyText, setReplyText]     = useState('')
  const [sending, setSending]         = useState(false)
  const [summary, setSummary]         = useState(null)   // null | string
  const [summarizing, setSummarizing] = useState(false)

  // Messages for the selected thread (live-updated via Realtime)
  const [liveMessages, setLiveMessages] = useState([])
  const bottomRef = useRef(null)
  const realtimeRef = useRef(null)

  // ── Load handoff sessions ──
  const loadHandoffSessions = useCallback(async (botCid) => {
    if (!botCid) return
    try {
      const { data } = await supabase
        .from('sessions')
        .select('session_id, state')
        .eq('state', 'handoff')
        .like('session_id', `${botCid}::%`)
      if (data) {
        const phones = new Set(data.map(r => r.session_id.replace(`${botCid}::`, '')))
        setHandoffPhones(phones)
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

      // Load conversations from Supabase
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

  // ── Supabase Realtime subscription ──
  useEffect(() => {
    if (!portalClientId) return

    // Unsubscribe previous channel
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current)
    }

    const channel = supabase
      .channel('conversations-inbox')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
          filter: `client_id=eq.${portalClientId}`,
        },
        (payload) => {
          const newRow = payload.new

          // Update the thread list
          setThreads(prev => {
            const idx = prev.findIndex(t => t.session_id === newRow.session_id)
            if (idx === -1) {
              // New thread
              const newThread = {
                session_id:   newRow.session_id,
                phone:        newRow.phone_number || newRow.session_id,
                status:       newRow.session_status || 'Handed Off',
                firstMessage: newRow.role === 'customer' ? newRow.message : '',
                lastAt:       newRow.created_at,
                messages:     [newRow],
              }
              return [newThread, ...prev]
            }
            // Existing thread — update
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              lastAt:   newRow.created_at,
              status:   newRow.session_status || updated[idx].status,
              messages: [...updated[idx].messages, newRow],
            }
            // Re-sort by lastAt
            return updated.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))
          })

          // If the new row belongs to the selected thread, append to liveMessages
          setSelected(sel => {
            if (sel && sel.session_id === newRow.session_id) {
              setLiveMessages(prev => [...prev, newRow])
            }
            return sel
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `client_id=eq.${portalClientId}`,
        },
        (payload) => {
          const updated = payload.new
          // Update session_status across threads on resume
          setThreads(prev => prev.map(t => {
            if (t.session_id !== updated.session_id) return t
            return {
              ...t,
              status: updated.session_status || t.status,
              messages: t.messages.map(m => m.id === updated.id ? updated : m),
            }
          }))
          setLiveMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
        }
      )
      .subscribe()

    realtimeRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [portalClientId])

  // ── Switch liveMessages + clear summary when selected thread changes ──
  useEffect(() => {
    if (selected) {
      setLiveMessages(selected.messages)
      setSummary(null)
    }
  }, [selected?.session_id]) // eslint-disable-line

  // ── Auto-scroll to bottom ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [liveMessages])

  // ── Status helpers ──
  function getStatus(thread) {
    const normalized = normalizePhone(thread.phone)
    if (handoffPhones.has(normalized)) return 'Handed Off'
    return thread.status
  }

  // ── Resume Bot ──
  async function handleResume(thread) {
    const normalized = normalizePhone(thread.phone)
    setResuming(normalized)
    try {
      const res = await fetch(`${API_URL}/session/resume`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({ session_id: normalized, client_id: botClientId || 'dental_demo' })
      })
      if (res.ok) {
        setHandoffPhones(prev => {
          const next = new Set(prev)
          next.delete(normalized)
          return next
        })
      }
    } catch (e) {
      console.error('Resume error:', e)
    } finally {
      setResuming(null)
    }
  }

  // ── AI summary ──
  async function handleSummarize() {
    if (!selected || summarizing) return
    setSummarizing(true)
    setSummary(null)
    try {
      const res = await fetch(`${API_URL}/session/summary`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          session_id: selected.session_id,
          client_id:  botClientId || 'dental_demo',
        })
      })
      const data = await res.json()
      setSummary(data.summary || 'No summary available.')
    } catch (e) {
      setSummary('Failed to generate summary. Please try again.')
    } finally {
      setSummarizing(false)
    }
  }

  // ── Owner reply ──
  async function handleSend() {
    if (!replyText.trim() || !selected || sending) return
    const msgText = replyText.trim()
    setReplyText('')
    setSending(true)

    // Optimistic insert
    const optimisticMsg = {
      id:             `opt_${Date.now()}`,
      session_id:     selected.session_id,
      phone_number:   selected.phone,
      role:           'owner',
      message:        msgText,
      session_status: 'Handed Off',
      created_at:     new Date().toISOString(),
    }
    setLiveMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch(`${API_URL}/session/send`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify({
          session_id: normalizePhone(selected.phone),
          message:    msgText,
          client_id:  botClientId || 'dental_demo',
        })
      })
      if (!res.ok) {
        // Rollback optimistic message on failure
        setLiveMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
        console.error('Send failed:', await res.text())
      }
    } catch (e) {
      setLiveMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      console.error('Send error:', e)
    } finally {
      setSending(false)
    }
  }

  const filtered = threads.filter(t => {
    const q = search.toLowerCase()
    if (!q) return true
    return t.phone.toLowerCase().includes(q) || t.messages.some(m => m.message?.toLowerCase().includes(q))
  })

  if (loading) return <ConversationsSkeleton />

  const selectedStatus = selected ? getStatus(selected) : null
  const isHandedOff    = selectedStatus === 'Handed Off'

  return (
    <div className="flex h-full overflow-hidden text-white">
      {/* ── Thread list ── */}
      <div className="w-72 shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.015]">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[13px] font-semibold text-white">All Conversations</h1>
            <span className="text-[11px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{filtered.length}</span>
          </div>
          <input
            type="text"
            placeholder="Search phone or message…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white placeholder-white/25 outline-none focus:border-[#00e5b0]/40 transition-colors"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-white/20 text-xs p-4">No conversations found.</p>
          )}
          {filtered.map(thread => {
            const liveStatus = getStatus(thread)
            return (
              <button
                key={thread.session_id}
                onClick={() => { setSelected(thread); setLiveMessages(thread.messages) }}
                className={`w-full text-left px-4 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
                  selected?.session_id === thread.session_id
                    ? 'bg-[#00e5b0]/[0.05] border-l-2 border-l-[#00e5b0]/50'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-[12.5px] font-medium text-white leading-tight">{maskPhone(thread.phone)}</span>
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
                  <p className="text-[13.5px] font-semibold text-white">{maskPhone(selected.phone)}</p>
                  <p className="text-[12px] text-white/30 mt-0.5">
                    {liveMessages.length} messages · Last active {formatTimestamp(selected.lastAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedStatus} />

                  {/* Summarize button — always shown when there are messages */}
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
                        <>
                          <span className="w-3 h-3 border border-white/40 border-t-white/70 rounded-full animate-spin" />
                          Summarizing…
                        </>
                      ) : (
                        <>✦ Summary</>
                      )}
                    </button>
                  )}

                  {isHandedOff && (
                    <button
                      onClick={() => handleResume(selected)}
                      disabled={resuming === normalizePhone(selected.phone)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium
                                 bg-[#00e5b0]/10 text-[#00e5b0] border border-[#00e5b0]/25
                                 hover:bg-[#00e5b0]/20 transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resuming === normalizePhone(selected.phone) ? (
                        <>
                          <span className="w-3 h-3 border border-[#00e5b0]/60 border-t-[#00e5b0] rounded-full animate-spin" />
                          Resuming…
                        </>
                      ) : (
                        <>🤖 Resume Bot</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* AI Summary panel — shown after clicking Summarize */}
              {summary && (
                <div className="mx-6 mb-4 bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 flex gap-3">
                  <span className="text-[#00e5b0] text-[14px] shrink-0 mt-0.5">✦</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#00e5b0] font-semibold uppercase tracking-wider mb-1.5">AI Summary</p>
                    <p className="text-[12.5px] text-white/70 leading-relaxed">{summary}</p>
                  </div>
                  <button
                    onClick={() => setSummary(null)}
                    className="text-white/20 hover:text-white/50 transition-colors shrink-0 self-start"
                  >
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
                const role = msg.role // 'customer' | 'bot' | 'owner'
                const isCustomer = role === 'customer'
                const isOwner    = role === 'owner'
                const isBot      = role === 'bot'

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
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-[10.5px] mt-1.5 ${isCustomer ? 'text-white/40' : 'text-white/25'}`}>
                        {isCustomer ? 'Customer' : isOwner ? 'Owner' : 'Bot'} · {formatTimestamp(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}

              {isHandedOff && (
                <div className="flex justify-center py-2">
                  <span className="text-[11px] text-amber-400/60 bg-amber-500/5 border border-amber-500/10 px-3 py-1 rounded-full">
                    ⏸ Human handling this conversation
                  </span>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>

            {/* ── Reply box — only shown during handoff ── */}
            {isHandedOff && (
              <div className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder="Reply as owner… (Enter to send, Shift+Enter for newline)"
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
                    ) : (
                      'Send'
                    )}
                  </button>
                </div>
                <p className="text-[10.5px] text-white/20 mt-1.5 px-1">
                  Messages send from the bot's WhatsApp number · Resume Bot to hand back to AI
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
