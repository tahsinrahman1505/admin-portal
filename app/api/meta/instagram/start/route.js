/**
 * GET /api/meta/instagram/start
 *
 * Kicks off Instagram Login OAuth for the LOGGED-IN clinic. Redirects the
 * browser to instagram.com's consent screen; Instagram then redirects back to
 * /api/meta/instagram/callback with a code.
 *
 * This is a top-level navigation (not fetch) because the OAuth consent screen
 * has to render in the address bar. The clinic is carried across the round trip
 * in a signed `state` rather than a request body — see lib/igOauth.js.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, forbidden } from '@/lib/auth'
import { IG_APP_ID, IG_APP_SECRET, IG_SCOPES, igRedirectUri, signState } from '@/lib/igOauth'

export async function GET(request) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return forbidden('No clinic on this account')

  if (!IG_APP_ID || !IG_APP_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Instagram connect is not configured (META_IG_APP_ID / META_IG_APP_SECRET missing).' },
      { status: 503 },
    )
  }

  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', IG_APP_ID)
  url.searchParams.set('redirect_uri', igRedirectUri(request))
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', IG_SCOPES)
  url.searchParams.set('state', signState(auth.botClientId))
  // Forces the account chooser instead of silently reusing whatever Instagram
  // session the browser already has — a clinic owner logged into a personal
  // account would otherwise connect the wrong one without ever being asked.
  url.searchParams.set('force_reauth', 'true')

  return NextResponse.redirect(url.toString())
}
