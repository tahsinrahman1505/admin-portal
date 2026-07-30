/**
 * POST /api/google/disconnect   body: { doctor_id?: string }
 *
 * Clears the stored Google refresh token for the clinic (client_configs) or a
 * specific doctor. Behind the auth middleware (logged-in clinic users only).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser, unauthorized, forbidden } from '@/lib/auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request) {
  // Require a real, clinic-mapped session. Previously this proceeded even when
  // getAuthedUser returned null (relying on middleware, which only structurally
  // checks the cookie) and fell back to a fixed env client_id — so an
  // unmapped/forged caller could clear calendar tokens.
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return forbidden('No clinic associated with this account')
  const clientId = auth.botClientId

  let doctorId = ''
  try {
    doctorId = (await request.json())?.doctor_id || ''
  } catch {
    /* no body → clinic-level disconnect */
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    if (doctorId) {
      // Scope the doctor update to the caller's OWN clinic so a doctor_id from
      // another tenant can't be touched (the doctors table is keyed by id, so
      // without this filter any id could be cleared cross-tenant).
      await sb
        .from('doctors')
        .update({ google_refresh_token: null, google_email: null })
        .eq('id', doctorId)
        .eq('client_id', clientId)
    } else {
      await sb
        .from('client_configs')
        .update({ google_refresh_token: null, google_email: null })
        .eq('client_id', clientId)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
  }
}
