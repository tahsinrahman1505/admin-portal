/**
 * StatusBadge — conversation status chip (open / pending / resolved) using
 * the --status-* semantic tokens, paired for both themes in globals.css.
 * Purely presentational: no state or handlers, so no 'use client' directive.
 */

const STATUS = {
  open: { label: 'Open', color: 'var(--status-open)', soft: 'var(--status-open-soft)' },
  pending: { label: 'Pending', color: 'var(--status-pending)', soft: 'var(--status-pending-soft)' },
  resolved: { label: 'Resolved', color: 'var(--status-resolved)', soft: 'var(--status-resolved-soft)' },
}

export default function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.open

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: s.color, background: s.soft, fontFamily: 'var(--font-jakarta)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
      {s.label}
    </span>
  )
}
