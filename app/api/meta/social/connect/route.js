/**
 * POST /api/meta/social/connect   body: { code: string }
 *
 * Completes Facebook Login for Business for the LOGGED-IN clinic's Messenger +
 * Instagram access. Same popup-based FB.login() pattern as the WhatsApp
 * Embedded Signup connect route (no config_id needed here — this uses a plain
 * `scope` request, not the WhatsApp-specific Embedded Signup product), so the
 * frontend can post the resulting code straight through the existing session
 * cookie — no redirect/nonce dance needed, same as /api/meta/whatsapp/connect.
 *
 * Multi-tenant safety: client_id is NEVER taken from the request — only from
 * the authenticated session (auth.botClientId), same rule as everywhere else
 * in this file family.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized, forbidden } from '@/lib/auth'

const META_APP_ID = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || ''
const META_APP_SECRET = process.env.META_APP_SECRET || ''
const GRAPH_VERSION = 'v21.0'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function graphGet(path, token) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || `Graph GET ${path} failed (${res.status})`)
  return json
}

export async function POST(request) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return forbidden('No clinic on this account')

  if (!META_APP_ID || !META_APP_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Social connect is not configured yet (META_APP_ID / META_APP_SECRET missing).' },
      { status: 503 },
    )
  }

  const { code, redirectUri } = await request.json().catch(() => ({}))
  if (!code) {
    return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 })
  }
  if (!redirectUri) {
    return NextResponse.json({ ok: false, error: 'Missing redirectUri' }, { status: 400 })
  }

  try {
    // 1. Exchange the short-lived authorization code for a short-lived user
    //    token. redirect_uri must match EXACTLY what FB.login() was called
    //    with (Meta validates it), or this fails with "Error validating
    //    verification code" — the JS SDK popup doesn't supply one implicitly
    //    for response_type: 'code', so the frontend sets it explicitly and
    //    passes the same value through here.
    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
      `?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&code=${encodeURIComponent(code)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`,
    )
    const tokenJson = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !tokenJson.access_token) {
      return NextResponse.json(
        { ok: false, error: tokenJson?.error?.message || 'Code exchange failed' },
        { status: 400 },
      )
    }

    // 2. Exchange for a long-lived user token, then derive a non-expiring Page
    //    token from it via /me/accounts — same pattern used to refresh
    //    dental_demo's Page token manually earlier this session.
    const longLivedRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}` +
      `&fb_exchange_token=${encodeURIComponent(tokenJson.access_token)}`,
    )
    const longLivedJson = await longLivedRes.json().catch(() => ({}))
    if (!longLivedRes.ok || !longLivedJson.access_token) {
      return NextResponse.json(
        { ok: false, error: longLivedJson?.error?.message || 'Long-lived token exchange failed' },
        { status: 400 },
      )
    }

    const accounts = await graphGet('/me/accounts', longLivedJson.access_token)
    const page = accounts?.data?.[0]
    if (!page?.id || !page?.access_token) {
      return NextResponse.json(
        { ok: false, error: 'No Facebook Page found for this account' },
        { status: 400 },
      )
    }

    // 3. Independently verify what the Page token can actually see, and look
    //    up its linked Instagram business account if any — never trust
    //    anything the frontend claims, only what the token itself proves.
    const pageDetails = await graphGet(`/${page.id}?fields=instagram_business_account`, page.access_token)
    const igId = pageDetails?.instagram_business_account?.id || null
    let igUsername = null
    if (igId) {
      try {
        const ig = await graphGet(`/${igId}?fields=username`, page.access_token)
        igUsername = ig?.username || null
      } catch { /* IG lookup is best-effort; Page connect still succeeds without it */ }
    }

    // 4. Persist — scoped to the AUTHENTICATED clinic only.
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const { error: dbError } = await sb
      .from('client_configs')
      .update({
        fb_page_id: page.id,
        fb_page_access_token: page.access_token,
        ig_business_id: igId,
        ig_username: igUsername,
      })
      .eq('client_id', auth.botClientId)
    if (dbError) throw dbError

    return NextResponse.json({
      ok: true,
      pageId: page.id,
      pageName: page.name || null,
      igBusinessId: igId,
      igUsername,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
