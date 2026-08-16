import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Regression guard for the bug that failed every Vercel PREVIEW build for weeks:
// lib/supabase.js built its client at MODULE SCOPE, so importing it with
// NEXT_PUBLIC_SUPABASE_URL absent threw "supabaseUrl is required" during Next's
// build-time page-data collection and aborted the ENTIRE build —
//
//   Error occurred prerendering page "/activity"
//   Error: supabaseUrl is required.
//     at module evaluation (lib_supabase_*.js)
//   Export encountered an error on /(portal)/activity/page: /activity, exiting the build.
//
// The single assertion that matters here is the first one: importing the module
// with no env must not throw. Everything else pins the behaviour that had to stay
// unchanged while making that true.
//
// Same isolation trick as demoRoute.test.js: NEXT_PUBLIC_DEMO_MODE is read into a
// module-level const at import time, so each case needs a fresh module instance
// under its own env — vi.resetModules() + dynamic import().
describe('lib/supabase — import must never throw on missing env', () => {
  const ORIGINAL = {
    demo: process.env.NEXT_PUBLIC_DEMO_MODE,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const unsetSupabaseEnv = () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  }

  const restore = (name, value) => {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    restore('NEXT_PUBLIC_DEMO_MODE', ORIGINAL.demo)
    restore('NEXT_PUBLIC_SUPABASE_URL', ORIGINAL.url)
    restore('NEXT_PUBLIC_SUPABASE_ANON_KEY', ORIGINAL.key)
    vi.resetModules()
  })

  it('imports cleanly when both Supabase vars are absent (the Preview case)', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false'
    unsetSupabaseEnv()

    // This is the whole point: no throw here means no dead build.
    const mod = await import('../supabase.js')
    expect(mod.supabase).toBeDefined()
  })

  it('imports cleanly when the vars are present but blank', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false'
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ''

    const mod = await import('../supabase.js')
    expect(mod.supabase).toBeDefined()
  })

  it('defers the failure to first use, and names the missing vars', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false'
    unsetSupabaseEnv()
    const { supabase } = await import('../supabase.js')

    expect(() => supabase.from('leads')).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
    expect(() => supabase.from('leads')).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('builds a real, fully-featured client when the env IS present', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    const { supabase } = await import('../supabase.js')

    // The four methods every call site in app/ and components/ actually uses,
    // plus .rpc — which nothing calls today and which a hand-written facade of
    // "just the methods we use" would have silently returned undefined for.
    expect(typeof supabase.from).toBe('function')
    expect(typeof supabase.channel).toBe('function')
    expect(typeof supabase.removeChannel).toBe('function')
    expect(typeof supabase.rpc).toBe('function')
    expect(typeof supabase.auth.getUser).toBe('function')

    // `this` must be the client, not the Proxy — an unbound method would blow up
    // reaching for internals here rather than returning a query builder.
    expect(supabase.from('leads')).toBeDefined()

    // Stable identity across accesses, as when this exported a plain object: a
    // fresh function per access would break any React dependency array holding one.
    expect(supabase.from).toBe(supabase.from)

    // One memoised client, not one per property access.
    expect(supabase.auth).toBe(supabase.auth)
  })

  it('still returns the demo mock client in demo mode, with no Supabase env at all', async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'true'
    unsetSupabaseEnv()
    const { supabase } = await import('../supabase.js')

    const { data, error } = await supabase.auth.getUser()
    expect(error).toBeNull()
    expect(data.user).toBeTruthy()

    // The demo path must not touch realClient() — it has no env and must not throw.
    const rows = await supabase.from('leads')
    expect(Array.isArray(rows.data)).toBe(true)
  })
})
