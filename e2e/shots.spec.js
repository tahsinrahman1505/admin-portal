import { test } from '@playwright/test'
import fs from 'node:fs'

/**
 * Not an assertion suite — this captures reference screenshots so a human can
 * actually look at the result. Kept separate from smoke/theme/responsive so it
 * never gates a merge; run it with `npx playwright test e2e/shots.spec.js`.
 *
 * Both themes, because the design system is dual-theme and a component that
 * hardcoded a colour looks fine in exactly one of them.
 */

const OUT = 'test-results/shots'
const PAGES = [
  ['dashboard',     '/dashboard'],
  ['inbox',         '/conversations'],
  ['agent-soon',    '/agent'],
  ['campaigns-soon', '/campaigns'],
]

test.beforeAll(() => { fs.mkdirSync(OUT, { recursive: true }) })

for (const [name, route] of PAGES) {
  for (const theme of ['dark', 'light']) {
    test(`shot: ${name} (${theme})`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'networkidle' })
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
      // globals.css transitions background-color over 0.3s; wait it out or the
      // capture catches the previous theme mid-fade.
      await page.waitForTimeout(600)
      await page.screenshot({ path: `${OUT}/${name}-${theme}.png`, fullPage: false })
    })
  }
}
