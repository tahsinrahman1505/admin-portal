'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const TYPE_META = {
  handoff:        { icon: '🤝', color: '#f59e0b', label: 'Handoff',     desc: 'Patient needs human assistance' },
  lead:           { icon: '🎯', color: '#60a5fa', label: 'New Lead',     desc: 'New lead captured'              },
  booking:        { icon: '📅', color: '#00e5b0', label: 'Booking',      desc: 'Appointment confirmed'          },
  message:        { icon: '💬', color: '#00e5b0', label: 'Message',      desc: 'New message received'           },
  // System/delivery alert — outbound message failed for a reason the team must fix
  // (expired token, config, etc.). Emitted by the backend delivery classifier.
  system_error:   { icon: '⚠️', color: '#ef4444', label: 'System Alert', desc: 'Delivery/system issue — needs attention' },
  // Roadmap (Patient Rescue): mapped now so they are never mislabeled when emitted.
  at_risk:        { icon: '🔔', color: '#f59e0b', label: 'At Risk',      desc: 'Patient may be slipping away'    },
  low_confidence: { icon: '❓', color: '#60a5fa', label: 'Low Confidence', desc: 'Bot was unsure — review'       },
}

function timeAgo(ts) {
  const diff = (Date.now() - new Date(ts)) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function NotificationBell({ clientId }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen]                   = useState(false)
  const [pushEnabled, setPushEnabled]     = useState(false)
  const dropRef = useRef(null)
  const realtimeRef = useRef(null)

  const unread = notifications.filter(n => !n.read).length

  // ── Load notifications ──────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!clientId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setNotifications(data)
  }, [clientId])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  // ── Realtime: new notifications ─────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)

    const ch = supabase
      .channel('notifications-bell')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `client_id=eq.${clientId}`,
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 30))
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `client_id=eq.${clientId}`,
      }, (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n))
      })
      .subscribe()

    realtimeRef.current = ch
    return () => supabase.removeChannel(ch)
  }, [clientId])

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    function handle(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Check push status ───────────────────────────────────────────────────────
  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
    }
  }, [])

  // ── Enable push notifications ───────────────────────────────────────────────
  async function enablePush() {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push notifications are not supported in this browser.')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) await existing.unsubscribe()

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, client_id: clientId }),
      })

      setPushEnabled(true)
    } catch (e) {
      console.error('Push enable error:', e)
    }
  }

  // ── Mark one as read ────────────────────────────────────────────────────────
  async function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  // ── Mark all read ───────────────────────────────────────────────────────────
  async function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications')
      .update({ read: true })
      .eq('client_id', clientId)
      .eq('read', false)
  }

  return (
    <div className="relative" ref={dropRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-xl text-white/30 hover:text-white/70 hover:bg-white/[0.05] transition-all duration-150"
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#f59e0b] text-[#080808] text-[9px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="glass-overlay sheen absolute left-0 top-10 w-80 rounded-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-[13px] font-semibold text-white">Notifications</span>
            <div className="flex items-center gap-2">
              {!pushEnabled && (
                <button
                  onClick={enablePush}
                  className="text-[10.5px] text-[#00e5b0]/70 hover:text-[#00e5b0] transition-colors flex items-center gap-1"
                  title="Enable browser push notifications"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-3 h-3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.143 17.082a24.248 24.248 0 003.844.148m-3.844-.148a23.856 23.856 0 01-5.455-1.31 8.964 8.964 0 002.3-5.542m3.155 6.852a3 3 0 005.667 1.97M4.9 15.772l-.7-9.131m0 0A8.963 8.963 0 0112 3c4.456 0 8.167 3.148 8.8 7.272m-8.8-7.272c-.413.01-.823.04-1.228.086M4.2 6.641l.7 9.131m0 0l.097 1.248"/>
                  </svg>
                  Enable push
                </button>
              )}
              {pushEnabled && (
                <span className="text-[10.5px] text-[#00e5b0]/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e5b0] animate-pulse" />
                  Push on
                </span>
              )}
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10.5px] text-white/30 hover:text-white/60 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="w-8 h-8 text-white/10">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"/>
                </svg>
                <p className="text-[12px] text-white/20">No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.message
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors ${!n.read ? 'bg-white/[0.02]' : ''}`}
                  >
                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-[14px]"
                      style={{ background: `${meta.color}15` }}
                    >
                      {meta.icon}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12.5px] font-semibold text-white/80 truncate">{n.title}</p>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.color }} />
                        )}
                      </div>
                      <p className="text-[11.5px] text-white/35 mt-0.5 truncate">{n.body}</p>
                      <p className="text-[10.5px] text-white/20 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/[0.06]">
              <p className="text-[10.5px] text-white/20 text-center">
                Showing last 30 notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── VAPID key helper ──────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
