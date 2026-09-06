/**
 * Shared roster-import logic — Tier-0 (manual CSV paste/upload) and Tier-1
 * (scheduled pull from a clinic export URL) BOTH import through this module.
 *
 * It lives here rather than inside a route on purpose: the two paths must
 * produce byte-identical records for the same CSV. A duplicated parser would
 * drift silently — one path gaining a header alias or a phone-format fix the
 * other never got — and the failure would look like "the automatic sync
 * imports fewer patients than the manual upload" with no obvious cause.
 *
 * No clinical data is handled here: name, phone, a visit date, and a coarse
 * appointment type only.
 */

// ── CSV parsing ───────────────────────────────────────────────────────────────
// Minimal RFC-4180-ish parser: handles quoted fields, embedded commas/newlines,
// doubled-quote escapes, CRLF/LF, and a leading BOM. No external dependency.
export function parseCsv(text) {
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
export const HEADER_ALIASES = {
  name:  ['name', 'patient', 'patient name', 'full name', 'fullname', 'patient_name'],
  phone: ['phone', 'mobile', 'mobile number', 'phone number', 'contact', 'contact number', 'whatsapp', 'number', 'tel', 'telephone', 'cell'],
  last_visit_date: ['last visit', 'last visit date', 'last_visit', 'lastvisit', 'last appointment', 'last seen', 'visit date', 'last_visit_date', 'dov', 'date of visit'],
  appointment_type: ['type', 'appointment type', 'treatment', 'procedure', 'service', 'reason', 'appointment_type', 'visit type'],
}

export function resolveColumns(headerRow) {
  const norm = headerRow.map(h => h.trim().toLowerCase())
  const idx = {}
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    idx[field] = norm.findIndex(h => aliases.includes(h))
  }
  return idx
}

// Normalize a phone to bare digits with a UAE heuristic so it matches wa_id form.
export function normalizePhone(raw) {
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
export function parseDate(raw) {
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

export function addMonths(isoDate, months) {
  const d = new Date(isoDate + 'T00:00:00Z')
  if (isNaN(d.getTime())) return null
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function clampInterval(raw) {
  return Math.max(1, Math.min(36, parseInt(raw, 10) || 6))
}

/**
 * CSV text → patient_roster records ready to upsert.
 *
 * Returns { ok: true, records, skipped } or { ok: false, error } so both the
 * interactive route (which turns it into a 400) and the cron path (which logs
 * it as a sync failure) can react without re-implementing the validation.
 *
 * `source` distinguishes how the rows arrived ('csv' = manual, 'sync' = pulled)
 * purely for display/debugging — it does not change behaviour.
 */
export function buildRosterRecords({ csv, client_id, interval, source = 'csv' }) {
  const rows = parseCsv(csv || '')
  if (rows.length < 2) {
    return { ok: false, error: 'CSV needs a header row and at least one patient row.' }
  }
  const cols = resolveColumns(rows[0])
  if (cols.phone === -1) {
    return { ok: false, error: 'Could not find a phone/mobile column in the header.' }
  }

  const byPhone = new Map()
  let skipped = 0
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const phone = normalizePhone(row[cols.phone])
    if (!phone || phone.length < 7) { skipped++; continue }
    const last_visit_date = cols.last_visit_date > -1 ? parseDate(row[cols.last_visit_date]) : null
    byPhone.set(phone, {
      client_id,
      name: cols.name > -1 ? (row[cols.name] || '').trim() || null : null,
      phone,
      last_visit_date,
      appointment_type: cols.appointment_type > -1 ? (row[cols.appointment_type] || '').trim() || null : null,
      recall_interval_months: interval,
      next_due_date: last_visit_date ? addMonths(last_visit_date, interval) : null,
      recall_status: 'due',
      source,
      updated_at: new Date().toISOString(),
    }) // last occurrence of a phone wins (dedupe within file)
  }

  const records = [...byPhone.values()]
  if (!records.length) {
    return { ok: false, error: 'No valid rows found.', skipped }
  }
  return { ok: true, records, skipped }
}
