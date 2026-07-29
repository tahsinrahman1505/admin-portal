/**
 * POST /api/meta/social/connect   body: { accessToken: string }
 *
 * Completes Facebook Login for Business for the LOGGED-IN clinic's Messenger +
 * Instagram access. Uses the JS SDK's default implicit token flow (FB.login()
 * with a config_id, no response_type: 'code') — the frontend hands over the
 * short-lived User token from response.authResponse.accessToken directly, no
 * code-for-token exchange step, so no redirect_uri to keep in sync between
 * client and server (that's what a code-based version kept failing on).
 * Same session-cookie auth as /api/meta/whatsapp/connect — no redirect/nonce
 * dance needed since this never navigates the page away.
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

  const { accessToken: shortLivedToken } = await request.json().catch(() => ({}))
  if (!shortLivedToken) {
    return NextResponse.json({ ok: false, error: 'Missing accessToken' }, { status: 400 })
  }

  try {
    // 1. Exchange the short-lived User token the JS SDK's implicit flow
    //    already handed back for a long-lived one, then derive a non-expiring
    //    Page token from it via /me/accounts — same pattern used to refresh
    //    dental_demo's Page token manually earlier this session. No
    //    code-for-token exchange here (no redirect_uri to keep in sync).
    const longLivedRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
      `?grant_type=fb_exchange_token&client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}` +
      `&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`,
    )
    const longLivedJson = await longLivedRes.json().catch(() => ({}))
    if (!longLivedRes.ok || !longLivedJson.access_token) {
      return NextResponse.json(
        { ok: false, error: longLivedJson?.error?.message || 'Long-lived token exchange failed' },
        { status: 400 },
      )
    }

    // 2. /me/accounts only needs pages_show_list — asking for
    //    instagram_business_account as a FIELD here (rather than a separate
    //    GET /{page-id}) avoids needing pages_read_engagement, which we
    //    deliberately don't request (nothing in the product reads Page
    //    engagement data).
    const accounts = await graphGet('/me/accounts?fields=id,name,access_token,instagram_business_account', longLivedJson.access_token)
    const page = accounts?.data?.[0]
    if (!page?.id || !page?.access_token) {
      return NextResponse.json(
        { ok: false, error: 'No Facebook Page found for this account' },
        { status: 400 },
      )
    }

    const igId = page?.instagram_business_account?.id || null
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
