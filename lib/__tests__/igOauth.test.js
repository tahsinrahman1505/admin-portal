import { describe, it, expect, vi, beforeAll } from 'vitest'

// The module reads the secret at import time, so it has to be set first.
beforeAll(() => {
  process.env.META_IG_APP_SECRET = 'test-secret-for-hmac'
  process.env.META_IG_APP_ID = '1195496075978378'
})

const { signState, verifyState, igRedirectUri } = await import('../igOauth')

/**
 * `state` is the ONLY thing binding the OAuth round trip to a clinic — the
 * callback is a top-level redirect from instagram.com with no request body and
 * no guarantee of a usable session. If it can be forged, an attacker attaches
 * their own Instagram account to someone else's clinic row and starts receiving
 * that clinic's patient DMs. These tests exist for that one reason.
 */
describe('OAuth state binds the round trip to exactly one clinic', () => {
  it('round-trips a clinic id', () => {
    expect(verifyState(signState('dental_demo'))).toBe('dental_demo')
  })

  it('rejects a tampered payload (swap in another clinic)', () => {
    const good = signState('dental_demo')
    const [, sig] = good.split('.')
    const forgedPayload = Buffer.from(
      JSON.stringify({ cid: 'victim_clinic', ts: Date.now() }),
    ).toString('base64url')
    // Attacker keeps the valid signature but swaps the payload.
    expect(verifyState(`${forgedPayload}.${sig}`)).toBeNull()
  })

  it('rejects a tampered signature', () => {
    const [payload] = signState('dental_demo').split('.')
    expect(verifyState(`${payload}.not-a-real-signature`)).toBeNull()
  })

  it('rejects an unsigned bare clinic id', () => {
    expect(verifyState('dental_demo')).toBeNull()
  })

  it('rejects malformed / empty input without throwing', () => {
    for (const bad of ['', null, undefined, '.', 'a.b.c', 'garbage']) {
      expect(verifyState(bad)).toBeNull()
    }
  })

  it('rejects an expired state (older than the 10-minute TTL)', () => {
    const realNow = Date.now
    try {
      // Sign 11 minutes in the past.
      Date.now = () => realNow() - 11 * 60 * 1000
      const stale = signState('dental_demo')
      Date.now = realNow
      expect(verifyState(stale)).toBeNull()
    } finally {
      Date.now = realNow
    }
  })

  it('accepts a state still inside the TTL', () => {
    const realNow = Date.now
    try {
      Date.now = () => realNow() - 60 * 1000 // 1 minute ago
      const fresh = signState('dental_demo')
      Date.now = realNow
      expect(verifyState(fresh)).toBe('dental_demo')
    } finally {
      Date.now = realNow
    }
  })
})

describe('redirect uri', () => {
  it('is derived from the request origin so previews and prod each match their own', () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.NEXT_PUBLIC_SITE_URL
    const uri = igRedirectUri({ url: 'https://admin-portal-xi-two.vercel.app/api/meta/instagram/start' })
    expect(uri).toBe('https://admin-portal-xi-two.vercel.app/api/meta/instagram/callback')
    if (prev) process.env.NEXT_PUBLIC_SITE_URL = prev
  })
})
