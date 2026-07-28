/**
 * POST /api/meta/whatsapp/connect   body: { code: string }
 *
 * Completes WhatsApp Embedded Signup for the LOGGED-IN clinic. Unlike the Google
 * Calendar connect (/api/google/start + /callback), Embedded Signup never
 * navigates the browser away — it's a popup-based JS SDK flow (FB.login), so the
 * session cookie is already present when the frontend posts the resulting code
 * here. No redirect/nonce dance needed: getAuthedUser() below IS the CSRF
 * protection, exactly like every other privileged route in this app.
 *
 * Multi-tenant safety: client_id is NEVER taken from the request or from the
 * client-supplied phone_number_id/waba_id in the frontend's WA_EMBEDDED_SIGNUP
 * message event — only from the authenticated session (auth.botClientId), same
 * rule as enforceTenant() elsewhere in lib/auth.js. The WABA/phone id we store
 * are independently re-fetched from Graph API using the exchanged token itself,
 * so we only ever persist assets that token actually has access to.
 *
 * NOTE before first live use: the exact token-exchange and phone-registration
 * call shapes below are built from Meta's general Graph OAuth pattern (the same
 * family used elsewhere in this codebase / ONBOARDING_SOP.md) and Meta's
 * Tech-Provider webhook docs — confirm both against Meta's current Embedded
 * Signup docs against a SANDBOX WABA before pointing this at a real clinic.
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

async function graphPost(path, token, body) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || `Graph POST ${path} failed (${res.status})`)
  return json
}

export async function POST(request) {
  // Auth first — an unauthenticated caller shouldn't learn whether this
  // feature is configured or not.
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return forbidden('No clinic on this account')

  if (!META_APP_ID || !META_APP_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'WhatsApp connect is not configured yet (META_APP_ID / META_APP_SECRET missing).' },
      { status: 503 },
    )
  }

  const { code } = await request.json().catch(() => ({}))
  if (!code) {
    return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 })
  }

  try {
    // 1. Exchange the short-lived authorization code for an access token.
    //    Embedded Signup (configured with Facebook Login for Business) issues a
    //    Business Integration System User token here — long-lived by design, no
    //    separate fb_exchange_token hop needed (unlike the manual Page-token flow
    //    in ONBOARDING_SOP.md, which generates a short-lived user token first).
    const tokenRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
      `?client_id=${META_APP_ID}&client_secret=${META_APP_SECRET}&code=${encodeURIComponent(code)}`,
    )
    const tokenJson = await tokenRes.json().catch(() => ({}))
    if (!tokenRes.ok || !tokenJson.access_token) {
      return NextResponse.json(
        { ok: false, error: tokenJson?.error?.message || 'Code exchange failed' },
        { status: 400 },
      )
    }
    const accessToken = tokenJson.access_token

    // 2. Independently verify what this token can actually see — never trust the
    //    frontend's WA_EMBEDDED_SIGNUP postMessage payload for what gets stored.
    //    debug_token confirms the token is real and (for a Tech Provider app)
    //    which WABA it's scoped to; we then re-fetch the phone number under that
    //    WABA so the two are proven to belong together, not just asserted by the
    //    client. debug_token must be authorized with OUR OWN app token
    //    (app_id|app_secret), not the token being inspected — standard Graph API
    //    rule, unrelated to embedded signup specifically.
    const appToken = `${META_APP_ID}|${META_APP_SECRET}`
    const debug = await graphGet(`/debug_token?input_token=${encodeURIComponent(accessToken)}`, appToken)
    const granularScopes = debug?.data?.granular_scopes || []
    const wabaScope = granularScopes.find((s) => s.scope === 'whatsapp_business_management')
    const wabaId = wabaScope?.target_ids?.[0]
    if (!wabaId) {
      return NextResponse.json(
        { ok: false, error: 'Token has no WhatsApp Business Account access' },
        { status: 400 },
      )
    }

    const phoneNumbers = await graphGet(`/${wabaId}/phone_numbers`, accessToken)
    const phone = phoneNumbers?.data?.[0]
    if (!phone?.id) {
      return NextResponse.json(
        { ok: false, error: 'No phone number found on this WhatsApp Business Account' },
        { status: 400 },
      )
    }

    // 3. Subscribe our app to this WABA so we start receiving message webhooks
    //    for it (mirrors the manual "Register the webhook" step in the SOP).
    await graphPost(`/${wabaId}/subscribed_apps`, accessToken, {})

    // 4. Persist — scoped to the AUTHENTICATED clinic only.
    const sb = createClient(SUPABASE_URL, SERVICE_KEY)
    const { error: dbError } = await sb
      .from('client_configs')
      .update({
        phone_number_id: phone.id,
        whatsapp_token: accessToken,
        whatsapp_business_account_id: wabaId,
        whatsapp_connected_at: new Date().toISOString(),
      })
      .eq('client_id', auth.botClientId)
    if (dbError) throw dbError

    return NextResponse.json({
      ok: true,
      phoneNumberId: phone.id,
      displayPhoneNumber: phone.display_phone_number || null,
      wabaId,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
