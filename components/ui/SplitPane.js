'use client'

/**
 * SplitPane — two children: [content, resizable pane]. `side` says which
 * edge of the pane the drag handle sits on: 'right' means the pane is on the
 * right and the handle is its LEFT edge (dragging left grows the pane);
 * 'left' means the pane is on the left and the handle is its RIGHT edge
 * (dragging right grows the pane). Width persists to localStorage under
 * `storageKey`, guarded for SSR since Next renders this on the server first
 * where `window` doesn't exist. Clamped to [min, max] on load, drag, and
 * keyboard nudge alike so a stale/corrupt stored value can't escape range.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

export default function SplitPane({ storageKey, defaultWidth, min = 240, max = 560, side = 'right', children }) {
  const [content, pane] = Array.isArray(children) ? children : [children, null]
  const clamp = useCallback((w) => Math.min(max, Math.max(min, w)), [min, max])
  const [width, setWidth] = useState(() => clamp(defaultWidth))
  const draggingRef = useRef(false)

  // Read the persisted width once on mount (client-only — SSR has no window/localStorage).
  // Can't do this in the useState initializer instead: that runs during SSR/hydration
  // too, where window is unavailable, and seeding it only on the client would cause a
  // hydration mismatch against the server-rendered defaultWidth. Reading post-mount in
  // an effect is the correct escape hatch for this "sync from an external store on
  // mount" case, even though it does mean one setState call in the effect body.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = window.localStorage.getItem(storageKey)
      if (stored != null) {
        const n = parseInt(stored, 10)
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a persisted value on mount, not a render-cascade risk
        if (!Number.isNaN(n)) setWidth(clamp(n))
      }
    } catch {
      /* private mode / storage disabled — fall back to defaultWidth for this session */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only ever re-read on storageKey change
  }, [storageKey])

  const persist = useCallback(
    (w) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(storageKey, String(w))
      } catch {
        /* private mode / storage disabled — width just won't survive reload */
      }
    },
    [storageKey]
  )

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault()
      draggingRef.current = true
      const startX = e.clientX
      const startWidth = width

      const onMove = (ev) => {
        if (!draggingRef.current) return
        const delta = side === 'right' ? startX - ev.clientX : ev.clientX - startX
        setWidth(clamp(startWidth + delta))
      }
      const onUp = () => {
        draggingRef.current = false
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setWidth((w) => {
          persist(w)
          return w
        })
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [width, side, clamp, persist]
  )

  const onKeyDown = useCallback(
    (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      const dir = e.key === 'ArrowRight' ? 1 : -1
      const sign = side === 'right' ? -dir : dir
      setWidth((w) => {
        const next = clamp(w + sign * 16)
        persist(next)
        return next
      })
    },
    [side, clamp, persist]
  )

  const handle = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="shrink-0 w-1.5 cursor-col-resize relative group"
      style={{ touchAction: 'none' }}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/[0.07] group-hover:bg-[var(--accent)] transition-colors" />
    </div>
  )

  return (
    <div className="flex h-full min-w-0">
      {side === 'right' ? (
        <>
          <div className="flex-1 min-w-0 overflow-hidden">{content}</div>
          {handle}
          <div className="shrink-0 h-full overflow-hidden" style={{ width }}>
            {pane}
          </div>
        </>
      ) : (
        <>
          <div className="shrink-0 h-full overflow-hidden" style={{ width }}>
            {pane}
          </div>
          {handle}
          <div className="flex-1 min-w-0 overflow-hidden">{content}</div>
        </>
      )}
    </div>
  )
}
