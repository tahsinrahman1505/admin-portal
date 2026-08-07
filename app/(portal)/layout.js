'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import RealtimeToast from '@/components/RealtimeToast'
import NotificationBell from '@/components/NotificationBell'
import AuroraBackground from '@/components/AuroraBackground'
import CommandPalette from '@/components/CommandPalette'
import ThemeToggle from '@/components/ThemeToggle'

/* Nav row with a shared-layout active pill: the highlight physically slides
   from the old item to the new one on navigation (layoutId), instead of just
   toggling. Small detail, big "this was designed" signal. */
function NavItem({ item, active }) {
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] transition-colors duration-200 ${
        active ? 'text-[#00e5b0]' : 'text-[var(--ink-2)] hover:text-[var(--ink-1)]'
      }`}
      style={{ fontFamily: 'var(--font-jakarta)' }}
    >
      {active && (
        <motion.span
          layoutId="nav-active-pill"
          className="absolute inset-0 rounded-xl"
          style={{ background: 'var(--accent-soft)', boxShadow: 'inset 0 1px 0 0 rgba(0,229,176,0.20)' }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        />
      )}
      <span className={`relative z-10 transition-colors duration-200 ${active ? 'text-[#00e5b0]' : 'text-[var(--ink-3)] group-hover:text-[var(--ink-2)]'}`}>
        {item.icon}
      </span>
      <span className="relative z-10">{item.label}</span>
      {active && <span className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-[#00e5b0] shadow-[0_0_8px_rgba(0,229,176,0.8)]" />}
    </Link>
  )
}

const NAV = [
  {
    label: 'Copilot', href: '/copilot',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></svg>,
  },
  {
    label: 'Dashboard', href: '/dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  },
  {
    label: 'Conversations', href: '/conversations',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/></svg>,
  },
  {
    label: 'Leads', href: '/leads',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>,
  },
  {
    label: 'Bookings', href: '/bookings',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg>,
  },
  {
    label: 'Patients', href: '/patients',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"/></svg>,
  },
  {
    label: 'Recall', href: '/recall',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>,
  },
  {
    label: 'Analytics', href: '/analytics',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/></svg>,
  },
  {
    label: 'Activity', href: '/activity',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>,
  },
  {
    label: 'Knowledge Base', href: '/knowledge-base',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>,
  },
  {
    label: 'Channels', href: '/channels',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>,
  },
  {
    label: 'Team', href: '/team',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>,
  },
  {
    label: 'Settings', href: '/settings',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  },
]

export default function PortalLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')
  const [clientId, setClientId]   = useState(null)

  useEffect(() => {
    // Register service worker for push notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email)

      // Fetch client row to get ID for notifications
      const { data: clientRow } = await supabase
        .from('clients').select('id').eq('user_id', user.id).single()
      if (clientRow) setClientId(clientRow.id)
    })

    // Keep the sb-portal-session cookie in sync with the Supabase session.
    // supabase-js silently refreshes the access token before it expires — we
    // mirror the new token into the cookie so Edge middleware stays valid.
    // INITIAL_SESSION is critical: it fires when supabase restores a session
    // from localStorage on page load. Without it, a lapsed cookie is never
    // re-written, so the next navigation hits middleware with no cookie and
    // gets bounced to /login even though the user is still authenticated.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && session?.access_token) {
        document.cookie = `sb-portal-session=${session.access_token}; path=/; max-age=3600; SameSite=Lax; Secure`
      }
      if (event === 'SIGNED_OUT') {
        document.cookie = 'sb-portal-session=; path=/; max-age=0; SameSite=Lax; Secure'
        router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Global Realtime: create notification rows on handoff / new lead ─────────
  useEffect(() => {
    if (!clientId) return

    const ch = supabase.channel('portal-global-watcher')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'conversations',
        filter: `client_id=eq.${clientId}`,
      }, async (payload) => {
        const row = payload.new
        // Only notify on handoff messages
        if (!row.message?.toLowerCase().includes('handoff') &&
            row.session_status !== 'Handed Off') return

        const chLabel = row.channel === 'instagram' ? 'Instagram DM'
          : row.channel === 'messenger' ? 'Messenger' : 'WhatsApp'

        // Insert notification row
        await supabase.from('notifications').insert({
          client_id: clientId,
          type:      'handoff',
          title:     '🤝 Patient needs help',
          body:      `Handoff on ${chLabel} — ${row.message?.slice(0, 60) || 'Patient requested a human'}`,
          read:      false,
        })

        // Fire browser push to all subscriptions for this client
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            title:     '🤝 Handoff — patient needs you',
            body:      `${chLabel}: ${row.message?.slice(0, 80) || 'Patient requested a human'}`,
            url:       '/conversations',
            urgent:    true,
            tag:       'handoff',
          }),
        }).catch(() => {})
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'leads',
        filter: `client_id=eq.${clientId}`,
      }, async (payload) => {
        const row = payload.new
        const chLabel = row.channel === 'instagram' ? 'Instagram DM'
          : row.channel === 'messenger' ? 'Messenger' : 'WhatsApp'

        await supabase.from('notifications').insert({
          client_id: clientId,
          type:      'lead',
          title:     '🎯 New lead captured',
          body:      `${row.name || 'New patient'} via ${chLabel}`,
          read:      false,
        })

        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            title:     '🎯 New lead',
            body:      `${row.name || 'New patient'} via ${chLabel}`,
            url:       '/leads',
            tag:       'lead',
          }),
        }).catch(() => {})
      })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [clientId])

  async function handleLogout() {
    await supabase.auth.signOut()
    // Cookie is cleared automatically by the onAuthStateChange SIGNED_OUT handler above.
    router.push('/login')
  }

  const GROUPS = [
    { label: 'Main', items: NAV.slice(0, 5) },      // Copilot, Dashboard, Conversations, Leads, Bookings
    { label: 'Insights', items: NAV.slice(5, 9) },  // Patients, Recall, Analytics, Activity
    { label: 'Config', items: NAV.slice(9) },       // Knowledge Base, Channels, Team, Settings
  ]

  return (
    <>
      <AuroraBackground />
      <CommandPalette />
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar — floating glass rail */}
        <aside className="w-[236px] shrink-0 p-3">
          {/* No overflow-hidden here: the notification dropdown (rendered inside
              this rail) must be able to extend past the sidebar edge. The rail's
              own glass bg/border already respect the border-radius, and all inner
              content is inset by padding, so the rounded corners stay clean. */}
          <div className="glass sheen rounded-[var(--r-lg)] h-full flex flex-col">
            {/* Logo */}
            <div className="px-4 pt-6 pb-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[11px] flex items-center justify-center shrink-0"
                       style={{ background: 'linear-gradient(135deg, rgba(0,229,176,0.22), rgba(124,92,255,0.18))', border: '1px solid rgba(0,229,176,0.3)', boxShadow: '0 0 20px rgba(0,229,176,0.18)' }}>
                    <span className="text-[#00e5b0] text-[12px] font-extrabold" style={{ fontFamily: 'var(--font-jakarta)' }}>T</span>
                  </div>
                  <span className="text-[var(--ink-1)] font-extrabold text-[15px] tracking-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    Tahsin<span className="text-[#00e5b0]">.</span>ai
                  </span>
                </div>
                <NotificationBell clientId={clientId} />
              </div>
              <p className="text-[var(--ink-3)] text-[10.5px] mt-2 ml-[2px] tracking-wide" style={{ fontFamily: 'var(--font-jakarta)' }}>
                Client Portal
              </p>
            </div>

            {/* ⌘K trigger — dispatches the same hotkey the palette listens for */}
            <div className="px-3 pb-3">
              <button
                onClick={() => {
                  const isMac = navigator.platform.toUpperCase().includes('MAC')
                  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac, bubbles: true }))
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[var(--ink-3)] hover:text-[var(--ink-1)] hover:border-white/[0.12] transition-colors duration-200"
                style={{ fontFamily: 'var(--font-jakarta)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-3.5 h-3.5 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <span className="text-[12.5px]">Search…</span>
                <kbd className="ml-auto text-[10px] border border-white/[0.12] rounded px-1.5 py-0.5 tnum">⌘K</kbd>
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 overflow-y-auto space-y-0.5 pb-2">
              {GROUPS.map((group, gi) => (
                <div key={group.label}>
                  <p className={`text-[10px] font-semibold text-[var(--ink-4)] uppercase tracking-[0.14em] px-3 mb-2 ${gi > 0 ? 'pt-4' : ''}`} style={{ fontFamily: 'var(--font-jakarta)' }}>
                    {group.label}
                  </p>
                  {group.items.map(item => (
                    <NavItem key={item.href} item={item} active={pathname === item.href} />
                  ))}
                </div>
              ))}
            </nav>

            {/* Bottom */}
            <div className="px-3 pb-4 pt-4 mx-3 border-t border-white/[0.06]">
              <p className="text-[11px] text-[var(--ink-3)] px-1 mb-2.5 truncate" style={{ fontFamily: 'var(--font-jakarta)' }}>
                {userEmail}
              </p>
              <div className="mb-1"><ThemeToggle /></div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-[var(--ink-2)] hover:text-red-400 hover:bg-red-400/[0.08] transition-all duration-200"
                style={{ fontFamily: 'var(--font-jakarta)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>

        {/* Global realtime toast */}
        <RealtimeToast />
      </div>
    </>
  )
}
