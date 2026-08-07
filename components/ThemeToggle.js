'use client'

import { useEffect, useState } from 'react'

/**
 * Aurora Glass light/dark switch. The theme is applied by data-theme on <html>;
 * globals.css re-tunes every token from there (see the LIGHT THEME block). The
 * initial value is stamped by public/theme-init.js before paint, so here we only
 * READ what's already on the element — never assume a default, or the icon would
 * flash the wrong glyph for a frame on a light-mode reload.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the DOM-stamped theme on mount, not a render-cascade risk; can't live in the useState initializer (SSR has no `document`, and theme-init.js only stamps the attribute pre-paint on the client)
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
  }, [])

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('portal-theme', next) } catch { /* private mode — session only */ }
  }

  if (!theme) return <div className="h-9" aria-hidden="true" />

  const isLight = theme === 'light'
  return (
    <button
      onClick={toggle}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[var(--ink-2)] hover:text-[var(--ink-1)] hover:bg-white/[0.05] transition-colors duration-200 text-[12.5px]"
      style={{ fontFamily: 'var(--font-jakarta)' }}
    >
      {isLight ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[17px] h-[17px] shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[17px] h-[17px] shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      )}
      <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
    </button>
  )
}
