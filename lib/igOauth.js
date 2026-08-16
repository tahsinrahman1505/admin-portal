/**
 * Instagram Login OAuth — shared helpers for the start/callback route pair.
 *
 * WHY THIS EXISTS AT ALL (it looks redundant next to /api/meta/social/connect,
 * which already connects Messenger + Instagram via Facebook Login for Business):
 *
 * There are two different Instagram messaging products, and this app is on the
 * newer one:
 *   - "Instagram API with Facebook Login" (legacy): send via
 *     graph.facebook.com/{ig-id}/messages using the Facebook PAGE token.
 *   - "Instagram API with Instagram Login" (what we use): send via
 *     graph.instagram.com/{ig-id}/messages using an Instagram USER token,
 *     issued by a SEPARATE Instagram app (its own app id AND app secret).
 *
 * Verified live 2026-08-13, both directions:
 *   - Page token against graph.instagram.com  -> "Cannot parse access token"
 *   - Page token against the legacy FB path   -> "(#3) Application does not
 *     have the capability to make this API call"
 * So the Facebook-Login connect route can NEVER produce a working Instagram
 * setup for this app, no matter what it stores. A clinic that connected via
 * that route got a Page token + ig_business_id and looked connected, while
 * every reply silently failed. That is the exact state Instagram sat in for 12
 * days. This flow is the missing half.
 *
 * The token this yields is long-lived (~60 days) and REFRESHABLE, unlike the
 * one-off token pasted from the App Dashboard — see refreshIgToken().
 */
import crypto from 'crypto'

export const IG_APP_ID = process.env.META_IG_APP_ID || ''
export const IG_APP_SECRET = process.env.META_IG_APP_SECRET || ''

// Scopes must match what App Review approved for this app. instagram_business_basic
// is required to identify the account; instagram_business_manage_messages is the
// one that actually permits sending replies.
export const IG_SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
].join(',')

export function igRedirectUri(request) {
  // Derived from the incoming request so preview deploys and production each
  // use their own callback, instead of a hardcoded origin that only matches one
  // of them. Every origin used must be registered in the Meta dashboard.
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  return `${origin}/api/meta/instagram/callback`
}

const STATE_TTL_MS = 10 * 60 * 1000  // 10 minutes — an OAuth round trip is seconds

/**
 * Bind the OAuth round trip to ONE clinic, tamper-proof.
 *
 * The callback is a top-level browser redirect from instagram.com, so it must
 * carry the tenant itself rather than trusting anything request-scoped. The
 * clinic id is HMAC-signed with the app secret, so a caller cannot swap in
 * another clinic's id and have their Instagram account written onto that
 * clinic's row — the same "never take client_id from the request" rule the rest
 * of the API family follows, adapted to a flow where there is no fetch body.
 */
export function signState(botClientId) {
  const payload = Buffer.from(JSON.stringify({ cid: botClientId, ts: Date.now() })).toString('base64url')
  const sig = crypto.createHmac('sha256', IG_APP_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyState(state) {
  if (!state || !state.includes('.')) return null
  const [payload, sig] = state.split('.')
  const expected = crypto.createHmac('sha256', IG_APP_SECRET).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
  if (!parsed?.cid || typeof parsed.ts !== 'number') return null
  if (Date.now() - parsed.ts > STATE_TTL_MS) return null
  return parsed.cid
}

/** Authorization-code -> short-lived (~1h) Instagram user token. */
export async function exchangeCodeForToken(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: IG_APP_ID,
    client_secret: IG_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  })
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token) {
    throw new Error(json?.error_message || json?.error?.message || 'Instagram code exchange failed')
  }
  return { token: json.access_token, userId: String(json.user_id || '') }
}

/**
 * Short-lived -> long-lived (~60 day) token.
 *
 * Best-effort on purpose: a working short-lived token is strictly better than
 * failing the whole connect. The dashboard-generated token used for the initial
 * hotfix could not be exchanged at all (code 452 "Session key invalid") because
 * it never came from this OAuth flow; tokens that DO come from here exchange
 * normally.
 */
export async function exchangeForLongLived(shortToken) {
  const url = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token` +
    `&client_secret=${encodeURIComponent(IG_APP_SECRET)}&access_token=${encodeURIComponent(shortToken)}`
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.access_token) return { token: shortToken, expiresIn: null, longLived: false }
  return { token: json.access_token, expiresIn: json.expires_in ?? null, longLived: true }
}

/** Identify the account the token belongs to (id here is the IG Business Account id). */
export async function fetchIgIdentity(token) {
  const res = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=id,username,user_id&access_token=${encodeURIComponent(token)}`,
  )
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'Instagram identity lookup failed')
  // `user_id` is the IG Business Account id that webhooks arrive under and that
  // resolve_client_by_ig() matches on; `id` is the app-scoped id. Storing the
  // wrong one means inbound messages never resolve to this clinic.
  return {
    igBusinessId: String(json.user_id || json.id || ''),
    username: json.username || null,
  }
}
