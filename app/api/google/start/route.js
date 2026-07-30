/**
 * GET /api/google/start?doctor_id=<optional>
 *
 * Begins the self-serve Google Calendar connect. Builds the Google consent URL
 * (offline access + prompt=consent so we always get a refresh token) and 302s the
 * clinic user to Google. A random nonce is stored in an httpOnly cookie and echoed
 * in `state` — the callback rejects any response whose state nonce doesn't match,
 * which blocks CSRF / forged callbacks.
 *
 * This route sits BEHIND the auth middleware (only a logged-in clinic user can
 * start a connect). The callback is whitelisted because it returns cross-site
 * from Google, but is protected by the nonce.
 */
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAuthedUser, unauthorized, forbidden } from '@/lib/auth'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/calendar'

function redirectUri(request) {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${new URL(request.url).origin}/api/google/callback`
  )
}

export async function GET(request) {
  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured yet (GOOGLE_OAUTH_CLIENT_ID missing).' },
      { status: 503 },
    )
  }

  // Require a real, clinic-mapped session before starting an OAuth connect. This
  // route writes a Google refresh token to client_configs WHERE client_id = state.c
  // in the callback, so a caller with no clinic (self-registered account) or a
  // forged-but-unverifiable cookie must not be able to initiate a connect against
  // a fallback clinic. (Previously fell back to NEXT_PUBLIC_CLIENT_ID.)
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return forbidden('No clinic associated with this account')
  const clientId = auth.botClientId

  const { searchParams } = new URL(request.url)
  const doctorId = searchParams.get('doctor_id') || ''
  const nonce = crypto.randomBytes(16).toString('hex')

  // state carries: clinic client_id, optional doctor_id, and the CSRF nonce.
  const state = Buffer.from(
    JSON.stringify({ c: clientId, d: doctorId, n: nonce }),
  ).toString('base64url')

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(request),
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  )
  res.cookies.set('gcal_oauth_nonce', nonce, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax', // sent on the top-level GET redirect back from Google
    path: '/',
    maxAge: 600,
  })
  return res
}
