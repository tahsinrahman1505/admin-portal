/**
 * StatTile — big tabular number + label, with an optional delta chip.
 * `delta` is `{ value: number, direction: 'up'|'down' }` — when it's not
 * supplied, nothing renders in its place (no invented number, no reserved
 * gap). Purely presentational: no state or handlers, so no 'use client'
 * directive.
 */

const DELTA_COLOR = {
  up: 'var(--status-open)',
  down: 'var(--prio-urgent)',
}

export default function StatTile({ label, value, delta, accent = 'var(--accent)', icon }) {
  const deltaColor = delta ? DELTA_COLOR[delta.direction] : null

  return (
    <div className="glass sheen rounded-[var(--r-md)] p-4 sm:p-5" style={{ fontFamily: 'var(--font-jakarta)' }}>
      {(icon || delta) && (
        <div className="flex items-center justify-between mb-3">
          <div>
            {icon && (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent }}
                aria-hidden="true"
              >
                {icon}
              </div>
            )}
          </div>
          <div>
            {delta && (
              <span
                className="tnum text-[11px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"
                style={{ color: deltaColor, background: `color-mix(in srgb, ${deltaColor} 12%, transparent)` }}
              >
                <span aria-hidden="true">{delta.direction === 'up' ? '▲' : '▼'}</span>
                {Math.abs(delta.value)}%
              </span>
            )}
          </div>
        </div>
      )}
      <p className="tnum text-[1.9rem] font-bold text-[var(--ink-1)] leading-none">{value}</p>
      <p className="text-[var(--ink-3)] text-[12px] mt-1.5">{label}</p>
    </div>
  )
}
