/**
 * GET /api/meta/whatsapp/status
 *
 * Returns the LOGGED-IN clinic's WhatsApp connection state for the Channels
 * page. Deliberately never returns whatsapp_token — the frontend only needs to
 * know CONNECTED vs NOT, never the secret itself. This is why the Channels page
 * calls this route instead of querying client_configs directly from the browser.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, getAdminClient } from '@/lib/auth'

export async function GET(request) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) return NextResponse.json({ connected: false })

  const sb = getAdminClient()
  const { data } = await sb
    .from('client_configs')
    .select('phone_number_id, whatsapp_business_account_id, whatsapp_connected_at')
    .eq('client_id', auth.botClientId)
    .maybeSingle()

  return NextResponse.json({
    connected: Boolean(data?.phone_number_id),
    wabaId: data?.whatsapp_business_account_id || null,
    connectedAt: data?.whatsapp_connected_at || null,
  })
}
