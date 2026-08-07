'use client'

import { motion } from 'framer-motion'

/**
 * Placeholder for a destination that is routed but not yet built.
 *
 * These exist so the information architecture is settled in Phase 0 and stays
 * put: later phases fill the page in rather than reshuffling the sidebar under
 * people who have already learned where things live. Each one names the phase
 * that will build it, so a visitor is told what's coming rather than hitting a
 * dead end.
 */
export default function ComingSoon({ title, description, bullets = [] }) {
  return (
    <div className="p-6 sm:p-8 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <h1
            className="text-[1.6rem] font-extrabold tracking-tight text-[var(--ink-1)]"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            {title}
          </h1>
          <span
            className="text-[9.5px] font-semibold uppercase tracking-wider px-2 py-1 rounded"
            style={{ color: 'var(--ink-3)', background: 'var(--glass-bg-strong)' }}
          >
            Soon
          </span>
        </div>

        <p className="text-[13.5px] leading-relaxed text-[var(--ink-2)] max-w-xl">
          {description}
        </p>

        {bullets.length > 0 && (
          <div className="glass sheen rounded-[var(--r-md)] relative mt-6 p-5">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-4)] mb-3"
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              What this will do
            </p>
            <ul className="space-y-2.5">
              {bullets.map(b => (
                <li key={b} className="flex items-start gap-2.5 text-[13px] text-[var(--ink-2)]">
                  <span
                    className="mt-[7px] w-1 h-1 rounded-full shrink-0"
                    style={{ background: 'var(--accent)' }}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    </div>
  )
}
