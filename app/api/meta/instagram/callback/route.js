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
  IG_APP_ID, IG_APP_SECRET, igRedirectUri, verifyState,
  exchangeCodeForToken, exchangeForLongLived, fetchIgIdentity,
} from '@/lib/igOauth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function back(request, params) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const url = new URL('/channels', origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url.toString())
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

  // Tenant comes from the SIGNED state only. An unsigned/expired/tampered state
  // is refused outright — otherwise a crafted callback could attach an attacker's
  // Instagram account to someone else's clinic row.
  const botClientId = verifyState(state)
  if (!botClientId) return back(request, { ig: 'error', reason: 'Invalid or expired session, please try again' })

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
    const { data: clash } = await sb
      .from('client_configs')
      .select('client_id')
      .eq('ig_business_id', igBusinessId)
      .neq('client_id', botClientId)
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
