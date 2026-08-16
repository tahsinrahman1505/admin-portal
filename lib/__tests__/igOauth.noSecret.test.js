import { describe, it, expect } from 'vitest'

/**
 * Separate file, on purpose: this one must import lib/igOauth with
 * META_IG_APP_SECRET genuinely ABSENT, and the module reads it at import time —
 * so the two configurations cannot share a module instance (Vitest isolates
 * files, not describe blocks).
 *
 * What it pins down: crypto.createHmac('sha256', '') does NOT throw in Node, it
 * returns a perfectly normal digest. So the original `process.env.X || ''`
 * default meant an unset secret produced signatures ANYONE could reproduce —
 * forgery with no secret at all, collapsing tenant binding into "attacker picks
 * the clinic". It was contained only because both callers happened to check the
 * secret first; a future caller (token-refresh cron, webhook verifier) that
 * forgot would silently reopen it.
 *
 * Missing config must verify NOTHING, never everything.
 */
delete process.env.META_IG_APP_SECRET

const { signState, verifyState, IG_APP_SECRET } = await import('../igOauth')

describe('with META_IG_APP_SECRET missing, the primitive fails CLOSED', () => {
  it('the module genuinely has no secret (guards this file being vacuous)', () => {
    expect(IG_APP_SECRET).toBeFalsy()
  })

  it('signState refuses to mint a state rather than signing with an empty key', () => {
    expect(() => signState('dental_demo', 'a'.repeat(32))).toThrow(/META_IG_APP_SECRET/)
  })

  it('verifyState rejects a state forged with the empty key', () => {
    // Exactly what an attacker would compute if '' were accepted as the key.
    const crypto = require('crypto')
    const payload = Buffer.from(
      JSON.stringify({ cid: 'victim_clinic', ts: Date.now(), n: 'a'.repeat(32) }),
    ).toString('base64url')
    const forged = crypto.createHmac('sha256', '').update(payload).digest('base64url')

    // Sanity: the empty key really does produce a usable digest — this is the
    // trap being guarded, not a hypothetical.
    expect(forged).toMatch(/^[A-Za-z0-9_-]{43}$/)

    expect(verifyState(`${payload}.${forged}`)).toBeNull()
  })

  it('verifyState returns null rather than throwing, so callers cannot 500 on it', () => {
    expect(verifyState('anything.at-all')).toBeNull()
  })
})
