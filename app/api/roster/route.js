/**
 * Tier-0 EMR bridge — patient roster import + list.
 *
 *   GET  /api/roster?client_id=…   → roster rows for the caller's clinic
 *   POST /api/roster  (JSON: {client_id, csv, recall_interval_months?})
 *                                  → parse a patient-list CSV, upsert into patient_roster
 *
 * Works with ANY clinic PMS/EMR: they export a patient list (name, phone, last-visit
 * date), the clinic pastes/uploads it here, and it becomes the recall source.
 *
 * Writes use the service-role client (bypasses RLS); every query is tenant-scoped
 * to the caller's own botClientId, and enforceTenant() blocks cross-clinic access.
 * No clinical data is stored — name, phone, a date, and a coarse type only.
 */
import { NextResponse } from 'next/server'
import { getAuthedUser, unauthorized, enforceTenant, getAdminClient } from '@/lib/auth'
// Parser + record-building live in lib/rosterImport.js so this route and the
// Tier-1 scheduled sync (/api/roster/sync) import through the SAME code and
// cannot drift apart.
import { buildRosterRecords, clampInterval } from '@/lib/rosterImport'

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ── GET: list roster ──────────────────────────────────────────────────────────
export async function GET(request) {
  if (DEMO) {
    return NextResponse.json({ rows: demoRoster(), demo: true }, { status: 200 })
  }
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()
  const { searchParams } = new URL(request.url)
  const client_id = searchParams.get('client_id') || auth.botClientId
  if (!client_id) return NextResponse.json({ rows: [] }, { status: 200 })
  const denied = enforceTenant(auth, client_id)
  if (denied) return denied
  try {
    const { data, error } = await getAdminClient()
      .from('patient_roster')
      .select('id, name, phone, last_visit_date, appointment_type, next_due_date, recall_status, last_contacted_at, source')
      .eq('client_id', client_id)
      .order('next_due_date', { ascending: true, nullsFirst: false })
    if (error) throw error
    return NextResponse.json({ rows: data || [] }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ rows: [], error: 'Could not load roster' }, { status: 500 })
  }
}

// ── POST: import CSV ──────────────────────────────────────────────────────────
export async function POST(request) {
  if (DEMO) {
    return NextResponse.json(
      { imported: 12, skipped: 0, total: 12, demo: true, message: 'Demo mode — import simulated.' },
      { status: 200 },
    )
  }
  const auth = await getAuthedUser(request)
  if (!auth) return unauthorized()

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const client_id = body.client_id || auth.botClientId
  if (!client_id) return NextResponse.json({ error: 'No client_id' }, { status: 400 })
  const denied = enforceTenant(auth, client_id)
  if (denied) return denied

  const interval = clampInterval(body.recall_interval_months)
  const built = buildRosterRecords({ csv: body.csv, client_id, interval, source: 'csv' })
  if (!built.ok) {
    return NextResponse.json(
      { imported: 0, skipped: built.skipped || 0, total: 0, error: built.error },
      { status: 400 },
    )
  }
  const { records, skipped } = built

  try {
    // Upsert on (client_id, phone): re-importing refreshes existing patients in place.
    const { error } = await getAdminClient()
      .from('patient_roster')
      .upsert(records, { onConflict: 'client_id,phone' })
    if (error) throw error
    return NextResponse.json(
      { imported: records.length, skipped, total: records.length },
      { status: 200 },
    )
  } catch (e) {
    return NextResponse.json({ error: 'Import failed while saving.' }, { status: 500 })
  }
}

// ── Demo seed (judge/showcase mode) ───────────────────────────────────────────
function demoRoster() {
  const mk = (name, phone, daysAgo, type, status) => {
    const lv = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)
    const nd = new Date(new Date(lv + 'T00:00:00Z').setUTCMonth(new Date(lv + 'T00:00:00Z').getUTCMonth() + 6)).toISOString().slice(0, 10)
    return { id: phone, name, phone, last_visit_date: lv, appointment_type: type, next_due_date: nd, recall_status: status, last_contacted_at: null, source: 'csv' }
  }
  return [
    mk('Aisha Al Mansoori', '971501234501', 200, 'Cleaning', 'due'),
    mk('Omar Haddad', '971501234502', 195, 'Checkup', 'due'),
    mk('Fatima Khan', '971501234503', 188, 'Scaling', 'due'),
    mk('Yousef Ali', '971501234504', 120, 'Cleaning', 'scheduled'),
    mk('Layla Ahmed', '971501234505', 95, 'Whitening', 'contacted'),
    mk('Hassan Nasser', '971501234506', 60, 'Checkup', 'rebooked'),
  ]
}
