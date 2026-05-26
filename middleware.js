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

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Always allow: login page, Next.js internals, static files
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api')   // Next.js API routes if added later

  if (isPublic) {
    return NextResponse.next()
  }

  // Check for Supabase auth cookie (set by supabase-js on sign-in).
  // Cookie name format: sb-<project-ref>-auth-token
  const cookies = request.cookies
  const hasSession = [...cookies.getAll()].some(
    c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value
  )

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    // Preserve the original destination so we can redirect back after login
    loginUrl.searchParams.set('next', pathname)
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
