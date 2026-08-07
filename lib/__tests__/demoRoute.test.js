import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// demoRoute.js reads NEXT_PUBLIC_DEMO_MODE into a module-level const at import
// time, so each test case needs a fresh module instance loaded under its own
// env value. vi.resetModules() + a dynamic import() gives us that isolation.
describe('demoGuard', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_DEMO_MODE

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = ORIGINAL
    vi.resetModules()
  })

  it('returns null (no-op) when demo mode is off', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false'
    const { demoGuard, IS_DEMO } = await import('../demoRoute.js')

    expect(IS_DEMO).toBe(false)
    const request = { url: 'http://localhost:3000/api/rag/health' }
    expect(demoGuard(request)).toBeNull()
  })

  it('returns null (no-op) when the env var is unset entirely', async () => {
    delete process.env.NEXT_PUBLIC_DEMO_MODE
    const { demoGuard, IS_DEMO } = await import('../demoRoute.js')

    expect(IS_DEMO).toBe(false)
    const request = { url: 'http://localhost:3000/api/rag/copilot/briefing' }
    expect(demoGuard(request)).toBeNull()
  })

  it('short-circuits with a seeded 200 response when demo mode is on', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'
    const { demoGuard, IS_DEMO } = await import('../demoRoute.js')

    expect(IS_DEMO).toBe(true)
    const request = { url: 'http://localhost:3000/api/rag/health' }
    const response = demoGuard(request)

    expect(response).not.toBeNull()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ status: 'ok', demo: true })
  })
})
