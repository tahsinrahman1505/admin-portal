/**
 * Next.js Edge Middleware — server-side auth guard.
 *
 * Runs before every request (except static assets and the login page).
 * Checks for the Supabase session cookie and redirects to /login if missing.
 * This is a defence-in-depth layer on top of the client-side useEffect checks
 * already in each page component.
 *
 * Uses the raw cookie approach (no extra packages needed — works with
 * @supabase/supabase-js v2 directly in Edge Runtime).
 */

import { NextResponse } from 'next/server'

/**
 * Coarse pre-filter: the cookie must be a structurally valid JWT whose payload
 * decodes and carries a FUTURE expiry. This rejects the trivial forgery (a static
 * "eyJ.eyJ.x" string won't decode to JSON with a numeric exp) and expired tokens,
 * so unauthenticated/stale requests are bounced to /login at the edge.
 *
 * This is NOT the authoritative auth check — it does not verify the signature
 * (middleware carries no secret). Every privileged /api route independently does
 * the cryptographic check via getAuthedUser() → supabase.auth.getUser(). A token
 * that is forged but crafted to carry a future exp would pass here yet still be
 * rejected at the route, so no privileged action can occur without a real token.
 */
function isLiveSession(value) {
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

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Demo mode (demo.tahsinai.com): zero-login showcase. Let every request through
  // — there is no real data or secret behind it (mock supabase client + seeded
  // /api/rag responses). Gated by NEXT_PUBLIC_DEMO_MODE so production is untouched.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.next()
  }

  // Always allow: login page, Next.js internals, static files only.
  // NOTE: /api/* is intentionally NOT whitelisted — all proxy routes
  // (/api/rag/*) require authentication to prevent unauthenticated access
  // to the RAG API secret they carry.
  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    // Google redirects here cross-site after consent, so the session cookie may
    // not ride along. The route is instead protected by the OAuth state nonce.
    pathname === '/api/google/callback'

  if (isPublic) {
    return NextResponse.next()
  }

  // Check for the session cookie containing the Supabase access token (JWT).
  // Set at login by login/page.js and refreshed by layout.js onAuthStateChange.
  const cookies = request.cookies
  const sessionToken = cookies.get('sb-portal-session')?.value
  const hasSession = isLiveSession(sessionToken)

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the original destination so we can redirect back after login.
    // Validate it is a relative path to prevent open-redirect attacks.
    if (pathname.startsWith('/') && !pathname.startsWith('//')) {
      loginUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
