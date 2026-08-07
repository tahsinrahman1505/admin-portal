import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // NOTE — component-RENDERING tests are not runnable in this repo today.
  // The app writes JSX inside plain `.js` files (Next allows it; there is no
  // TypeScript here). Vite 8 transforms with oxc, which only parses JSX in
  // `.jsx`/`.tsx`, ignores the older `esbuild: { loader }` escape hatch, and
  // runs before this plugin gets a look in — so importing any component from a
  // `.js` file into a test fails with "JSX syntax is disabled".
  //
  // Rather than leave a half-working harness, logic that needs testing is kept
  // in pure modules (see lib/chartMath.js, lib/demoQuery.js) and tested there
  // directly. Behaviour that only exists in the DOM is covered by Playwright
  // against demo mode instead, which exercises the real Next build.
  //
  // To enable RTL later: rename component files to `.jsx`, or adopt a Babel
  // transform ahead of oxc. Not worth blocking on now.
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    include: ['**/*.test.js'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    globals: false,
  },
})
