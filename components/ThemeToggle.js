'use client'

import { useEffect, useState } from 'react'

/**
 * Light/dark switch for the portal.
 *
 * The theme itself is applied by setting data-theme on <html>; globals.css does
 * the rest by redefining --color-white (see the theming note there). The initial
 * value is written by the inline no-flash script in app/layout.js BEFORE paint,
 * so here we only read what's already on the element — never assume a default, or
 * the button would show the wrong icon for one frame on a light-mode reload.
 */
export default function ThemeToggle({ collapsed = false }) {
  const [theme, setTheme] = useState(null)

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
  }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('portal-theme', next) } catch { /* private mode — session-only */ }
  }

  // Render nothing until we've read the real theme, so the icon never flips.
  if (!theme) return <div className="h-9" aria-hidden="true" />

  const isLight = theme === 'light'
  return (
    <button
      onClick={toggle}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/45 hover:text-white/80 hover:bg-white/[0.04] transition-colors text-[12.5px]"
    >
      {isLight ? (
        // moon → clicking goes dark
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[17px] h-[17px] shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        // sun → clicking goes light
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[17px] h-[17px] shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
      {!collapsed && <span>{isLight ? 'Dark mode' : 'Light mode'}</span>}
    </button>
  )
}
