'use client'

import { supabase } from '@/lib/supabase'

// Build-time fallback: the legacy single-tenant client_id. Used only when the
// logged-in user can't be resolved to a clinic (not signed in, lookup fails, or a
// single-tenant deployment that never set up the clients table). Keeping it means
// this change can never leave a page with no client_id.
const FALLBACK = process.env.NEXT_PUBLIC_CLIENT_ID || 'dental_demo'

// Cache the resolved id per auth user so repeat calls on a page don't re-query.
let _cache = { userId: null, botClientId: null }

/**
 * Resolve the bot client_id (client_configs.client_id / clients.bot_client_id) for
 * the CURRENTLY LOGGED-IN portal user, instead of a hard-coded build-time env var.
 * This is what makes the portal multi-tenant: two clinic owners logging into the
 * same deployment each manage their OWN clinic.
 *
 * Falls back to NEXT_PUBLIC_CLIENT_ID if the user isn't signed in or has no clients
 * row, so behaviour is never worse than the previous single-tenant default.
 */
export async function resolveBotClientId() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return FALLBACK
    if (_cache.userId === user.id && _cache.botClientId) return _cache.botClientId
    const { data } = await supabase
      .from('clients')
      .select('bot_client_id')
      .eq('user_id', user.id)
      .single()
    if (data?.bot_client_id) {
      _cache = { userId: user.id, botClientId: data.bot_client_id }
      return data.bot_client_id
    }
  } catch {
    /* fall through to fallback */
  }
  return FALLBACK
}
