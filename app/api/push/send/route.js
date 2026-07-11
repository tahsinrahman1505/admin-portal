import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant } from '@/lib/auth'

export async function POST(req) {
  const auth = await getAuthedUser(req)
  if (!auth) return unauthorized()
  try {
    // Configuring web-push at module scope means a missing/misconfigured VAPID
    // env var in ANY environment (e.g. Preview, where it may not be set) throws
    // during Next.js's build-time page-data collection and fails the whole
    // build — not just this route. Configure it lazily, inside the handler,
    // so that only fails at request time if it's actually missing.
    if (!process.env.VAPID_EMAIL || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'Push notifications not configured' }, { status: 503 })
    }
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )

    const { client_id, title, body, url, urgent, tag } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'Missing client_id' }, { status: 400 })
    // Tenant guard: a clinic user may only push to their own subscribers (prevents
    // cross-tenant phishing pushes). enforceTenant compares against the caller's clinic.
    const denied = enforceTenant(auth, client_id)
    if (denied) return denied

    // Server-only client (service-role key). Instantiated INSIDE the handler, not at
    // module scope, so a build with no Supabase env (e.g. the demo build) doesn't fail
    // page-data collection with "supabaseUrl is required".
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

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
