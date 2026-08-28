import { describe, it, expect } from 'vitest'
import {
  buildRosterRecords, clampInterval, normalizePhone, parseDate, parseCsv, addMonths,
} from '@/lib/rosterImport'

describe('normalizePhone (UAE heuristics)', () => {
  it('expands a local 05… mobile to full international', () => {
    expect(normalizePhone('050 123 4567')).toBe('971501234567')
  })
  it('expands a bare 9-digit 5… mobile', () => {
    expect(normalizePhone('501234567')).toBe('971501234567')
  })
  it('strips the 00 international access code', () => {
    expect(normalizePhone('00971501234567')).toBe('971501234567')
  })
  it('strips punctuation from an already-international number', () => {
    expect(normalizePhone('+971 50-123 4567')).toBe('971501234567')
  })
  it('returns empty for blank/garbage', () => {
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone('n/a')).toBe('')
  })
})

describe('parseDate', () => {
  it('prefers DD/MM for this market', () => {
    expect(parseDate('03/02/2026')).toBe('2026-02-03')
  })
  it('accepts ISO', () => {
    expect(parseDate('2026-02-03')).toBe('2026-02-03')
  })
  it('flips to MM/DD when the first part cannot be a month', () => {
    expect(parseDate('13/02/2026')).toBe('2026-02-13')
  })
  it('returns null on garbage', () => {
    expect(parseDate('not a date')).toBeNull()
    expect(parseDate('')).toBeNull()
  })
})

describe('clampInterval', () => {
  it('defaults to 6 when absent or zero (0 is falsy → default)', () => {
    expect(clampInterval(undefined)).toBe(6)
    expect(clampInterval(0)).toBe(6)
  })
  it('clamps to the 1..36 range', () => {
    expect(clampInterval(-5)).toBe(1)
    expect(clampInterval(999)).toBe(36)
  })
})

describe('parseCsv', () => {
  it('handles quoted fields with embedded commas', () => {
    expect(parseCsv('a,b\n"x,1",y')).toEqual([['a', 'b'], ['x,1', 'y']])
  })
  it('strips a BOM and skips blank lines', () => {
    expect(parseCsv('﻿a,b\n\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('addMonths', () => {
  it('advances the month', () => expect(addMonths('2026-01-15', 6)).toBe('2026-07-15'))
  it('returns null on a bad date', () => expect(addMonths('nope', 6)).toBeNull())
})

const CSV = `Patient Name,Mobile,Last Visit,Treatment
Aisha Al Mansoori,050 123 4501,03/02/2026,Cleaning
Omar Haddad,+971 50 123 4502,2026-01-15,Checkup
No Phone Person,,01/01/2026,Checkup
Dupe One,0501234501,05/03/2026,Scaling`

describe('buildRosterRecords', () => {
  it('resolves aliased headers, dedupes by normalized phone, skips phoneless rows', () => {
    const r = buildRosterRecords({ csv: CSV, client_id: 'c1', interval: 6 })
    expect(r.ok).toBe(true)
    // 4 data rows: 1 has no phone (skipped); Aisha and "Dupe One" normalize to
    // the SAME number, so 2 unique patients remain.
    expect(r.records).toHaveLength(2)
    expect(r.skipped).toBe(1)
  })

  it('keeps the LAST occurrence when a phone repeats', () => {
    const r = buildRosterRecords({ csv: CSV, client_id: 'c1', interval: 6 })
    expect(r.records.find(x => x.phone === '971501234501').appointment_type).toBe('Scaling')
  })

  it('derives next_due_date from last visit + interval', () => {
    const r = buildRosterRecords({ csv: CSV, client_id: 'c1', interval: 6 })
    expect(r.records.find(x => x.phone === '971501234502').next_due_date).toBe('2026-07-15')
  })

  // The whole reason this module exists: the manual upload (/api/roster) and the
  // scheduled sync (/api/roster/sync) must import through identical logic. If
  // these ever diverge, the automatic sync silently imports different data than
  // the manual one — the exact class of drift bug this extraction prevents.
  it('produces identical records for both import paths, apart from the source tag', () => {
    const manual = buildRosterRecords({ csv: CSV, client_id: 'c1', interval: 6, source: 'csv' })
    const synced = buildRosterRecords({ csv: CSV, client_id: 'c1', interval: 6, source: 'sync' })
    const strip = rs => rs.map(({ source, updated_at, ...rest }) => rest)
    expect(strip(synced.records)).toEqual(strip(manual.records))
    expect(manual.records[0].source).toBe('csv')
    expect(synced.records[0].source).toBe('sync')
  })

  it('rejects a CSV with no phone column', () => {
    const r = buildRosterRecords({ csv: 'Name,Email\nA,a@b.c', client_id: 'c1', interval: 6 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/phone/i)
  })

  it('rejects a header-only or empty CSV', () => {
    expect(buildRosterRecords({ csv: 'Name,Phone', client_id: 'c1', interval: 6 }).ok).toBe(false)
    expect(buildRosterRecords({ csv: '', client_id: 'c1', interval: 6 }).ok).toBe(false)
  })

  it('stores no clinical data — only the four roster fields', () => {
    const r = buildRosterRecords({ csv: CSV, client_id: 'c1', interval: 6 })
    expect(Object.keys(r.records[0]).sort()).toEqual([
      'appointment_type', 'client_id', 'last_visit_date', 'name', 'next_due_date',
      'phone', 'recall_interval_months', 'recall_status', 'source', 'updated_at',
    ])
  })
})
