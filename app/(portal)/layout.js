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
import { NAV_GROUPS } from '@/lib/nav'

/* Nav row with a shared-layout active pill: the highlight physically slides
   from the old item to the new one on navigation (layoutId), instead of just
   toggling. Small detail, big "this was designed" signal. */
function NavItem({ item, active }) {
  const soon = item.status === 'soon'
  return (
    <Link
      href={item.href}
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] transition-colors duration-200 ${
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
      {/* Routed but not yet built — see lib/nav.js. Keeps the IA stable so later
          phases only flip the flag instead of reshuffling the sidebar again. */}
      {soon && !active && (
        <span
          className="relative z-10 ml-auto text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: 'var(--ink-3)', background: 'var(--glass-bg-strong)' }}
        >
          Soon
        </span>
      )}
      {active && <span className="relative z-10 ml-auto w-1.5 h-1.5 rounded-full bg-[#00e5b0] shadow-[0_0_8px_rgba(0,229,176,0.8)]" />}
    </Link>
  )
}


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
  }, [router])

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

            {/* Nav
                Six groups / sixteen destinations do not fit a laptop-height rail,
                so this scrolls. Two details make that read as intentional rather
                than broken: the spacing is tightened (it fits without scrolling
                from ~1000px tall, which covers most desktops), and a mask fades
                the last few pixels so a half-cut row visibly continues instead of
                looking clipped. The fade is a mask, not an overlay, so it can't
                intercept clicks on the row beneath it. */}
            <div className="relative flex-1 min-h-0">
              <nav
                className="h-full px-3 overflow-y-auto space-y-0.5 pb-3"
                style={{
                  maskImage: 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, black calc(100% - 20px), transparent 100%)',
                }}
              >
                {NAV_GROUPS.map((group, gi) => (
                  <div key={group.label}>
                    <p className={`text-[10px] font-semibold text-[var(--ink-4)] uppercase tracking-[0.14em] px-3 mb-1 ${gi > 0 ? 'pt-3' : ''}`} style={{ fontFamily: 'var(--font-jakarta)' }}>
                      {group.label}
                    </p>
                    {group.items.map(item => (
                      <NavItem key={item.href} item={item} active={pathname === item.href} />
                    ))}
                  </div>
                ))}
              </nav>
            </div>

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
