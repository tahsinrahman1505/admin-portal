/**
 * Donut — pure-SVG donut chart (no chart library), with a legend. Segments
 * are laid out as stroked arcs on a shared circle via
 * stroke-dasharray/stroke-dashoffset rather than computed path arcs — cheap,
 * and it can't produce malformed path data. total<=0 (empty segments, or all
 * zero values) renders a flat --ink-4 ring instead of dividing by zero into
 * NaN dash values. No state or handlers, so no 'use client' directive.
 */

import { donutArcs } from '@/lib/chartMath'

export default function Donut({ segments = [], centerValue, centerLabel, size = 160 }) {
  // Arc geometry lives in lib/chartMath.js so the total<=0 case is unit-tested
  // without a DOM — that's the path that would otherwise emit NaN dash values.
  const { total, radius, stroke, arcs } = donutArcs(segments, size)

  return (
    <div className="flex items-center gap-5" style={{ fontFamily: 'var(--font-jakarta)' }}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
          {total <= 0 ? (
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ink-4)" strokeWidth={stroke} />
          ) : (
            arcs.map((a, i) => (
                <circle
                  key={a.label ?? i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={a.color}
                  strokeWidth={stroke}
                  strokeDasharray={`${a.dash} ${a.gap}`}
                  strokeDashoffset={a.offset}
                  strokeLinecap={arcs.length > 1 ? 'butt' : 'round'}
                />
            ))
          )}
        </svg>
        {(centerValue != null || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue != null && (
              <span className="tnum text-[var(--ink-1)] font-bold" style={{ fontSize: size * 0.15 }}>
                {centerValue}
              </span>
            )}
            {centerLabel && <span className="text-[var(--ink-3)] text-[10.5px] mt-0.5">{centerLabel}</span>}
          </div>
        )}
      </div>
      {segments.length > 0 && (
        <ul className="space-y-1.5">
          {segments.map((s, i) => (
            <li key={s.label ?? i} className="flex items-center gap-2 text-[12px]">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
              <span className="text-[var(--ink-2)]">{s.label}</span>
              <span className="tnum text-[var(--ink-3)] ml-auto">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
