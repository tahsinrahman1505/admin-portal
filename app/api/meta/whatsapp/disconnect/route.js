/**
 * POST /api/meta/whatsapp/disconnect
 *
 * Clears the stored WhatsApp connection for the logged-in clinic. Mirrors
 * /api/google/disconnect. Best-effort unsubscribe from the WABA before wiping
 * local state — if the unsubscribe call fails (token already revoked, etc.) we
 * still clear our own record, since the clinic's intent to disconnect matters
 * more than a clean remote unsubscribe.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, forbidden, getAdminClient } from '@/lib/auth'

const GRAPH_VERSION = 'v21.0'

export async function POST(request) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return forbidden('No clinic on this account')

  const sb = getAdminClient()
  const { data } = await sb
    .from('client_configs')
    .select('whatsapp_business_account_id, whatsapp_token')
    .eq('client_id', auth.botClientId)
    .maybeSingle()

  if (data?.whatsapp_business_account_id && data?.whatsapp_token) {
    try {
      await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${data.whatsapp_business_account_id}/subscribed_apps` +
        `?access_token=${encodeURIComponent(data.whatsapp_token)}`,
        { method: 'DELETE' },
      )
    } catch {
      /* best-effort — proceed to clear local state regardless */
    }
  }

  const { error } = await sb
    .from('client_configs')
    .update({
      phone_number_id: null,
      whatsapp_token: null,
      whatsapp_business_account_id: null,
      whatsapp_connected_at: null,
    })
    .eq('client_id', auth.botClientId)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
