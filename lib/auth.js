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
 * Tenant guard: if the caller is clinic-scoped (has a botClientId) and the request
 * targets a different client_id, reject it. Callers with no botClientId (e.g. an
 * admin/owner account not bound to a single clinic) are allowed through — they have
 * already passed authentication. Returns a NextResponse to return on violation, or
 * null when the request is allowed.
 */
export function enforceTenant(auth, requestedClientId) {
  if (!requestedClientId) return null
  if (!auth.botClientId) return null
  if (requestedClientId !== auth.botClientId) {
    return forbidden('Client mismatch')
  }
  return null
}
