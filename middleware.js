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
 *
 * The actual allow/deny logic lives in lib/authGate.js, as plain functions
 * with no Next.js/Edge dependency — so it's unit-testable, which is how the
 * missing-static-file bug this file's history carries was caught and fixed.
 */

import { NextResponse } from 'next/server'
import { isLiveSession, isPublicPath } from '@/lib/authGate'

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Demo mode (demo.tahsinai.com): zero-login showcase. Let every request through
  // — there is no real data or secret behind it (mock supabase client + seeded
  // /api/rag responses). Gated by NEXT_PUBLIC_DEMO_MODE so production is untouched.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Check for the session cookie containing the Supabase access token (JWT).
  // Set at login by login/page.js and refreshed by layout.js onAuthStateChange.
  const sessionToken = request.cookies.get('sb-portal-session')?.value

  if (!isLiveSession(sessionToken)) {
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
