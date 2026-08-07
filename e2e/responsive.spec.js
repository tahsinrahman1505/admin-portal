import { test, expect } from '@playwright/test'

const ROUTES = ['/dashboard', '/conversations']

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
]

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`${route} — no horizontal overflow at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(route, { waitUntil: 'networkidle' })

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }))
      expect(
        overflow.scrollWidth,
        `${route} at ${viewport.name}: horizontal overflow — scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}`
      ).toBeLessThanOrEqual(overflow.innerWidth + 1)
    })
  }
}
