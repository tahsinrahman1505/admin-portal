/**
 * Server-side authentication guard for API route handlers.
 *
 * The privileged /api/rag/* and /api/push/* proxy routes attach RAG_API_SECRET /
 * the Supabase service-role key and must NOT trust the edge middleware alone — the
 * middleware only does a structural cookie check, which is forgeable. Every
 * privileged route calls getAuthedUser() to CRYPTOGRAPHICALLY validate the caller's
 * Supabase access token (signature + expiry, via Supabase Auth) before doing any
 * privileged work. This mirrors the mobile API's verify_mobile_user pattern.
 */
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Server-only admin client (service-role key never reaches the browser). Used to
// (a) validate an arbitrary access token via auth.getUser(token), and
// (b) resolve the caller's clinic from the clients table, bypassing RLS safely
// since the caller has already been authenticated.
// Lazily constructed so a missing env var at build/import time can never throw.
let _admin = null
function getAdmin() {
  if (_admin) return _admin
  _admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  return _admin
}

/**
 * Public accessor for the server-only service-role client. Privileged routes that
 * need to read/write Supabase directly (e.g. /api/roster) use this instead of the
 * browser anon client. Service-role bypasses RLS, so callers MUST tenant-scope
 * their queries themselves (filter by the caller's botClientId).
 */
export function getAdminClient() {
  return getAdmin()
}

/**
 * Extract the caller's Supabase access token from the request: prefer an explicit
 * Authorization: Bearer header, fall back to the same-origin session cookie that
 * the portal sets at login (sb-portal-session).
 */
function extractToken(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const t = authHeader.slice(7).trim()
    if (t) return t
  }
  return request.cookies.get('sb-portal-session')?.value || ''
}

/**
 * Validate the caller and resolve their clinic.
 * Returns { user, portalClientId, botClientId, clientName } on success, or null if
 * the token is missing / invalid / expired (a forged "eyJ.eyJ.x" cookie fails here
 * because getUser checks the cryptographic signature with Supabase).
 */
export async function getAuthedUser(request) {
  // Demo mode: return a fixed demo identity so rag routes never 401. Any route
  // that also has a demoGuard() short-circuits before reaching real work; this is
  // the safety net for routes that don't. Gated by NEXT_PUBLIC_DEMO_MODE.
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return {
      user: { id: 'demo-user-0001', email: 'demo@tahsinai.com' },
      portalClientId: 'demo-client-0001',
      botClientId: 'demo_clinic',
      clientName: 'Marina Smile Dental — Abu Dhabi',
    }
  }

  const token = extractToken(request)
  if (!token) return null

  let user
  try {
    const { data, error } = await getAdmin().auth.getUser(token)
    if (error || !data?.user) return null
    user = data.user
  } catch {
    return null
  }

  // Resolve the caller's clinic (user_id → clients row). A valid auth user with no
  // clinic row is still authenticated, just not tenant-scoped.
  let clientRow = null
  try {
    const { data } = await getAdmin()
      .from('clients')
      .select('id, bot_client_id, client_name, user_id')
      .eq('user_id', user.id)
      .single()
    clientRow = data || null
  } catch {
    clientRow = null
  }

  return {
    user,
    portalClientId: clientRow?.id ?? null,
    botClientId: clientRow?.bot_client_id ?? null,
    clientName: clientRow?.client_name ?? null,
  }
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 })
}

/**
 * Tenant guard — DEFAULT-DENY.
 *
 * Returns null when the request is allowed, or a NextResponse (403) to return on
 * violation. Two independent denials:
 *
 *  1. No clinic mapping → DENY. An authenticated caller whose user_id has no
 *     `clients` row (botClientId === null) must never reach tenant-scoped data.
 *     This is critical because Supabase self-signup is open: anyone can register
 *     + confirm their own email and obtain a valid JWT, but they have no clinic.
 *     Previously this case returned "allow", which — combined with routes that
 *     source client_id from a caller-controlled param — let a self-registered
 *     stranger read/act on ANY clinic's patient data. Every real clinic account
 *     has a botClientId, so denying the null case affects no legitimate user.
 *
 *  2. Cross-tenant → DENY. A clinic-scoped caller targeting a different client_id
 *     is rejected (the original check).
 *
 * NOTE: if a genuine cross-clinic "admin/owner" account is ever needed, add an
 * explicit is_admin flag on the clients row and check it here — do NOT reinstate
 * the blanket null-botClientId allow.
 */
export function enforceTenant(auth, requestedClientId) {
  if (!auth?.botClientId) return forbidden('No clinic associated with this account')
  if (requestedClientId && requestedClientId !== auth.botClientId) {
    return forbidden('Client mismatch')
  }
  return null
}
