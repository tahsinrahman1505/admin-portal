import { describe, it, expect } from 'vitest'
import { tableData } from '../demoData'
import { buildThreads } from '../inbox'

/**
 * Contract tests between the demo fixture and the REAL database schema.
 *
 * Two bugs of exactly this shape shipped undetected to demo.tahsinai.com and
 * were only found when the inbox was rewritten in Phase 1:
 *
 *   1. conversation rows carried `content:` where every consumer reads
 *      `.message` — so the demo inbox rendered correctly-shaped threads with
 *      every message body BLANK.
 *   2. roles were `'user'`/`'assistant'` where the real column uses
 *      `'customer'`/`'bot'`/`'owner'` — so nothing was ever right-aligned as
 *      the patient, every bubble was labelled "Bot", and each thread's preview
 *      fell back to the bot's greeting instead of the patient's question.
 *
 * Both are invisible to a smoke test (the page loads fine, no console error) and
 * invisible to a type checker (this is plain JS). Only an assertion about the
 * SHAPE catches them. Column names below were introspected from the live
 * Supabase schema, not assumed.
 */

describe('demo fixture matches the real conversations schema', () => {
  const rows = tableData('conversations')

  it('produces rows at all', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  it('uses `message`, the real column name — not `content`', () => {
    for (const r of rows) {
      expect(r, `row ${r.id} is missing .message`).toHaveProperty('message')
      expect(typeof r.message).toBe('string')
      expect(r.message.length, `row ${r.id} has an empty body`).toBeGreaterThan(0)
    }
    expect(rows.some(r => 'content' in r), 'fixture still carries a stale `content` key').toBe(false)
  })

  it('uses the real role vocabulary', () => {
    const allowed = new Set(['customer', 'bot', 'owner'])
    for (const r of rows) {
      expect(allowed.has(r.role), `unexpected role "${r.role}" on row ${r.id}`).toBe(true)
    }
  })

  it('contains BOTH inbound and outbound messages', () => {
    // Without a customer row, nothing renders on the patient's side of the
    // conversation and every thread preview falls back to a bot greeting.
    expect(rows.some(r => r.role === 'customer')).toBe(true)
    expect(rows.some(r => r.role === 'bot')).toBe(true)
  })

  it('carries the columns the inbox actually reads', () => {
    for (const r of rows) {
      for (const col of ['id', 'client_id', 'session_id', 'channel', 'role', 'message', 'created_at']) {
        expect(r, `row ${r.id} is missing .${col}`).toHaveProperty(col)
      }
    }
  })

  it('uses only real channel values', () => {
    const allowed = new Set(['whatsapp', 'instagram', 'messenger'])
    for (const r of rows) expect(allowed.has(r.channel)).toBe(true)
  })

  it('uses real session_status values', () => {
    const allowed = new Set(['Handled by Bot', 'Handed Off', 'Pending', undefined])
    for (const r of rows) expect(allowed.has(r.session_status)).toBe(true)
  })
})

describe('the fixture drives a usable inbox end to end', () => {
  it('groups into threads whose preview is the PATIENT question', () => {
    const threads = buildThreads(tableData('conversations'))
    expect(threads.length).toBeGreaterThan(0)
    for (const t of threads) {
      expect(t.firstMessage, `thread ${t.session_id} has no preview`).toBeTruthy()
      expect(t.firstMessage.length).toBeGreaterThan(0)
    }
    // At least one thread must genuinely open with the patient speaking —
    // proving the role values line up rather than silently falling back.
    const opensWithPatient = threads.some(t =>
      t.messages.find(m => m.role === 'customer')?.message === t.firstMessage
    )
    expect(opensWithPatient).toBe(true)
  })

  it('covers more than one channel, so the folder rail has something to filter', () => {
    const threads = buildThreads(tableData('conversations'))
    expect(new Set(threads.map(t => t.channel)).size).toBeGreaterThan(1)
  })
})
