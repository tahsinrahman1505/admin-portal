/**
 * POST /api/meta/social/disconnect
 *
 * Clears the stored Messenger/Instagram connection for the logged-in clinic.
 * Mirrors /api/meta/whatsapp/disconnect — no remote unsubscribe call needed
 * here (unlike WhatsApp's WABA subscribed_apps), clearing the local record is
 * sufficient since Messenger/Instagram delivery is gated on these fields
 * being present, not on a separate webhook subscription per clinic.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, forbidden, getAdminClient } from '@/lib/auth'

export async function POST(request) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return forbidden('No clinic on this account')

  const sb = getAdminClient()
  const { error } = await sb
    .from('client_configs')
    .update({
      fb_page_id: null,
      fb_page_access_token: null,
      ig_business_id: null,
      ig_username: null,
    })
    .eq('client_id', auth.botClientId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
