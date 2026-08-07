import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',

  // Port 3100, not the Next default 3000: this machine commonly has another
  // project's dev server on 3000, and a suite that silently attaches to a
  // DIFFERENT app's server would produce confidently wrong results.
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],

  // Next.js cold start (especially first compile of each route in dev mode) is
  // slow — give the server plenty of runway before Playwright gives up on it.
  webServer: {
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
})
