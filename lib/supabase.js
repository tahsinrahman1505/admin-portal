import { createClient } from '@supabase/supabase-js'
import { tableData, DEMO_USER, DEMO_SESSION } from './demoData'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ── Real client (default) ────────────────────────────────────────────────────
function realClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createClient(supabaseUrl, supabaseAnonKey)
}

// ── Demo client (zero-login showcase) ────────────────────────────────────────
// A chainable, awaitable query-builder that ignores filters and resolves to the
// table's seed rows. Enough surface to satisfy every call site in the portal
// without touching any real database. See lib/demoData.js.
function makeQuery(table) {
  const rows = tableData(table)
  let headCount = false

  const builder = {
    // filter/ordering ops — all no-ops that return the builder for chaining
    eq() { return builder },
    neq() { return builder },
    gt() { return builder },
    gte() { return builder },
    lt() { return builder },
    lte() { return builder },
    like() { return builder },
    ilike() { return builder },
    in() { return builder },
    is() { return builder },
    not() { return builder },
    or() { return builder },
    contains() { return builder },
    order() { return builder },
    limit() { return builder },
    range() { return builder },
    filter() { return builder },
    match() { return builder },

    select(_cols, opts) {
      if (opts && opts.head) headCount = true
      return builder
    },

    // terminal single-row ops
    single() { return Promise.resolve({ data: rows[0] ?? null, error: null }) },
    maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }) },

    // mutations — pretend success, echo nothing sensitive
    insert() { return Promise.resolve({ data: null, error: null }) },
    update() { return builder },
    upsert() { return Promise.resolve({ data: null, error: null }) },
    delete() { return builder },

    // make the builder awaitable: `await supabase.from(t).select(...)`
    then(resolve, reject) {
      const payload = headCount
        ? { data: null, count: rows.length, error: null }
        : { data: rows, count: rows.length, error: null }
      return Promise.resolve(payload).then(resolve, reject)
    },
  }
  return builder
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
