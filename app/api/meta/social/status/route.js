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
    .select('fb_page_id, fb_page_access_token, ig_business_id, ig_username, ig_user_access_token')
    .eq('client_id', auth.botClientId)
    .maybeSingle()

  // Instagram counts as connected ONLY with its own user access token.
  //
  // This used to be `ig_business_id && fb_page_access_token` — i.e. it went
  // green off the FACEBOOK PAGE token. That token cannot send Instagram
  // messages for this app at all (graph.instagram.com: "Cannot parse access
  // token"; legacy FB path: "(#3) Application does not have the capability"),
  // so the Channels page showed a confident green "Connected to Meta" while
  // every single reply failed. That mismatch is what let Instagram sit broken
  // from 2026-07-31 to 2026-08-13 without anyone noticing. The badge now
  // tracks the credential that actually has to work.
  return NextResponse.json({
    messenger: {
      connected: Boolean(data?.fb_page_id && data?.fb_page_access_token),
      pageId: data?.fb_page_id || null,
    },
    instagram: {
      connected: Boolean(data?.ig_business_id && data?.ig_user_access_token),
      username: data?.ig_username || null,
    },
  })
}
