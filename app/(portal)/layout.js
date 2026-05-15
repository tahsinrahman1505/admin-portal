'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV = [
  { label: 'Dashboard',     href: '/dashboard',    icon: '🏠' },
  { label: 'Conversations', href: '/conversations', icon: '💬' },
  { label: 'Leads',         href: '/leads',         icon: '🎯' },
  { label: 'Bookings',      href: '/bookings',      icon: '📅' },
  { label: 'Settings',      href: '/settings',      icon: '⚙' },
  { label: 'Knowledge Base', href: '/knowledge-base', icon: '📚' },
]

export default function PortalLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email)
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <style>{`
        .portal-root { display: flex; height: 100vh; background: #0a0a0a; color: white; overflow: hidden; }
        .portal-sidebar {
          position: relative;
          width: 220px;
          background: rgba(255,255,255,0.02);
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 32px 20px;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .portal-sidebar .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 48px; }
        .portal-sidebar .brand-dot { width: 10px; height: 10px; background: #4f6ef7; border-radius: 50%; box-shadow: 0 0 12px #4f6ef7; flex-shrink: 0; }
        .portal-sidebar .brand-name { font-size: 15px; font-weight: 600; color: white; letter-spacing: -0.3px; }
        .nav-label { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; padding: 0 12px; }
        .nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          font-size: 14px; color: rgba(255,255,255,0.5);
          cursor: pointer; text-decoration: none;
          transition: all 0.15s ease; margin-bottom: 2px;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.8); }
        .nav-item.active { background: rgba(79,110,247,0.12); color: #4f6ef7; }
        .nav-icon { font-size: 16px; }
        .portal-sidebar .sidebar-bottom { margin-top: auto; }
        .logout-btn {
          width: 100%; padding: 10px 12px; border-radius: 10px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer;
          display: flex; align-items: center; gap: 8px; transition: all 0.15s;
        }
        .logout-btn:hover { background: rgba(255,50,50,0.1); border-color: rgba(255,50,50,0.2); color: #ff6b6b; }
        .user-email { font-size: 11px; color: rgba(255,255,255,0.25); margin-bottom: 12px; padding: 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .portal-main { flex: 1; overflow: auto; }
      `}</style>
      <div className="portal-root">
        <aside className="portal-sidebar">
          <div className="brand">
            <div className="brand-dot"></div>
            <span className="brand-name">Dental Portal</span>
          </div>
          <div className="nav-label">Menu</div>
          <nav>
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={'nav-item' + (pathname === item.href ? ' active' : '')}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="user-email">{userEmail}</div>
            <button className="logout-btn" onClick={handleLogout}>
              <span>Sign out</span>
            </button>
          </div>
        </aside>
        <main className="portal-main">
          {children}
        </main>
      </div>
    </>
  )
}
