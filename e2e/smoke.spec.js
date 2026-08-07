import { test, expect } from '@playwright/test'

// Demo mode (NEXT_PUBLIC_DEMO_MODE=true, see .env.local) makes every one of these
// routes reachable with no login and no database — that's what makes a full route
// sweep possible here.
const ROUTES = [
  '/dashboard',
  '/conversations',
  '/leads',
  '/bookings',
  '/patients',
  '/recall',
  '/analytics',
  '/activity',
  '/knowledge-base',
  '/channels',
  '/team',
  '/settings',
  '/copilot',
  // Routed in Phase 0 as ComingSoon placeholders so the sidebar IA is settled
  // now and later phases only fill the page in. They must still load clean.
  '/campaigns',
  '/templates',
  '/agent',
]

for (const route of ROUTES) {
  test(`${route} — loads clean (no console/page errors, no horizontal overflow)`, async ({ page }) => {
    const consoleErrors = []
    const pageErrors = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    // (a) the page responds and reaches networkidle without throwing
    const response = await page.goto(route, { waitUntil: 'networkidle' })
    expect(response, `${route} produced no response`).not.toBeNull()
    expect(response.ok(), `${route} responded with status ${response.status()}`).toBe(true)

    // (b) zero console errors and zero unhandled page errors
    expect(consoleErrors, `console errors on ${route}:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(pageErrors, `unhandled page errors on ${route}:\n${pageErrors.join('\n')}`).toEqual([])

    // (c) no horizontal overflow
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(
      overflow.scrollWidth,
      `${route} has horizontal overflow: scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}`
    ).toBeLessThanOrEqual(overflow.innerWidth + 1)
  })
}
