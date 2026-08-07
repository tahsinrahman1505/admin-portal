/**
 * PriorityBadge — maps `priority` to the --prio-* semantic tokens, which are
 * already light/dark-paired in globals.css (raw Tailwind ambers/reds silently
 * fail contrast on the light theme, which is exactly what those tokens fix).
 * `variant="dot"` renders just the colored dot with an accessible label —
 * no visible text, so it needs `role="img"` + `aria-label` to announce the
 * priority to screen readers. Purely presentational: no state or handlers,
 * so no 'use client' directive.
 */

const PRIORITY = {
  urgent: { label: 'Urgent', color: 'var(--prio-urgent)', soft: 'var(--prio-urgent-soft)' },
  high: { label: 'High', color: 'var(--prio-high)', soft: 'var(--prio-high-soft)' },
  medium: { label: 'Medium', color: 'var(--prio-medium)', soft: 'var(--prio-medium-soft)' },
  low: { label: 'Low', color: 'var(--prio-low)', soft: 'var(--prio-low-soft)' },
}

export default function PriorityBadge({ priority, variant = 'chip' }) {
  const p = PRIORITY[priority] || PRIORITY.low

  if (variant === 'dot') {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ background: p.color }}
        role="img"
        aria-label={`Priority: ${p.label}`}
      />
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: p.color, background: p.soft, fontFamily: 'var(--font-jakarta)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} aria-hidden="true" />
      {p.label}
    </span>
  )
}
