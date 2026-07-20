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

const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// ── CSV parsing ───────────────────────────────────────────────────────────────
// Minimal RFC-4180-ish parser: handles quoted fields, embedded commas/newlines,
// doubled-quote escapes, CRLF/LF, and a leading BOM. No external dependency.
function parseCsv(text) {
  if (!text) return []
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM
  const rows = []
  let field = ''
  let record = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      record.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      record.push(field); field = ''
      // skip fully empty lines
      if (record.some(v => v.trim() !== '')) rows.push(record)
      record = []
    } else field += c
  }
  if (field !== '' || record.length) {
    record.push(field)
    if (record.some(v => v.trim() !== '')) rows.push(record)
  }
  return rows
}

// Map flexible header names → our fields. Clinics label columns differently.
const HEADER_ALIASES = {
  name:  ['name', 'patient', 'patient name', 'full name', 'fullname', 'patient_name'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact', 'contact number', 'whatsapp', 'number', 'tel', 'telephone', 'cell'],
  last_visit_date: ['last visit', 'last visit date', 'last_visit', 'lastvisit', 'last appointment', 'last seen', 'visit date', 'last_visit_date', 'dov', 'date of visit'],
  appointment_type: ['type', 'appointment type', 'treatment', 'procedure', 'service', 'reason', 'appointment_type', 'visit type'],
}

function resolveColumns(headerRow) {
  const norm = headerRow.map(h => h.trim().toLowerCase())
  const idx = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    idx[field] = norm.findIndex(h => aliases.includes(h))
  }
  return idx
}

// Normalize a phone to bare digits with a UAE heuristic so it matches wa_id form.
function normalizePhone(raw) {
  if (!raw) return ''
  let d = String(raw).replace(/[^\d]/g, '')
  if (!d) return ''
  // "00" international access code (e.g. 00971…) → drop it, leaving the country code.
  if (d.startsWith('00')) d = d.slice(2)
  // Local UAE mobile "05XXXXXXXX" (10 digits, leading 0) → 9715XXXXXXXX
  else if (d.length === 10 && d.startsWith('0')) d = '971' + d.slice(1)
  // "5XXXXXXXX" (9 digits, no country/leading-0) → 9715XXXXXXXX
  else if (d.length === 9 && d.startsWith('5')) d = '971' + d
  return d
}

// Parse a date cell into YYYY-MM-DD, accepting common export formats. Returns null
// if unparseable. Handles DD/MM/YYYY (UAE-common) and ISO; ambiguous MM/DD is
// treated as DD/MM when day > 12 isn't decidable — we prefer DD/MM for this market.
function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  // ISO first
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  // DD/MM/YYYY or DD-MM-YYYY (also handles MM/DD if the middle > 12 flips it)
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/)
  if (m) {
    let [_, a, b, y] = m
    let day = parseInt(a, 10), mon = parseInt(b, 10)
    if (mon > 12 && day <= 12) { [day, mon] = [mon, day] } // looks like MM/DD
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? '19' : '20') + y
    if (mon >= 1 && mon <= 12 && day >= 1 && day <= 31) {
      return `${y}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
  }
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function addMonths(isoDate, months) {
  const d = new Date(isoDate + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

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

  const interval = Math.max(1, Math.min(36, parseInt(body.recall_interval_months, 10) || 6))
  const rows = parseCsv(body.csv || '')
  if (rows.length < 2) {
    return NextResponse.json({ error: 'CSV needs a header row and at least one patient row.' }, { status: 400 })
  }

  const cols = resolveColumns(rows[0])
  if (cols.phone === -1) {
    return NextResponse.json({ error: 'Could not find a phone/mobile column in the header.' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const byPhone = new Map()
  let skipped = 0
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const phone = normalizePhone(row[cols.phone])
    if (!phone || phone.length < 7) { skipped++; continue }
    const last_visit_date = cols.last_visit_date > -1 ? parseDate(row[cols.last_visit_date]) : null
    const rec = {
      client_id,
      name: cols.name > -1 ? (row[cols.name] || '').trim() || null : null,
      phone,
      last_visit_date,
      appointment_type: cols.appointment_type > -1 ? (row[cols.appointment_type] || '').trim() || null : null,
      recall_interval_months: interval,
      next_due_date: last_visit_date ? addMonths(last_visit_date, interval) : null,
      recall_status: 'due',
      source: 'csv',
      updated_at: new Date().toISOString(),
    }
    byPhone.set(phone, rec) // last occurrence of a phone wins (dedupe within file)
  }

  const records = [...byPhone.values()]
  if (!records.length) {
    return NextResponse.json({ imported: 0, skipped, total: 0, error: 'No valid rows found.' }, { status: 400 })
  }

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
