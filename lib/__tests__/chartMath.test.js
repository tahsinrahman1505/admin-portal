import { describe, it, expect } from 'vitest'
import { funnelStages, donutArcs } from '../chartMath'

/**
 * Charts eventually get fed empty data — a brand-new clinic, a date range with
 * no traffic, a funnel stage nobody reached. The failure isn't a crash, it's
 * `NaN%` rendered into the page or malformed SVG, which reads as a broken
 * product at precisely the moment a new customer is first looking at it.
 */

describe('funnelStages', () => {
  it('scales each stage against the funnel mouth', () => {
    const out = funnelStages([
      { label: 'Inbound', value: 100 },
      { label: 'Engaged', value: 50 },
      { label: 'Booked',  value: 25 },
    ])
    expect(out.map(s => s.widthPct)).toEqual([100, 50, 25])
  })

  it('computes drop-off against the PREVIOUS stage, not the mouth', () => {
    const out = funnelStages([
      { label: 'Inbound', value: 100 },
      { label: 'Engaged', value: 50 },
      { label: 'Booked',  value: 25 },
    ])
    // 100→50 is 50% off; 50→25 is also 50% off (not 75%).
    expect(out.map(s => s.dropoffPct)).toEqual([null, 50, 50])
  })

  it('returns no drop-off for the first stage', () => {
    const [first] = funnelStages([{ label: 'Inbound', value: 10 }])
    expect(first.dropoffPct).toBeNull()
  })

  it('survives a zero-valued mouth without NaN or Infinity', () => {
    const out = funnelStages([
      { label: 'Inbound', value: 0 },
      { label: 'Booked',  value: 0 },
    ])
    out.forEach(s => {
      expect(Number.isFinite(s.widthPct)).toBe(true)
      expect(s.widthPct).toBe(0)
    })
    // No meaningful drop "from nothing" — must be null, not NaN.
    expect(out[1].dropoffPct).toBeNull()
  })

  it('handles an empty stage list', () => {
    expect(funnelStages([])).toEqual([])
    expect(funnelStages()).toEqual([])
  })

  it('clamps a stage that exceeds the mouth to 100%', () => {
    // Real data can do this: "booked" counted over a wider window than "inbound".
    const out = funnelStages([{ label: 'A', value: 10 }, { label: 'B', value: 40 }])
    expect(out[1].widthPct).toBe(100)
  })

  it('coerces missing or non-numeric values to 0 rather than NaN', () => {
    const out = funnelStages([{ label: 'A', value: 10 }, { label: 'B' }])
    expect(out[1].value).toBe(0)
    expect(Number.isFinite(out[1].widthPct)).toBe(true)
  })
})

describe('donutArcs', () => {
  it('splits the circumference in proportion to each value', () => {
    const { arcs, circumference } = donutArcs([
      { label: 'A', value: 75, color: 'a' },
      { label: 'B', value: 25, color: 'b' },
    ])
    expect(arcs).toHaveLength(2)
    expect(arcs[0].dash).toBeCloseTo(circumference * 0.75)
    expect(arcs[1].dash).toBeCloseTo(circumference * 0.25)
    // dash + gap must always equal one full turn, or the ring renders wrong.
    arcs.forEach(a => expect(a.dash + a.gap).toBeCloseTo(circumference))
  })

  it('offsets each arc by the sum of those before it', () => {
    const { arcs } = donutArcs([
      { label: 'A', value: 50, color: 'a' },
      { label: 'B', value: 50, color: 'b' },
    ])
    expect(arcs[0].offset).toBe(-0)
    expect(arcs[1].offset).toBeCloseTo(-arcs[0].dash)
  })

  it('returns no arcs when the total is zero — the NaN path', () => {
    const { total, arcs } = donutArcs([{ label: 'A', value: 0, color: 'a' }])
    expect(total).toBe(0)
    expect(arcs).toEqual([])
  })

  it('handles no segments at all', () => {
    const { total, arcs, radius } = donutArcs([])
    expect(total).toBe(0)
    expect(arcs).toEqual([])
    expect(Number.isFinite(radius)).toBe(true)
  })

  it('skips zero-valued slices but keeps the rest correct', () => {
    const { arcs } = donutArcs([
      { label: 'A', value: 50, color: 'a' },
      { label: 'Empty', value: 0, color: 'x' },
      { label: 'B', value: 50, color: 'b' },
    ])
    expect(arcs.map(a => a.label)).toEqual(['A', 'B'])
  })

  it('never emits a non-finite dash, gap or offset', () => {
    const { arcs } = donutArcs([
      { label: 'A', value: 1, color: 'a' },
      { label: 'B', value: 2, color: 'b' },
      { label: 'C', value: 0, color: 'c' },
    ])
    arcs.forEach(a => {
      expect(Number.isFinite(a.dash)).toBe(true)
      expect(Number.isFinite(a.gap)).toBe(true)
      expect(Number.isFinite(a.offset)).toBe(true)
      expect(Number.isFinite(a.pct)).toBe(true)
    })
  })

  it('scales radius and stroke with size', () => {
    const small = donutArcs([{ label: 'A', value: 1, color: 'a' }], 100)
    const large = donutArcs([{ label: 'A', value: 1, color: 'a' }], 200)
    expect(large.radius).toBeGreaterThan(small.radius)
    expect(large.stroke).toBeGreaterThan(small.stroke)
  })
})
