/**
 * Tier-1 EMR bridge — scheduled roster sync.
 *
 *   GET  /api/roster/sync            → current sync config + last-run status (authed user)
 *   PUT  /api/roster/sync            → save config {roster_sync_url, enabled, interval_months}
 *   POST /api/roster/sync            → run a sync now
 *        · authed user  → syncs the caller's own clinic ("Sync now" button)
 *        · cron secret  → syncs EVERY enabled clinic (scheduled fan-out)
 *
 * Tier-0 (manual CSV upload, /api/roster) works with 100% of EMRs but is manual,
 * so rosters go stale and recalls quietly stop. Tier-1 keeps that universality —
 * it needs nothing from the EMR vendor, which matters because most small UAE
 * dental EMRs expose no API at all — and just removes the human step: the clinic
 * points us at wherever their export lands and we re-pull it on a schedule.
 *
 * Parsing/record-building is imported from lib/rosterImport.js, the SAME code
 * the manual upload uses, so the two paths cannot drift.
 *
 * The URL is clinic-supplied and fetched server-side, so all network access goes
 * through lib/safeFetch.js (https-only, private/loopback/link-local blocked,
 * every redirect hop re-validated, 5 MB cap, 15 s timeout).
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant, getAdminClient } from '@/lib/auth'
import { buildRosterRecords, clampInterval } from '@/lib/rosterImport'
import { safeFetchText, assertPublicHttpsUrl, normalizeShareLink } from '@/lib/safeFetch'

// dns/net are Node-only — make sure this never gets bundled for the edge runtime.
export const runtime = 'nodejs'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
const CRON_SECRET = process.env.CRON_SECRET

const SYNC_FIELDS =
  'client_id, roster_sync_url, roster_sync_enabled, roster_sync_interval_months, roster_last_sync_at, roster_last_sync_status, roster_last_sync_detail'

/** Constant-time-ish compare so a wrong secret can't be probed byte-by-byte. */
function secretMatches(provided) {
  // Fail CLOSED: with no CRON_SECRET configured the cron path is disabled
  // entirely rather than silently accepting every caller.
  if (!CRON_SECRET || !provided) return false
  const a = Buffer.from(String(provided))
  const b = Buffer.from(CRON_SECRET)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function isCronRequest(request) {
  const auth = request.headers.get('authorization') || ''
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
  return secretMatches(bearer) || secretMatches(request.headers.get('x-cron-secret'))
}

/** Pull one clinic's export and upsert it. Never throws — returns a result object. */
async function syncOneClient(cfg) {
  const client_id = cfg.client_id
  const url = cfg.roster_sync_url
  if (!url) return { client_id, ok: false, error: 'No export URL configured.' }

  const fetched = await safeFetchText(url)
  if (!fetched.ok) return { client_id, ok: false, error: fetched.error }

  const interval = clampInterval(cfg.roster_sync_interval_months)
  const built = buildRosterRecords({ csv: fetched.text, client_id, interval, source: 'sync' })
  if (!built.ok) {
    // Most common real cause: the link returned an HTML viewer page instead of
    // the file, so say so rather than leaving them staring at a parser error.
    const looksHtml = /^\s*<(!doctype|html)/i.test(fetched.text.slice(0, 200))
    return {
      client_id,
      ok: false,
      error: looksHtml
        ? 'The link returned a web page, not a CSV file. Use a direct download / "export to CSV" link.'
        : built.error,
    }
  }

  const { error } = await getAdminClient()
    .from('patient_roster')
    .upsert(built.records, { onConflict: 'client_id,phone' })
  if (error) return { client_id, ok: false, error: 'Saving the imported rows failed.' }

  return { client_id, ok: true, imported: built.records.length, skipped: built.skipped }
}

/** Record the outcome so a silently-failing sync is visible in the portal. */
async function recordResult(client_id, result) {
  const detail = result.ok
    ? `Imported ${result.imported} patient${result.imported === 1 ? '' : 's'}` +
      (result.skipped ? `, skipped ${result.skipped} row${result.skipped === 1 ? '' : 's'} with no usable phone` : '')
    : result.error
  try {
    await getAdminClient()
      .from('client_configs')
      .update({
        roster_last_sync_at: new Date().toISOString(),
        roster_last_sync_status: result.ok ? 'ok' : 'error',
        roster_last_sync_detail: String(detail).slice(0, 500),
      })
      .eq('client_id', client_id)
  } catch { /* status recording must never mask the sync result itself */ }
}

// ── GET: current config + last run ────────────────────────────────────────────
export async function GET(request) {
  if (DEMO) {
    return NextResponse.json({
      demo: true,
      config: {
        roster_sync_url: 'https://docs.google.com/spreadsheets/d/DEMO/export?format=csv',
        roster_sync_enabled: true,
        roster_sync_interval_months: 6,
        roster_last_sync_at: new Date(Date.now() - 3600_000).toISOString(),
        roster_last_sync_status: 'ok',
        roster_last_sync_detail: 'Imported 128 patients',
      },
    })
  }
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  const client_id = auth.botClientId
  if (!client_id) return NextResponse.json({ config: null }, { status: 200 })

  const { data, error } = await getAdminClient()
    .from('client_configs').select(SYNC_FIELDS).eq('client_id', client_id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load sync settings.' }, { status: 500 })
  return NextResponse.json({ config: data || null }, { status: 200 })
}

// ── PUT: save config ──────────────────────────────────────────────────────────
export async function PUT(request) {
  if (DEMO) return NextResponse.json({ saved: true, demo: true }, { status: 200 })
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const client_id = body.client_id || auth.botClientId
  if (!client_id) return NextResponse.json({ error: 'No client_id' }, { status: 400 })
  const denied = enforceTenant(auth, client_id)
  if (denied) return denied

  const rawUrl = (body.roster_sync_url || '').trim()
  let url = null
  if (rawUrl) {
    url = normalizeShareLink(rawUrl)
    // Validate at SAVE time so the clinic gets the error while they're looking
    // at the field, not silently at 3am when the cron runs.
    const check = await assertPublicHttpsUrl(url)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 })
  }

  const patch = {
    roster_sync_url: url,
    roster_sync_enabled: !!body.roster_sync_enabled && !!url,
    roster_sync_interval_months: clampInterval(body.roster_sync_interval_months),
  }
  const { error } = await getAdminClient().from('client_configs').update(patch).eq('client_id', client_id)
  if (error) return NextResponse.json({ error: 'Could not save sync settings.' }, { status: 500 })
  return NextResponse.json({ saved: true, config: patch }, { status: 200 })
}

