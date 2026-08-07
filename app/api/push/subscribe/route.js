import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, forbidden } from '@/lib/auth'

// Server-only client (service-role key, kept server-side). Created lazily via this
// getter — NOT at module scope — so a build with no Supabase env (e.g. the demo
// build) doesn't fail page-data collection with "supabaseUrl is required".
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(req) {
  const auth = await getAuthedUser(req)
  if (!auth) return unauthorized()
  try {
    // Default-deny + server-authoritative client_id: bind the push endpoint to the
    // logged-in user's OWN clinic. Never trust a caller-supplied client_id — a
    // self-registered account could otherwise register its device under another
    // clinic and receive that clinic's push notifications (interception/phishing).
    if (!auth.botClientId) return forbidden('No clinic associated with this account')
    const supabase = getSupabase()
    const { subscription } = await req.json()
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const client_id = auth.botClientId
    const endpoint = subscription.endpoint

    await supabase
      .from('push_subscriptions')
      .upsert({ client_id, endpoint, subscription: JSON.stringify(subscription) },
               { onConflict: 'endpoint' })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  const auth = await getAuthedUser(req)
  if (!auth) return unauthorized()
  try {
    const supabase = getSupabase()
    const { endpoint } = await req.json()
    if (endpoint) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
