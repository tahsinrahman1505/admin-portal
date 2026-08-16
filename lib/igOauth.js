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
// Deliberately NOT defaulted to '' — see requireSecret(). An empty string is a
// VALID HMAC key in Node, so `|| ''` would silently turn "misconfigured" into
// "every signature forgeable by anyone".
export const IG_APP_SECRET = process.env.META_IG_APP_SECRET

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

export const IG_NONCE_COOKIE = 'ig_oauth_nonce'

/**
 * Fail closed when the signing key is missing.
 *
 * crypto.createHmac('sha256', '') does NOT throw — it happily returns a normal
 * digest. So an unset META_IG_APP_SECRET combined with a `|| ''` default made
 * every state forgeable by anyone (HMAC-SHA256 over the empty key is something
 * an attacker can compute too), collapsing the whole tenant binding into
 * "attacker picks the clinic". That was only contained by accident, because
 * both current callers happened to check the secret first. Enforcing it inside
 * the primitive means a future caller — a token-refresh cron, a webhook
 * verifier — cannot reopen the hole by forgetting that check.
 */
function requireSecret() {
  if (!IG_APP_SECRET) throw new Error('META_IG_APP_SECRET is not configured')
  return IG_APP_SECRET
}

/** Random, unguessable value tying one OAuth round trip to one browser. */
export function newNonce() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Bind the OAuth round trip to ONE clinic AND ONE browser.
 *
 * The callback is a top-level browser redirect from instagram.com, so it must
 * carry the tenant itself rather than trusting a request body. The clinic id is
 * HMAC-signed so a caller cannot swap in another clinic's id.
 *
 * The signature alone is NOT enough, and an earlier version of this file got
 * that wrong. A signed state proves *which tenant asked*; it does not prove
 * *this browser asked*. Any clinic with a portal login could call /start, copy
 * their own valid state out of the redirect, and send a victim clinic owner an
 * authorize link carrying it — a pretext that writes itself while clinics are
 * being told to go connect Instagram. The victim consents, and the callback
 * receives the VICTIM's code with the ATTACKER's state, writing the victim's
 * Instagram token onto the attacker's row: DMs sendable as the victim clinic,
 * and inbound patient DMs routed to the attacker's tenant.
 *
 * So state also carries a nonce that must match an httpOnly cookie set on the
 * same browser at /start — the identical defence already used by the Google
 * Calendar flow in this repo (app/api/google/start/route.js).
 */
export function signState(botClientId, nonce) {
  const secret = requireSecret()
  const payload = Buffer.from(
    JSON.stringify({ cid: botClientId, ts: Date.now(), n: nonce }),
  ).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

/**
 * Returns { cid, nonce } when the state is authentic and fresh, else null.
 * The CALLER must still compare `nonce` against the cookie — verifyState cannot
 * see cookies, and returning the nonce rather than a bare cid is what forces
 * that comparison to be a deliberate step.
 */
export function verifyState(state) {
  let secret
  try {
    secret = requireSecret()
  } catch {
    return null   // misconfigured verifies nothing, rather than verifying everything
  }
  if (!state || typeof state !== 'string' || !state.includes('.')) return null
  const [payload, sig] = state.split('.')
  if (!payload || !sig) return null
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  let parsed
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
  if (!parsed?.cid || typeof parsed.ts !== 'number' || !parsed.n) return null
  if (Date.now() - parsed.ts > STATE_TTL_MS) return null
  return { cid: parsed.cid, nonce: parsed.n }
}

/** Constant-time nonce comparison (cookie vs state). */
export function nonceMatches(cookieNonce, stateNonce) {
  if (!cookieNonce || !stateNonce) return false
  const a = Buffer.from(String(cookieNonce))
  const b = Buffer.from(String(stateNonce))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
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
