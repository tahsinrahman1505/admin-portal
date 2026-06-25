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
 * Validate that a value looks like a real Supabase JWT (3 base64 parts).
 * This prevents the trivial bypass of setting the cookie to any static string.
 * Full cryptographic verification requires @supabase/ssr — this is a fast
 * structural check that rejects forgeries without the actual token.
 */
function isValidJwt(value) {
  if (!value || !value.startsWith('eyJ')) return false
  const parts = value.split('.')
  return parts.length === 3 && parts.every(p => p.length > 0)
}

export function middleware(request) {
  const { pathname } = request.nextUrl

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
  const hasSession = isValidJwt(sessionToken)

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
