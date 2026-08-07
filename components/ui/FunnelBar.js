/**
 * FunnelBar — horizontal stacked funnel. Each stage's bar is scaled to its
 * share of the FIRST stage's value (the funnel's mouth), with label / value
 * / pct, plus the drop-off vs. the previous stage. Guards every division: an
 * empty stages array or a zero-value mouth renders 0%-width bars and skips
 * the drop-off line instead of producing NaN/Infinity. No state or
 * handlers, so no 'use client' directive.
 */

import { funnelStages } from '@/lib/chartMath'

export default function FunnelBar({ stages = [] }) {
  // Width/drop-off arithmetic lives in lib/chartMath.js so it can be unit-tested
  // without a DOM — the zero-value cases are where charts render "NaN%".
  const laid = funnelStages(stages)

  if (stages.length === 0) {
    return (
      <p className="text-[var(--ink-3)] text-[12px] text-center py-4" style={{ fontFamily: 'var(--font-jakarta)' }}>
        No funnel data yet.
      </p>
    )
  }

  return (
    <div className="space-y-3" style={{ fontFamily: 'var(--font-jakarta)' }}>
      {laid.map((stage) => {
        const { widthPct, dropoffPct: dropoff } = stage

        return (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1 text-[12px]">
              <span className="text-[var(--ink-2)] font-medium">{stage.label}</span>
              <span className="tnum text-[var(--ink-3)]">
                {stage.value}
                {stage.pct != null && ` · ${stage.pct}%`}
              </span>
            </div>
            <div className="h-7 rounded-lg bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-lg"
                style={{ width: `${widthPct}%`, background: 'var(--accent)', opacity: 0.75 }}
              />
            </div>
            {dropoff !== null && dropoff > 0 && (
              <p className="text-[10.5px] mt-1" style={{ color: 'var(--prio-urgent)' }}>
                −{dropoff}% drop-off
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
