/**
 * GET /api/meta/instagram/callback?code=…&state=…
 *
 * Completes Instagram Login OAuth and stores the clinic's Instagram USER access
 * token — the credential Instagram messaging actually requires (see
 * lib/igOauth.js for why the Facebook Page token cannot work here).
 *
 * Reached by a top-level redirect from instagram.com, so it answers with a
 * redirect back into the portal rather than JSON: the browser is showing this
 * URL to a human.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  IG_APP_ID, IG_APP_SECRET, IG_NONCE_COOKIE, igRedirectUri, verifyState, nonceMatches,
  exchangeCodeForToken, exchangeForLongLived, fetchIgIdentity,
} from '@/lib/igOauth'
import { getAuthedUser } from '@/lib/auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function back(request, params) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const url = new URL('/channels', origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = NextResponse.redirect(url.toString())
  // Always burn the nonce, on success AND on every failure path. It is
  // single-use by design; leaving it alive would let a replayed callback reuse
  // a still-valid browser binding.
  res.cookies.set(IG_NONCE_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  return res
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)

  // The user can decline on Instagram's consent screen — that is a normal
  // outcome, not an error worth surfacing as a failure.
  const denied = searchParams.get('error')
  if (denied) {
    return back(request, { ig: 'cancelled', reason: searchParams.get('error_description') || denied })
  }

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  if (!code || !state) return back(request, { ig: 'error', reason: 'Missing code or state' })

  if (!IG_APP_ID || !IG_APP_SECRET) {
    return back(request, { ig: 'error', reason: 'Instagram connect not configured' })
  }

  // ── Tenant binding, three independent checks ────────────────────────────────
  // 1. SIGNED state: nobody can hand-craft a state naming another clinic.
  const verified = verifyState(state)
  if (!verified) return back(request, { ig: 'error', reason: 'Invalid or expired session, please try again' })
  const { cid: botClientId, nonce: stateNonce } = verified

  // 2. NONCE cookie: proves THIS browser is the one that started the flow.
  //    Without it, a signature alone is insufficient — any clinic could lift
  //    their own valid state out of /start's redirect, phish a victim clinic
  //    owner with an authorize link carrying it, and have the victim's
  //    Instagram token written onto the attacker's row (send DMs as the victim
  //    clinic; receive the victim's inbound patient DMs). Signed-but-unbound
  //    state was a real hole in the first version of this route.
  const cookieNonce = request.cookies.get(IG_NONCE_COOKIE)?.value
  if (!nonceMatches(cookieNonce, stateNonce)) {
    return back(request, { ig: 'error', reason: 'Security check failed, please start the connection again' })
  }

  // 3. SESSION, when present: the logged-in clinic must be the one in the state.
  //    Defence in depth — if a session cookie rides along (it normally does on a
  //    same-site top-level redirect), a mismatch means something is wrong even
  //    if 1 and 2 somehow passed. Absent session is tolerated rather than
  //    fatal, because SameSite/browser behaviour on the return leg is not
  //    guaranteed and 1+2 already bind the flow.
  const auth = await getAuthedUser(request).catch(() => null)
  if (auth?.botClientId && auth.botClientId !== botClientId) {
    return back(request, { ig: 'error', reason: 'Session does not match this connection request' })
  }

  try {
    const { token: shortToken } = await exchangeCodeForToken(code, igRedirectUri(request))
    const { token, expiresIn, longLived } = await exchangeForLongLived(shortToken)
    const { igBusinessId, username } = await fetchIgIdentity(token)

    if (!igBusinessId) {
      return back(request, { ig: 'error', reason: 'Could not read the Instagram account id' })
    }

    // Refuse to attach an Instagram account that another clinic already claims.
    // The bot resolves inbound messages by ig_business_id, so two rows sharing
    // one account makes that lookup ambiguous — the exact fault that silently
    // switched Instagram between tenants on 2026-08-13. Better to block the
    // connect with a clear message than to create the ambiguity.
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: clash, error: clashErr } = await sb
      .from('client_configs')
      .select('client_id')
      .eq('ig_business_id', igBusinessId)
      .neq('client_id', botClientId)
    // Fail CLOSED if the check itself failed. Discarding this error meant `data`
    // came back null on any transient Supabase blip, the guard evaluated false,
    // and we fell straight through to the write — silently recreating the
    // two-clinics-one-Instagram-account ambiguity that flipped Instagram between
    // tenants on 2026-08-13. A guard that only works when the database is
    // healthy is not a guard.
    if (clashErr) {
      return back(request, { ig: 'error', reason: 'Could not verify account ownership, please try again' })
    }
    if (clash && clash.length > 0) {
      return back(request, {
        ig: 'error',
        reason: `That Instagram account is already connected to another clinic (${clash[0].client_id}). Disconnect it there first.`,
      })
    }

    const { error: dbError } = await sb
      .from('client_configs')
      .update({
        ig_business_id: igBusinessId,
        ig_username: username,
        ig_user_access_token: token,
      })
      .eq('client_id', botClientId)
    if (dbError) throw dbError

    return back(request, {
      ig: 'connected',
      username: username || '',
      // Surfaced so the UI can warn when we are running on a short-lived token
      // (long-lived exchange failed) instead of pretending the connection is
      // durable and having replies die an hour later.
      longLived: String(longLived),
      ...(expiresIn ? { expiresIn: String(expiresIn) } : {}),
    })
  } catch (e) {
    return back(request, { ig: 'error', reason: String(e?.message || e).slice(0, 200) })
  }
}
