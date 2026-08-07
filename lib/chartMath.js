/**
 * Pure geometry/arithmetic for the chart primitives.
 *
 * Kept separate from the components on purpose. What actually breaks in a chart
 * is the maths — a funnel whose mouth is zero, a donut whose segments all sum to
 * zero, a drop-off computed against a missing previous stage. Those produce
 * `NaN%` in the page or malformed SVG, and they surface exactly when a clinic is
 * brand new and has no data, which is the worst moment for the product to look
 * broken.
 *
 * Isolating them here means they are unit-tested directly as plain functions,
 * with no DOM, no React and no JSX transform involved. (That last point is not
 * incidental: this repo writes JSX inside `.js` files, which Vite 8's oxc
 * transformer will not parse in the test environment — so a component-rendering
 * test is currently not runnable here. See vitest.config.js. Pure modules like
 * this one sidestep that entirely and are the more durable place for logic.)
 */

/**
 * Lay out funnel stages relative to the first stage (the funnel's mouth).
 *
 * @param {{label: string, value: number}[]} stages
 * @returns {{label: string, value: number, widthPct: number, dropoffPct: number|null}[]}
 *   `widthPct` is 0-100. `dropoffPct` is null for the first stage and whenever
 *   the previous stage was 0 (there is no meaningful drop from nothing).
 */
export function funnelStages(stages = []) {
  const base = stages[0]?.value || 0

  return stages.map((stage, i) => {
    const value = Number(stage.value) || 0
    // Guard the mouth: base of 0 must give 0%, never NaN or Infinity.
    const widthPct = base > 0 ? Math.min(100, (value / base) * 100) : 0

    const prev = i > 0 ? stages[i - 1] : null
    const prevValue = Number(prev?.value) || 0
    const dropoffPct = prev && prevValue > 0
      ? Math.round(((prevValue - value) / prevValue) * 100)
      : null

    return { ...stage, value, widthPct, dropoffPct }
  })
}

/**
 * Turn donut segments into stroke-dasharray arcs on a shared circle.
 *
 * Arcs are expressed as dash/gap on one circle rather than computed SVG path
 * `A` commands — cheaper, and structurally incapable of emitting malformed path
 * data.
 *
 * @returns {{total: number, radius: number, stroke: number, circumference: number,
 *            arcs: {label, color, value, dash, gap, offset}[]}}
 *   `arcs` is empty when the total is 0, which the component renders as a flat
 *   placeholder ring instead of dividing by zero.
 */
export function donutArcs(segments = [], size = 160) {
  const stroke = Math.max(10, size * 0.14)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0)

  if (total <= 0) return { total: 0, radius, stroke, circumference, arcs: [] }

  let acc = 0
  const arcs = []
  for (const s of segments) {
    const value = Number(s.value) || 0
    if (value <= 0) continue          // a zero slice draws nothing
    const dash = (value / total) * circumference
    arcs.push({
      label: s.label,
      color: s.color,
      value,
      dash,
      gap: circumference - dash,
      offset: -acc,
      pct: (value / total) * 100,
    })
    acc += dash
  }

  return { total, radius, stroke, circumference, arcs }
}
