import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(req) {
  try {
    const { subscription, client_id } = await req.json()
    if (!subscription || !client_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

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
  try {
    const { endpoint } = await req.json()
    if (endpoint) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
