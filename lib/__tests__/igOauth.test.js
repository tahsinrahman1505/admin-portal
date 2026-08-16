import { describe, it, expect } from 'vitest'

/**
 * `state` + the nonce cookie are the ONLY things binding an Instagram OAuth
 * round trip to one clinic AND one browser. The callback is a top-level redirect
 * from instagram.com with no request body. If either can be forged or skipped,
 * an attacker attaches their Instagram account to another clinic's row — or
 * worse, phishes a clinic owner into attaching THEIR account to the attacker's
 * row, which routes that clinic's patient DMs to the attacker.
 *
 * ── Why this file sets env the awkward way ──────────────────────────────────
 * The first version of these tests set process.env in `beforeAll` and then used
 * a top-level `await import(...)`. That is a trap: Vitest evaluates the module
 * body (including top-level await) at COLLECTION time, before any hook runs, so
 * the module captured an EMPTY secret. All eight tests passed — while proving
 * only that HMAC-with-an-empty-key is self-consistent. Worse, the code under
 * test defaulted the secret to '' and Node's createHmac accepts '' happily, so
 * the suite was green against a configuration in which every state was
 * forgeable by anyone.
 *
 * Env is therefore set at MODULE SCOPE here, before the import below, and there
 * is an explicit test asserting the module actually saw it. Both are load-bearing.
 */
process.env.META_IG_APP_SECRET = 'test-secret-for-hmac'
process.env.META_IG_APP_ID = '1195496075978378'

const {
  signState, verifyState, nonceMatches, newNonce, igRedirectUri, IG_APP_SECRET,
} = await import('../igOauth')

const NONCE = 'a'.repeat(32)

describe('test setup is itself valid', () => {
  it('the module under test really sees the secret (guards the beforeAll trap)', () => {
    // If this fails, every other assertion in this file is meaningless: they
    // would be testing HMAC over an empty key, which an attacker can also compute.
    expect(IG_APP_SECRET).toBe('test-secret-for-hmac')
    expect(IG_APP_SECRET).toBeTruthy()
  })
})

describe('state binds the round trip to one clinic', () => {
  it('round-trips clinic id and nonce', () => {
    expect(verifyState(signState('dental_demo', NONCE))).toEqual({ cid: 'dental_demo', nonce: NONCE })
  })

  it('rejects a tampered payload (swap in another clinic, keep the signature)', () => {
    const [, sig] = signState('dental_demo', NONCE).split('.')
    const forged = Buffer.from(
      JSON.stringify({ cid: 'victim_clinic', ts: Date.now(), n: NONCE }),
    ).toString('base64url')
    expect(verifyState(`${forged}.${sig}`)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const [payload] = signState('dental_demo', NONCE).split('.')
    expect(verifyState(`${payload}.not-a-real-signature`)).toBeNull()
  })

  it('rejects an unsigned bare clinic id', () => {
    expect(verifyState('dental_demo')).toBeNull()
  })

  it('rejects malformed input without throwing', () => {
    for (const bad of ['', null, undefined, '.', 'a.b.c', 'garbage', 123, {}]) {
      expect(verifyState(bad)).toBeNull()
    }
  })

  it('rejects state older than the 10-minute TTL', () => {
    const realNow = Date.now
    try {
      Date.now = () => realNow() - 11 * 60 * 1000
      const stale = signState('dental_demo', NONCE)
      Date.now = realNow
      expect(verifyState(stale)).toBeNull()
    } finally { Date.now = realNow }
  })

  it('accepts state inside the TTL', () => {
    const realNow = Date.now
    try {
      Date.now = () => realNow() - 60 * 1000
      const fresh = signState('dental_demo', NONCE)
      Date.now = realNow
      expect(verifyState(fresh)?.cid).toBe('dental_demo')
    } finally { Date.now = realNow }
  })

  it('rejects state with no nonce (a pre-nonce state must not still validate)', () => {
    // Guards against a downgrade: an old-format state, or one hand-built to omit
    // the nonce, must not slip past and skip the browser-binding check.
    const secret = process.env.META_IG_APP_SECRET
    const crypto = require('crypto')
    const payload = Buffer.from(JSON.stringify({ cid: 'dental_demo', ts: Date.now() })).toString('base64url')
    const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
    expect(verifyState(`${payload}.${sig}`)).toBeNull()
  })
})

describe('nonce binds the round trip to one browser', () => {
  it('matches identical nonces', () => {
    expect(nonceMatches(NONCE, NONCE)).toBe(true)
  })

  it('rejects a different nonce — the phishing case', () => {
    // Attacker lifts their own valid state from /start and feeds it to a victim.
    // The victim's browser carries the victim's cookie, not the attacker's nonce.
    const attackerState = verifyState(signState('evil_dental', newNonce()))
    const victimCookie = newNonce()
    expect(nonceMatches(victimCookie, attackerState.nonce)).toBe(false)
  })

  it('rejects a missing cookie (no browser binding at all)', () => {
    expect(nonceMatches(undefined, NONCE)).toBe(false)
    expect(nonceMatches('', NONCE)).toBe(false)
    expect(nonceMatches(null, NONCE)).toBe(false)
  })

  it('rejects a missing state nonce', () => {
    expect(nonceMatches(NONCE, undefined)).toBe(false)
    expect(nonceMatches(NONCE, '')).toBe(false)
  })

  it('does not throw on length mismatch (timingSafeEqual would)', () => {
    expect(nonceMatches('short', 'a-much-longer-nonce-value')).toBe(false)
  })

  it('newNonce is unguessable and unique per call', () => {
    const a = newNonce(); const b = newNonce()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('redirect uri', () => {
  it('derives from the request origin so preview and prod each match their own', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    expect(igRedirectUri({ url: 'https://admin-portal-xi-two.vercel.app/api/meta/instagram/start' }))
      .toBe('https://admin-portal-xi-two.vercel.app/api/meta/instagram/callback')
    if (prev) process.env.NEXT_PUBLIC_SITE_URL = prev
  })
})
