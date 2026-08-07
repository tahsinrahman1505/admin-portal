import { createClient } from '@supabase/supabase-js'
import { tableRows, DEMO_USER, DEMO_SESSION } from './demoData'
import { createQuery } from './demoQuery'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ── Real client (default) ────────────────────────────────────────────────────
function realClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
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

export const supabase = DEMO ? demoClient() : realClient()