// ── POST: run sync ────────────────────────────────────────────────────────────
export async function POST(request) {
  if (DEMO) {
    return NextResponse.json({ ok: true, demo: true, imported: 128, skipped: 2 }, { status: 200 })
  }
  const admin = getAdminClient()

  // Mode A — scheduled fan-out across every enabled clinic.
  if (isCronRequest(request)) {
    const { data, error } = await admin
      .from('client_configs').select(SYNC_FIELDS).eq('roster_sync_enabled', true)
    if (error) return NextResponse.json({ error: 'Could not list clinics.' }, { status: 500 })

    const results = []
    for (const cfg of data || []) {
      const r = await syncOneClient(cfg)   // sequential: these are small, and it
      await recordResult(cfg.client_id, r) // keeps us polite to the file hosts
      results.push(r)
    }
    return NextResponse.json(
      { mode: 'cron', clinics: results.length, ok: results.filter(r => r.ok).length, results },
      { status: 200 },
    )
  }

  // Mode B — a signed-in user pressing "Sync now" for their own clinic.
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  const client_id = auth.botClientId
  if (!client_id) return NextResponse.json({ error: 'No client_id' }, { status: 400 })
  const denied = enforceTenant(auth, client_id)
  if (denied) return denied

  const { data: cfg, error } = await admin
    .from('client_configs').select(SYNC_FIELDS).eq('client_id', client_id).maybeSingle()
  if (error || !cfg) return NextResponse.json({ error: 'Could not load sync settings.' }, { status: 500 })

  const result = await syncOneClient(cfg)
  await recordResult(client_id, result)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
