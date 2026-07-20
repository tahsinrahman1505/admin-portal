'use client'

import { motion } from 'framer-motion'
import { rise, spring } from '@/lib/motion'

/**
 * Aurora Glass primitives. Everything visual in the portal should be built from
 * these so the frosted look, specular edge, radius, and motion stay identical
 * across all pages — the single source of the design language.
 */

/** A frosted card. `interactive` adds the cursor lift; `glow` rings it in accent. */
export function GlassCard({ children, className = '', interactive = false, glow = false, as = 'div', ...rest }) {
  const Cmp = motion[as] || motion.div
  return (
    <Cmp
      variants={rise}
      className={[
        'relative rounded-[var(--r-md)] p-5 sheen glass',
        interactive ? 'lift cursor-pointer' : '',
        glow ? 'ring-1 ring-[rgba(0,229,176,0.22)]' : '',
        className,
      ].join(' ')}
      style={glow ? { boxShadow: 'var(--glow-accent), var(--shadow-md)' } : undefined}
      {...rest}
    >
      {children}
    </Cmp>
  )
}

/** A denser panel for controls/sidebars that must stay legible over busy aurora. */
export function GlassPanel({ children, className = '', ...rest }) {
  return (
    <div className={`relative rounded-[var(--r-md)] sheen glass-strong ${className}`} {...rest}>
      {children}
    </div>
  )
}

/** Small uppercase section label — the quiet typographic detail. */
export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-3)] ${className}`}>
      {children}
    </p>
  )
}

/** A status/category pill in the glass idiom. Pass an accent hex for tint. */
export function GlassPill({ children, color = '#00e5b0', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}
      style={{ color, background: `${color}1a`, border: `1px solid ${color}2e` }}
    >
      {children}
    </span>
  )
}

/** Wrap a page's content so its cards stagger-reveal on mount. */
export function StaggerGroup({ children, className = '', delayChildren = 0.05 }) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { delayChildren, staggerChildren: 0.055 } } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export { spring }
