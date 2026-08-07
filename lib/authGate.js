/**
 * Pure logic behind middleware.js's auth gate, extracted so it can be unit
 * tested — this is a security boundary and it had a real bug ship silently:
 * public/theme-init.js and public/sw.js were missing from the allowlist, so
 * every logged-out request for them got redirected to /login and served back
 * as HTML, and a <script src> tag refused to execute it (strict MIME
 * checking). Found only by loading production directly and reading the
 * console — nothing in the existing test suite could have caught it, because
 * Playwright runs against demo mode, which short-circuits this file entirely
 * (see middleware.js's first check).
 */

/**
 * Coarse pre-filter: the cookie must be a structurally valid JWT whose payload
 * decodes and carries a FUTURE expiry. Rejects a trivial forged string and an
 * expired token, so stale/unauthenticated requests are bounced to /login at
 * the edge.
 *
 * NOT the authoritative check — it does not verify the signature (middleware
 * carries no secret). Every privileged /api route independently does the
 * cryptographic check via getAuthedUser() → supabase.auth.getUser(). A token
 * forged with a future exp would pass here but still be rejected at the
 * route, so no privileged action can occur without a real token.
 */
export function isLiveSession(value) {
  if (!value || !value.startsWith('eyJ')) return false
  const parts = value.split('.')
  if (parts.length !== 3 || !parts.every(p => p.length > 0)) return false
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(b64))
    if (typeof payload.exp !== 'number') return false
    return payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

/**
 * A single-segment root path with a file extension — public/theme-init.js,
 * public/sw.js, and anything else dropped in public/ in future. Deliberately
 * a pattern, not a per-filename list, so the next static asset doesn't
 * reintroduce this exact bug.
 *
 * Bounded to ONE path segment so it can't accidentally allowlist something
 * nested (e.g. a hypothetical `/api/leads.json`) — Next's own page routing
 * never puts a file extension in a route URL, so this can't shadow a real
 * protected page either.
 */
const STATIC_FILE = /^\/[^/]+\.[a-z0-9]+$/i

/**
 * Should this request bypass the auth gate entirely?
 * NOTE: /api/* is intentionally NOT public — all proxy routes (/api/rag/*)
 * require authentication to prevent unauthenticated access to the RAG API
 * secret they carry. The one exception is the Google OAuth callback below,
 * which is protected by its own state nonce instead of the session cookie
 * (Google redirects cross-site after consent, so the cookie may not ride
 * along).
 */
export function isPublicPath(pathname) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    STATIC_FILE.test(pathname) ||
    pathname === '/api/google/callback'
  )
}
