'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ConversationsSkeleton } from '@/components/Skeleton'

function maskPhone(phone) {
  if (!phone) return 'Unknown'
  return phone.slice(0, -6) + '***-**' + phone.slice(-2)
}

function formatTimestamp(ts) {
  const date = new Date(ts)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ', ' + date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
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
  const [threads, setThreads]   = useState([])
  const [selected, setSelected] = useState(null)
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: clientRow } = await supabase.from('clients').select('id').eq('user_id', user.id).single()
      if (!clientRow) { setLoading(false); return }

      const { data: rows } = await supabase
        .from('conversations').select('*').eq('client_id', clientRow.id).order('created_at', { ascending: true })

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
        status:       messages[0]?.session_status || 'Handled by Bot',
        firstMessage: messages.find(m => m.role === 'customer')?.message || messages[0]?.message,
        lastAt:       messages[messages.length - 1]?.created_at,
        messages,
      })).sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))

      setThreads(threadList)
      if (threadList.length > 0) setSelected(threadList[0])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = threads.filter(t => {
    const q = search.toLowerCase()
    if (!q) return true
    return t.phone.toLowerCase().includes(q) || t.messages.some(m => m.message?.toLowerCase().includes(q))
  })

  if (loading) return <ConversationsSkeleton />

  return (
    <div className="flex h-full overflow-hidden text-white">
      {/* Thread list */}
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
          {filtered.map(thread => (
            <button
              key={thread.session_id}
              onClick={() => setSelected(thread)}
              className={`w-full text-left px-4 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${
                selected?.session_id === thread.session_id
                  ? 'bg-[#00e5b0]/[0.05] border-l-2 border-l-[#00e5b0]/50'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-[12.5px] font-medium text-white leading-tight">{maskPhone(thread.phone)}</span>
                <StatusBadge status={thread.status} />
              </div>
              <p className="text-[12px] text-white/35 truncate">{thread.firstMessage}</p>
              <p className="text-[11px] text-white/20 mt-1">{formatTimestamp(thread.lastAt)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080808]">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-white/20 text-sm">
            Select a conversation to view
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
              <div>
                <p className="text-[13.5px] font-semibold text-white">{maskPhone(selected.phone)}</p>
                <p className="text-[12px] text-white/30 mt-0.5">
                  {selected.messages.length} messages · Last active {formatTimestamp(selected.lastAt)}
                </p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {selected.messages.map((msg, i) => {
                const isBot = msg.role === 'bot'
                return (
                  <div key={i} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[62%] rounded-2xl px-4 py-2.5 ${
                      isBot
                        ? 'bg-white/[0.05] border border-white/[0.07] text-white/80 rounded-tl-sm'
                        : 'bg-[#005c4b] text-white rounded-tr-sm'
                    }`}>
                      {isBot && (
                        <p className="text-[10px] text-[#00e5b0] font-semibold uppercase tracking-wider mb-1">Tahsin.ai</p>
                      )}
                      <p className="text-[13px] leading-relaxed">{msg.message}</p>
                      <p className={`text-[10.5px] mt-1.5 ${isBot ? 'text-white/25' : 'text-white/40'}`}>
                        {isBot ? 'Bot' : 'Customer'} · {formatTimestamp(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
