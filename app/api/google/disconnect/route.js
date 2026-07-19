/**
 * POST /api/google/disconnect   body: { doctor_id?: string }
 *
 * Clears the stored Google refresh token for the clinic (client_configs) or a
 * specific doctor. Behind the auth middleware (logged-in clinic users only).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthedUser } from '@/lib/auth'

const FALLBACK_CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || 'default'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request) {
  let doctorId = ''
  try {
    doctorId = (await request.json())?.doctor_id || ''
  } catch {
    /* no body → clinic-level disconnect */
  }

  // Multi-tenant: disconnect the LOGGED-IN user's clinic calendar, not a fixed env var.
  const auth = await getAuthedUser(request)
  const clientId = auth?.botClientId || FALLBACK_CLIENT_ID

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    if (doctorId) {
      await sb
        .from('doctors')
        .update({ google_refresh_token: null, google_email: null })
        .eq('id', doctorId)
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
