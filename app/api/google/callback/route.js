/**
 * GET /api/google/callback?code=...&state=...
 *
 * Google redirects here after the clinic approves access. We verify the CSRF
 * nonce, exchange the code for a refresh token, read which Google account was
 * connected (its primary calendar id == the account email), and store the refresh
 * token in Supabase — on client_configs for the clinic's main calendar, or on the
 * doctor row for a per-doctor connect. The booking backend reads it from there.
 *
 * Whitelisted in middleware (returns cross-site from Google) but protected by the
 * nonce cookie set in /api/google/start.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function redirectUri(request) {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    `${new URL(request.url).origin}/api/google/callback`
  )
}

function back(request, path, qs) {
  const origin = new URL(request.url).origin
  const res = NextResponse.redirect(`${origin}${path}?${qs}`)
  res.cookies.delete('gcal_oauth_nonce')
  return res
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const stateRaw = searchParams.get('state')
  const oauthErr = searchParams.get('error')

  // Decode state early so we can route the redirect (clinic → /settings, doctor → /team).
  let state = null
  try {
    state = JSON.parse(Buffer.from(stateRaw || '', 'base64url').toString())
  } catch {
    /* handled below */
  }
  const dest = state && state.d ? '/team' : '/settings'

  if (oauthErr) return back(request, dest, `gcal=error&reason=${encodeURIComponent(oauthErr)}`)
  if (!code || !state) return back(request, dest, 'gcal=error&reason=missing_code')

  // CSRF: the nonce in state must match the httpOnly cookie set by /start.
  const cookieNonce = request.cookies.get('gcal_oauth_nonce')?.value
  if (!cookieNonce || cookieNonce !== state.n) {
    return back(request, dest, 'gcal=error&reason=csrf')
  }

  // Exchange the authorization code for tokens.
  let tokens
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(request),
        grant_type: 'authorization_code',
      }),
    })
    tokens = await tokenRes.json()
    if (!tokenRes.ok) {
      return back(request, dest, `gcal=error&reason=${encodeURIComponent(tokens.error || 'token_exchange')}`)
    }
  } catch {
    return back(request, dest, 'gcal=error&reason=token_exchange')
  }

  const refreshToken = tokens.refresh_token
  if (!refreshToken) {
    // No refresh token means a prior grant without prompt=consent. Ask them to
    // remove the app's access and reconnect.
    return back(request, dest, 'gcal=error&reason=no_refresh_token')
  }

  // Identify the connected account: the primary calendar id is the account email.
  let email = null
  try {
    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    if (calRes.ok) email = (await calRes.json()).id || null
  } catch {
    /* email is best-effort */
  }

  // Persist the refresh token (service role bypasses RLS).
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    if (state.d) {
      await sb
        .from('doctors')
        .update({ google_refresh_token: refreshToken, google_email: email })
        .eq('id', state.d)
    } else {
      await sb
        .from('client_configs')
        .update({ google_refresh_token: refreshToken, google_email: email, google_calendar_id: 'primary' })
        .eq('client_id', state.c)
    }
  } catch {
    return back(request, dest, 'gcal=error&reason=store_failed')
  }

  const qs =
    `gcal=connected` +
    (email ? `&email=${encodeURIComponent(email)}` : '') +
    (state.d ? `&doctor=${encodeURIComponent(state.d)}` : '')
  return back(request, dest, qs)
}
