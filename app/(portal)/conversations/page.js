'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'


function maskPhone(phone) {
  if (!phone) return 'Unknown'
  return phone.slice(0, -6) + '***-**' + phone.slice(-2)
}

function formatTimestamp(ts) {
  const date = new Date(ts)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short'
  }) + ', ' + date.toLocaleTimeString('en-GB', {
    hour: 'numeric', minute: '2-digit', hour12: true
  })
}

function StatusBadge({ status }) {
  const styles = {
    'Handled by Bot': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    'Handed Off':     'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    'Pending':        'bg-red-500/10 text-red-400 border border-red-500/20',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || 'bg-white/5 text-gray-400'}`}>
      {status || 'Unknown'}
    </span>
  )
}

const NAV = [
  { label: 'Dashboard',     href: '/dashboard',    icon: '[D]' },
  { label: 'Conversations', href: '/conversations', icon: '[C]' },
  { label: 'Leads',         href: '/leads',         icon: '[L]' },
  { label: 'Settings',      href: '/settings',      icon: '[S]' },
]

export default function ConversationsPage() {
  const router = useRouter()
  const [threads, setThreads]     = useState([])
  const [selected, setSelected]   = useState(null)
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email)

      const { data: clientRow } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!clientRow) { setLoading(false); return }

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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filtered = threads.filter(t => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      t.phone.toLowerCase().includes(q) ||
      t.messages.some(m => m.message?.toLowerCase().includes(q))
    )
  })

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0a] text-gray-500 text-sm">
      Loading conversations...
    </div>
  )

  return (
    <div className="flex h-full text-white overflow-hidden">

      {/* Sidebar */}

      {/* Thread list */}
      <div className="w-72 bg-[#111111] border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-semibold text-white">All Conversations</h1>
            <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
              {filtered.length}
            </span>
          </div>
          <input
            type="text"
            placeholder="Search phone or message..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-gray-600 text-xs p-4">No conversations found.</p>
          )}
          {filtered.map(thread => (
            <button
              key={thread.session_id}
              onClick={() => setSelected(thread)}
              className={
                'w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ' +
                (selected?.session_id === thread.session_id
                  ? 'bg-white/[0.06] border-l-2 border-l-white/30'
                  : '')
              }
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-white leading-tight">
                  {maskPhone(thread.phone)}
                </span>
                <StatusBadge status={thread.status} />
              </div>
              <p className="text-xs text-gray-500 truncate leading-relaxed">{thread.firstMessage}</p>
              <p className="text-xs text-gray-700 mt-1">{formatTimestamp(thread.lastAt)}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0a]">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Select a conversation to view
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-white/[0.06] bg-[#111111] flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{maskPhone(selected.phone)}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selected.messages.length} messages · Last active {formatTimestamp(selected.lastAt)}
                </p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {selected.messages.map((msg, i) => {
                const isBot = msg.role === 'bot'
                return (
                  <div key={i} className={'flex ' + (isBot ? 'justify-start' : 'justify-end')}>
                    <div className={
                      'max-w-[60%] rounded-2xl px-4 py-2.5 ' +
                      (isBot
                        ? 'bg-[#1e1e1e] border border-white/[0.06] text-gray-100 rounded-tl-sm'
                        : 'bg-blue-600 text-white rounded-tr-sm')
                    }>
                      <p className="text-sm leading-relaxed">{msg.message}</p>
                      <p className={'text-xs mt-1.5 ' + (isBot ? 'text-gray-600' : 'text-blue-300')}>
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