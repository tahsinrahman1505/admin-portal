/**
 * GET /api/meta/social/status
 *
 * Returns the logged-in clinic's Messenger/Instagram connection state for the
 * Channels page. There's no self-serve OAuth flow for these yet (fb_page_id /
 * fb_page_access_token / ig_business_id are still set by an engineer via the
 * Graph API), so this is read-only — same "never expose the token" rule as
 * /api/meta/whatsapp/status.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, getAdminClient } from '@/lib/auth'

export async function GET(request) {
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  if (!auth.botClientId) {
    return NextResponse.json({ messenger: { connected: false }, instagram: { connected: false } })
  }

  const sb = getAdminClient()
  const { data } = await sb
    .from('client_configs')
    .select('fb_page_id, fb_page_access_token, ig_business_id, ig_username')
    .eq('client_id', auth.botClientId)
    .maybeSingle()

  return NextResponse.json({
    messenger: {
      connected: Boolean(data?.fb_page_id && data?.fb_page_access_token),
      pageId: data?.fb_page_id || null,
    },
    instagram: {
      connected: Boolean(data?.ig_business_id && data?.fb_page_access_token),
      username: data?.ig_username || null,
    },
  })
}
