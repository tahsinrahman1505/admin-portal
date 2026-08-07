import { describe, it, expect } from 'vitest'
import { isPublicPath, isLiveSession } from '../authGate'

/**
 * This is a security boundary — the auth gate every non-demo request passes
 * through. It shipped to production with a real bug: public/theme-init.js and
 * public/sw.js weren't in the allowlist, so every logged-out request for them
 * got redirected to /login and served back as HTML instead of JS. Found by
 * loading production directly and reading the browser console — nothing in
 * the prior test suite could have caught it, because every E2E test in this
 * repo runs against demo mode, which bypasses this file entirely.
 */

describe('isPublicPath — the regression this file exists to prevent', () => {
  it('lets root-level static files through', () => {
    expect(isPublicPath('/theme-init.js')).toBe(true)
    expect(isPublicPath('/sw.js')).toBe(true)
  })

  it('would let a FUTURE static file through too, without a code change', () => {
    // The fix is a pattern, not a per-filename list — a new file dropped in
    // public/ tomorrow must not reintroduce this bug.
    expect(isPublicPath('/manifest.json')).toBe(true)
    expect(isPublicPath('/robots.txt')).toBe(true)
    expect(isPublicPath('/apple-touch-icon.png')).toBe(true)
  })
})

describe('isPublicPath — must still gate everything that needs auth', () => {
  it('does not treat a real protected page as public', () => {
    // Next's page routing never puts a file extension in the URL, so the
    // static-file pattern can't accidentally shadow one of these.
    for (const p of ['/dashboard', '/conversations', '/leads', '/settings', '/team']) {
      expect(isPublicPath(p), `${p} must require auth`).toBe(false)
    }
  })

  it('does not treat a nested API route as public, even with an extension', () => {
    // The static-file pattern is bounded to ONE path segment specifically so
    // it can't allowlist something nested like this.
    expect(isPublicPath('/api/leads.json')).toBe(false)
    expect(isPublicPath('/api/rag/ingest')).toBe(false)
  })

  it('does not treat a nested public/ subpath as public', () => {
    expect(isPublicPath('/assets/theme-init.js')).toBe(false)
  })
})

describe('isPublicPath — the pre-existing allowlist', () => {
  it('allows the login page, Next internals, favicon, and the OAuth callback', () => {
    expect(isPublicPath('/login')).toBe(true)
    expect(isPublicPath('/_next/static/chunk.js')).toBe(true)
    expect(isPublicPath('/favicon.ico')).toBe(true)
    expect(isPublicPath('/api/google/callback')).toBe(true)
  })

  it('does not allowlist other /api/google/* routes by prefix', () => {
    expect(isPublicPath('/api/google/start')).toBe(false)
    expect(isPublicPath('/api/google/disconnect')).toBe(false)
  })
})

describe('isLiveSession', () => {
  const b64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const jwt = payload => `eyJhbGciOiJIUzI1NiJ9.${b64url(payload)}.sig`

  it('rejects a missing or empty cookie', () => {
    expect(isLiveSession(undefined)).toBe(false)
    expect(isLiveSession('')).toBe(false)
  })

  it('rejects a value that is not structurally a JWT', () => {
    expect(isLiveSession('not-a-jwt')).toBe(false)
    expect(isLiveSession('eyJ.onlytwoparts')).toBe(false)
    expect(isLiveSession('eyJ..emptymiddle')).toBe(false)
  })

  it('accepts a well-formed token with a future expiry', () => {
    const token = jwt({ exp: Math.floor(Date.now() / 1000) + 3600 })
    expect(isLiveSession(token)).toBe(true)
  })

  it('rejects an expired token', () => {
    const token = jwt({ exp: Math.floor(Date.now() / 1000) - 3600 })
    expect(isLiveSession(token)).toBe(false)
  })

  it('rejects a token whose payload is not valid base64/JSON', () => {
    expect(isLiveSession('eyJ.not-base64-json!!!.sig')).toBe(false)
  })

  it('rejects a token missing a numeric exp', () => {
    const token = jwt({ sub: 'user-1' })
    expect(isLiveSession(token)).toBe(false)
  })
})
