'use client'

import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV = [
  { label: 'Dashboard',     href: '/dashboard'    },
  { label: 'Conversations', href: '/conversations' },
  { label: 'Leads',         href: '/leads'         },
  { label: 'Bookings',      href: '/bookings'      },
  { label: 'Team',          href: '/team'          },
  { label: 'Settings',      href: '/settings'      },
]

export default function Sidebar({ userEmail }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="nav-label">Menu</div>
      </div>
      <nav>
        {NAV.map(item => (
          
            <a
            key={item.href}
            href={item.href}
            className={'nav-item' + (pathname === item.href ? ' active' : '')}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button className="logout-btn" onClick={handleLogout}>Sign out</button>
      </div>
    </aside>
  )
}
