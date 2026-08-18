'use client'

/**
 * Drawer — right-anchored slide-over with a dimmed, dismissible backdrop.
 * Content-agnostic (caller supplies `children`); mirrors CommandPalette's
 * overlay mechanics (backdrop mousedown-to-close, Esc-to-close, stopPropagation
 * on the panel) so the portal has one consistent overlay feel rather than a
 * second hand-rolled one.
 *
 * Built for panes that are hard-hidden below a width breakpoint (e.g. the 3-pane
 * inbox's context rail below 2xl) — the caller keeps its fixed-width pane at the
 * wide breakpoint untouched and mounts this only as the narrow-viewport substitute,
 * gated by a trigger button of its own visible only below that same breakpoint.
 */

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Drawer({ open, onClose, children, width = 380, label = 'Panel' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <div className="absolute inset-0" style={{ background: 'rgba(4,6,9,0.5)', backdropFilter: 'blur(6px)' }} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="relative h-full shrink-0 p-3"
            style={{ width }}
            initial={{ x: '100%' }}
            animate={{ x: 0, transition: { type: 'spring', stiffness: 320, damping: 30 } }}
            exit={{ x: '100%', transition: { duration: 0.18 } }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
