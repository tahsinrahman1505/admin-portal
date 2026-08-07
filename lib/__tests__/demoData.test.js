import { describe, it, expect } from 'vitest'
import { tableData } from '../demoData'
import { buildThreads } from '../inbox'
import { mergeMeta, triageStatusCounts } from '../triage'

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

/**
 * Same class of check as above, for the Phase 2 triage tables added in
 * migrations/003_conversation_meta.sql — written proactively this time,
 * rather than after finding a live bug, precisely BECAUSE the conversations
 * fixture already shipped two silent shape mismatches undetected.
 */
describe('demo fixture matches the real triage schema', () => {
  it('conversation_meta rows carry the columns lib/triage.js reads', () => {
    const rows = tableData('conversation_meta')
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      for (const col of ['session_id', 'client_id', 'status', 'priority', 'assignee_id', 'tags', 'updated_at']) {
        expect(r, `row ${r.session_id} is missing .${col}`).toHaveProperty(col)
      }
      expect(Array.isArray(r.tags), `${r.session_id}.tags must be an array`).toBe(true)
    }
  })

  it('conversation_meta.status uses the real triage vocabulary — distinct from session_status', () => {
    // The exact confusion lib/triage.js's header comment warns about: this is
    // 'open'/'pending'/'resolved' (manual triage), NOT the bot's
    // 'Handled by Bot'/'Handed Off' (session_status).
    const allowed = new Set(['open', 'pending', 'resolved'])
    for (const r of tableData('conversation_meta')) {
      expect(allowed.has(r.status), `unexpected triage status "${r.status}"`).toBe(true)
    }
  })

  it('every conversation_meta.session_id matches a real thread — no orphans', () => {
    const threadIds = new Set(buildThreads(tableData('conversations')).map(t => t.session_id))
    for (const r of tableData('conversation_meta')) {
      expect(threadIds.has(r.session_id), `orphaned meta row for ${r.session_id}`).toBe(true)
    }
  })

  it('every conversation_meta.assignee_id resolves to a real staff row', () => {
    const staffIds = new Set(tableData('staff').map(s => s.id))
    for (const r of tableData('conversation_meta')) {
      if (r.assignee_id) expect(staffIds.has(r.assignee_id), `dangling assignee_id ${r.assignee_id}`).toBe(true)
    }
  })

  it('every conversation_meta tag name exists in the client_tags catalogue', () => {
    // A tag chip whose colour can't be looked up is the failure mode this
    // guards — TagPicker falls back to a default colour, but a fixture with
    // this mismatch would mean that fallback path is ALL you ever see in demo.
    const catalogueNames = new Set(tableData('client_tags').map(t => t.name))
    for (const r of tableData('conversation_meta')) {
      for (const tag of r.tags) {
        expect(catalogueNames.has(tag), `tag "${tag}" on ${r.session_id} is not in client_tags`).toBe(true)
      }
    }
  })

  it('demonstrates real variety, not every thread identical', () => {
    // A fixture where every thread has the same status/priority/assignee would
    // pass every check above while still failing to demo the feature at all.
    const meta = tableData('conversation_meta')
    expect(new Set(meta.map(r => r.status)).size, 'needs more than one triage status').toBeGreaterThan(1)
    expect(meta.some(r => r.priority === null), 'needs at least one untriaged (no-priority) thread').toBe(true)
    expect(meta.some(r => r.priority != null), 'needs at least one prioritized thread').toBe(true)
    expect(meta.some(r => r.assignee_id === null), 'needs at least one unassigned thread').toBe(true)
    expect(meta.some(r => r.assignee_id != null), 'needs at least one assigned thread').toBe(true)
    expect(meta.some(r => r.tags.length === 0), 'needs at least one untagged thread').toBe(true)
  })

  it('staff rows have what AssigneeSelector needs, and at least one is active', () => {
    const staff = tableData('staff')
    expect(staff.length).toBeGreaterThan(0)
    for (const s of staff) {
      for (const col of ['id', 'name', 'active']) expect(s).toHaveProperty(col)
    }
    expect(staff.some(s => s.active)).toBe(true)
  })

  it('client_tags rows have what TagPicker needs', () => {
    const tags = tableData('client_tags')
    expect(tags.length).toBeGreaterThan(0)
    for (const t of tags) {
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('color')
      expect(typeof t.color).toBe('string')
    }
  })

  it('merges cleanly onto real threads and produces non-trivial status counts', () => {
    const threads = buildThreads(tableData('conversations'))
    const metaBySession = Object.fromEntries(tableData('conversation_meta').map(m => [m.session_id, m]))
    const merged = mergeMeta(threads, metaBySession)
    const counts = triageStatusCounts(merged)
    expect(counts.all).toBe(threads.length)
    expect(counts.open + counts.pending + counts.resolved).toBe(counts.all)
  })
})
