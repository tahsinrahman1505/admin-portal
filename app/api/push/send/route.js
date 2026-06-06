import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(req) {
  try {
    const { client_id, title, body, url, urgent, tag } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })

    // Fetch all push subscriptions for this client
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription, endpoint')
      .eq('client_id', client_id)

    if (!subs?.length) return NextResponse.json({ sent: 0 })

    const payload = JSON.stringify({ title, body, url: url || '/conversations', urgent: !!urgent, tag })
    const stale   = []

    await Promise.all(subs.map(async row => {
      try {
        await webpush.sendNotification(JSON.parse(row.subscription), payload)
      } catch (err) {
        // 410 Gone = subscription expired, clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          stale.push(row.endpoint)
        }
      }
    }))

    // Remove stale subscriptions
    if (stale.length) {
      await supabase.from('push_subscriptions').delete().in('endpoint', stale)
    }

    return NextResponse.json({ sent: subs.length - stale.length })
  } catch (e) {
    console.error('Push send error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
