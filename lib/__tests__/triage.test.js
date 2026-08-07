import { describe, it, expect } from 'vitest'
import {
  mergeMeta, filterByTriage, triageStatusCounts, sortByPriority,
  normalizeTagName, findExistingTag,
} from '../triage'

const thread = (o) => ({ session_id: 's1', lastAt: '2026-08-01T10:00:00Z', ...o })

describe('mergeMeta', () => {
  it('defaults an untriaged thread to open, no priority, no assignee, no tags', () => {
    const [t] = mergeMeta([thread()], {})
    expect(t.triageStatus).toBe('open')
    expect(t.priority).toBeNull()
    expect(t.assigneeId).toBeNull()
    expect(t.tags).toEqual([])
  })

  it('merges a matching meta row by session_id', () => {
    const [t] = mergeMeta([thread({ session_id: 'a' })], {
      a: { status: 'resolved', priority: 'urgent', assignee_id: 'staff-1', tags: ['vip'] },
    })
    expect(t.triageStatus).toBe('resolved')
    expect(t.priority).toBe('urgent')
    expect(t.assigneeId).toBe('staff-1')
    expect(t.tags).toEqual(['vip'])
  })

  it('does NOT overwrite the bot-derived .status field', () => {
    // thread.status (bot session state) and triageStatus (manual) are
    // deliberately different fields — this is the exact confusion the naming
    // note in triage.js exists to prevent.
    const [t] = mergeMeta([thread({ status: 'Handed Off' })], {})
    expect(t.status).toBe('Handed Off')
    expect(t.triageStatus).toBe('open')
  })

  it('leaves threads with no matching meta row alone otherwise', () => {
    const [t] = mergeMeta([thread({ session_id: 'x' })], { y: { status: 'resolved' } })
    expect(t.triageStatus).toBe('open')
  })
})

describe('filterByTriage', () => {
  const threads = mergeMeta([
    thread({ session_id: 'a' }),
    thread({ session_id: 'b' }),
    thread({ session_id: 'c' }),
  ], {
    a: { status: 'open', assignee_id: 'sara', tags: ['vip'] },
    b: { status: 'pending', assignee_id: null, tags: ['lead'] },
    c: { status: 'resolved', assignee_id: 'sara', tags: [] },
  })

  it('filters by triage status', () => {
    expect(filterByTriage(threads, { triageStatus: 'pending' }).map(t => t.session_id)).toEqual(['b'])
  })

  it('"all" status is a no-op', () => {
    expect(filterByTriage(threads, { triageStatus: 'all' })).toHaveLength(3)
  })

  it('filters unassigned via assigneeId: null', () => {
    expect(filterByTriage(threads, { assigneeId: null }).map(t => t.session_id)).toEqual(['b'])
  })

  it('filters "assigned to anyone" via assigneeId: "any"', () => {
    expect(filterByTriage(threads, { assigneeId: 'any' }).map(t => t.session_id)).toEqual(['a', 'c'])
  })

  it('filters by a specific assignee', () => {
    expect(filterByTriage(threads, { assigneeId: 'sara' })).toHaveLength(2)
  })

  it('omitting assigneeId entirely means no assignee filter', () => {
    expect(filterByTriage(threads, {})).toHaveLength(3)
  })

  it('filters by tag', () => {
    expect(filterByTriage(threads, { tag: 'vip' }).map(t => t.session_id)).toEqual(['a'])
  })

  it('composes status AND assignee', () => {
    expect(filterByTriage(threads, { triageStatus: 'resolved', assigneeId: 'sara' }).map(t => t.session_id)).toEqual(['c'])
  })

  it('returns empty rather than throwing on an empty list', () => {
    expect(filterByTriage([], { triageStatus: 'open' })).toEqual([])
  })
})

describe('triageStatusCounts', () => {
  it('counts each status plus a total', () => {
    const threads = mergeMeta([thread({ session_id: 'a' }), thread({ session_id: 'b' }), thread({ session_id: 'c' })], {
      a: { status: 'open' }, b: { status: 'open' }, c: { status: 'resolved' },
    })
    expect(triageStatusCounts(threads)).toEqual({ all: 3, open: 2, pending: 0, resolved: 1 })
  })

  it('handles an empty list', () => {
    expect(triageStatusCounts([])).toEqual({ all: 0, open: 0, pending: 0, resolved: 0 })
  })
})

describe('sortByPriority', () => {
  it('orders urgent > high > medium > low > none', () => {
    const threads = mergeMeta([
      thread({ session_id: 'low' }), thread({ session_id: 'urgent' }),
      thread({ session_id: 'none' }), thread({ session_id: 'high' }),
    ], {
      low: { priority: 'low' }, urgent: { priority: 'urgent' }, high: { priority: 'high' },
    })
    expect(sortByPriority(threads).map(t => t.session_id)).toEqual(['urgent', 'high', 'low', 'none'])
  })

  it('breaks ties within the same priority by most-recent-active', () => {
    const threads = mergeMeta([
      thread({ session_id: 'older', lastAt: '2026-08-01T10:00:00Z' }),
      thread({ session_id: 'newer', lastAt: '2026-08-03T10:00:00Z' }),
    ], { older: { priority: 'high' }, newer: { priority: 'high' } })
    expect(sortByPriority(threads).map(t => t.session_id)).toEqual(['newer', 'older'])
  })

  it('does not mutate the input array', () => {
    const threads = mergeMeta([thread({ session_id: 'a' }), thread({ session_id: 'b' })], {})
    const original = threads.map(t => t.session_id)
    sortByPriority(threads)
    expect(threads.map(t => t.session_id)).toEqual(original)
  })
})

describe('normalizeTagName / findExistingTag', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeTagName('  VIP  ')).toBe('vip')
    expect(normalizeTagName('Vip')).toBe('vip')
  })

  it('finds an existing tag case-insensitively', () => {
    const catalogue = [{ name: 'VIP', color: '#fff' }, { name: 'Lead', color: '#000' }]
    expect(findExistingTag(catalogue, 'vip')?.name).toBe('VIP')
    expect(findExistingTag(catalogue, '  Lead ')?.name).toBe('Lead')
  })

  it('returns null for no match, empty catalogue, or empty input', () => {
    expect(findExistingTag([{ name: 'VIP' }], 'new-tag')).toBeNull()
    expect(findExistingTag([], 'vip')).toBeNull()
    expect(findExistingTag([{ name: 'VIP' }], '')).toBeNull()
  })
})
