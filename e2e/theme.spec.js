import { test, expect } from '@playwright/test'

// A representative subset of routes — enough to catch a component that hardcoded
// a color and ignores the app's theme, without re-running the full route sweep
// that smoke.spec.js already owns.
const ROUTES = ['/dashboard', '/conversations', '/settings']

// body has `transition: background-color 0.3s ...` (app/globals.css) — reading
// computed style synchronously after flipping the attribute captures the
// transition's start value, not its target. Wait past the transition so we
// measure the settled color.
const TRANSITION_SETTLE_MS = 400

for (const route of ROUTES) {
  test(`${route} — body background color actually changes between light and dark theme`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' })

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
    await page.waitForTimeout(TRANSITION_SETTLE_MS)
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.waitForTimeout(TRANSITION_SETTLE_MS)
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)

    expect(
      darkBg,
      `${route}: body background-color did not change between themes (stuck at ${lightBg}) — a component may have hardcoded a color instead of using theme tokens`
    ).not.toBe(lightBg)
  })
}
