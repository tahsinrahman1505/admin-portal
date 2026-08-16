import { createClient } from '@supabase/supabase-js'
import { tableRows, DEMO_USER, DEMO_SESSION } from './demoData'
import { createQuery } from './demoQuery'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ── Real client (default) ────────────────────────────────────────────────────
function realClient() {
  // Keep these as literal `process.env.NEXT_PUBLIC_*` member expressions — Next
  // substitutes those inline at build time for the browser bundle. A computed
  // lookup (process.env[name]) would not be replaced and would read undefined.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    // Fail at the call site that actually needs Supabase, naming what's missing,
    // rather than letting createClient throw a bare "supabaseUrl is required"
    // from inside a build worker with no hint of which variable or which scope.
    throw new Error(
      'Supabase is not configured for this environment: set NEXT_PUBLIC_SUPABASE_URL ' +
      'and NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel → Settings → Environment Variables — ' +
      'tick every scope, Preview included).',
    )
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

// ── Demo client (zero-login showcase) ────────────────────────────────────────
// A chainable, awaitable query builder over the in-memory fixtures in
// lib/demoData.js. Filters, ordering, pagination and mutations are all really
// applied — see lib/demoQuery.js for the engine and for the deliberate
// limitations (no column projection, no embedded joins).
//
// This used to stub every operator as a no-op returning the whole table. That
// made filter UIs look broken on the demo site, and — worse — made any test of
// filtering incapable of failing. See the header of lib/demoQuery.js.
function makeQuery(table) {
  return createQuery(() => tableRows(table))
}

function makeChannel() {
  const ch = {
    on() { return ch },
    subscribe() { return ch },
    unsubscribe() { return Promise.resolve('ok') },
  }
  return ch
}

function demoClient() {
  return {
    from(table) { return makeQuery(table) },
    channel() { return makeChannel() },
    removeChannel() { return Promise.resolve('ok') },
    removeAllChannels() { return Promise.resolve('ok') },
    auth: {
      async getUser() { return { data: { user: DEMO_USER }, error: null } },
      async getSession() { return { data: { session: DEMO_SESSION }, error: null } },
      onAuthStateChange(cb) {
        // fire once so layouts that wait for a session proceed immediately
        try { cb('SIGNED_IN', DEMO_SESSION) } catch {}
        return { data: { subscription: { unsubscribe() {} } } }
      },
      async signInWithPassword() { return { data: { user: DEMO_USER, session: DEMO_SESSION }, error: null } },
      async signOut() { return { error: null } },
    },
  }
}

// ── Lazy singleton ───────────────────────────────────────────────────────────
// This module used to end with:
//
//   export const supabase = DEMO ? demoClient() : realClient()
//
// which ran createClient() the instant ANY file imported it. `next build` imports
// every page module to collect page data, so with NEXT_PUBLIC_SUPABASE_URL unset
// the constructor threw during module evaluation and took the whole build down:
//
//   Error occurred prerendering page "/activity"
//   Error: supabaseUrl is required.
//     at new cF (.next/server/chunks/ssr/lib_supabase_*.js)
//     at module evaluation (lib_supabase_*.js)
//     at module evaluation (app_(portal)_layout_*.js)
//   Export encountered an error on /(portal)/activity/page: /activity, exiting the build.
//
// The vars were scoped Production-only, so every PREVIEW deployment failed like
// this for weeks while Production built fine. Note what actually broke: not the
// pages that use Supabase, but the BUILD — /login and pages that never read a row
// went down with it, and the log blamed a page that was merely downstream of
// app/(portal)/layout.js's import.
//
// Same bug class already bit app/api/push/send/route.js (module-scope
// webpush.setVapidDetails()) and lib/auth.js (module-scope service-role client).
// Both were fixed by deferring construction into the code path that needs it, so
// treat it as the rule here: nothing constructs an env-dependent client at import
// time. Missing config may fail a request; it must never fail a build.
let _client = null
function client() {
  if (!_client) _client = DEMO ? demoClient() : realClient()
  return _client
}

// A Proxy rather than a hand-written `{ from, auth, channel, ... }` facade: 15
// files import this as `{ supabase }` and reach for .from / .auth / .channel /
// .removeChannel today, but an enumerated facade would silently return undefined
// for the first .rpc()/.storage call someone adds later — swapping a loud build
// failure for a quiet runtime one. Forwarding every trap keeps the exported
// surface byte-for-byte what it was; the only thing that changed is WHEN the
// client is built.
const boundMethods = new Map()

export const supabase = new Proxy({}, {
  get(_target, prop) {
    if (boundMethods.has(prop)) return boundMethods.get(prop)
    const value = Reflect.get(client(), prop)
    if (typeof value !== 'function') return value
    // Bind: without it `this` inside e.g. from() would be this Proxy, not the
    // client. Cache: so `supabase.from === supabase.from` still holds, as it did
    // when this exported a plain object — a fresh identity per access would
    // quietly break any React dependency array holding one of these.
    const boundMethod = value.bind(client())
    boundMethods.set(prop, boundMethod)
    return boundMethod
  },
  set(_target, prop, value) {
    boundMethods.delete(prop)
    return Reflect.set(client(), prop, value)
  },
  has(_target, prop) { return Reflect.has(client(), prop) },
  getPrototypeOf() { return Reflect.getPrototypeOf(client()) },
  ownKeys() { return Reflect.ownKeys(client()) },
  getOwnPropertyDescriptor(_target, prop) {
    const descriptor = Reflect.getOwnPropertyDescriptor(client(), prop)
    // The Proxy target is an empty object, so a descriptor for a key the target
    // lacks must be reported configurable or the engine throws an invariant
    // TypeError before the caller ever sees the value.
    return descriptor && { ...descriptor, configurable: true }
  },
})
