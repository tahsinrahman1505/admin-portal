import { describe, it, expect, beforeEach } from 'vitest'
import { createQuery } from '../demoQuery'

/**
 * The demo query engine is what makes every filter feature testable.
 *
 * Before it existed, the demo client stubbed each operator as a no-op that
 * returned the whole table. Under that mock a test like "filtering by tag shows
 * only tagged rows" PASSES without the filter working at all, because the seed
 * contains the row it looks for. These tests exist so the engine itself is held
 * to real behaviour — everything downstream inherits its correctness.
 */

let rows
const seed = () => ([
  { id: 'a', client_id: 'c1', status: 'open',     tags: ['vip', 'lead'], n: 3, name: 'Ali',   ts: '2026-08-01T10:00:00Z', assignee: null },
  { id: 'b', client_id: 'c1', status: 'pending',  tags: ['lead'],        n: 1, name: 'Bilal', ts: '2026-08-03T10:00:00Z', assignee: 'u1' },
  { id: 'c', client_id: 'c2', status: 'open',     tags: [],              n: 7, name: 'Cara',  ts: '2026-08-02T10:00:00Z', assignee: 'u2' },
  { id: 'd', client_id: 'c1', status: 'resolved', tags: ['vip'],         n: 5, name: 'ALIYA', ts: '2026-08-04T10:00:00Z', assignee: null },
])

const q = () => createQuery(() => rows)
const ids = list => list.map(r => r.id)

beforeEach(() => { rows = seed() })

describe('filters', () => {
  it('eq narrows to matching rows', async () => {
    const { data } = await q().select('*').eq('client_id', 'c1')
    expect(ids(data)).toEqual(['a', 'b', 'd'])
  })

  it('composes multiple filters with AND', async () => {
    const { data } = await q().select('*').eq('client_id', 'c1').eq('status', 'open')
    expect(ids(data)).toEqual(['a'])
  })

  it('neq, in, gt, gte', async () => {
    expect(ids((await q().select('*').neq('status', 'open')).data)).toEqual(['b', 'd'])
    expect(ids((await q().select('*').in('status', ['open', 'pending'])).data)).toEqual(['a', 'b', 'c'])
    expect(ids((await q().select('*').gt('n', 3)).data)).toEqual(['c', 'd'])
    expect(ids((await q().select('*').gte('n', 3)).data)).toEqual(['a', 'c', 'd'])
  })

  it('contains does ARRAY CONTAINMENT, not equality — this is what tag filters use', async () => {
    expect(ids((await q().select('*').contains('tags', ['vip'])).data)).toEqual(['a', 'd'])
    // every needle must be present, not just one
    expect(ids((await q().select('*').contains('tags', ['vip', 'lead'])).data)).toEqual(['a'])
  })

  it('like is case-sensitive and ilike is not', async () => {
    expect(ids((await q().select('*').like('name', 'Ali%')).data)).toEqual(['a'])
    expect(ids((await q().select('*').ilike('name', 'ali%')).data)).toEqual(['a', 'd'])
  })

  it('is(null) matches null and undefined', async () => {
    expect(ids((await q().select('*').is('assignee', null)).data)).toEqual(['a', 'd'])
  })

  it('not negates', async () => {
    expect(ids((await q().select('*').not('status', 'eq', 'open')).data)).toEqual(['b', 'd'])
  })

  it('or matches any term', async () => {
    const { data } = await q().select('*').or('status.eq.resolved,name.ilike.cara')
    expect(ids(data)).toEqual(['c', 'd'])
  })

  it('an unmatched filter yields an empty set, not the whole table', async () => {
    // The exact regression the old no-op mock could not express.
    const { data } = await q().select('*').eq('client_id', 'nobody')
    expect(data).toEqual([])
  })
})

describe('ordering and pagination', () => {
  it('orders ascending and descending', async () => {
    expect(ids((await q().select('*').order('n', { ascending: true })).data)).toEqual(['b', 'a', 'd', 'c'])
    expect(ids((await q().select('*').order('ts', { ascending: false })).data)).toEqual(['d', 'b', 'c', 'a'])
  })

  it('limit and range slice the ordered set', async () => {
    expect(ids((await q().select('*').order('n').limit(2)).data)).toEqual(['b', 'a'])
    expect(ids((await q().select('*').order('n').range(1, 2)).data)).toEqual(['a', 'd'])
  })

  it('count reflects the FILTERED total', async () => {
    const { count } = await q().select('*', { head: true, count: 'exact' }).eq('client_id', 'c1')
    expect(count).toBe(3)
  })
})

describe('single / maybeSingle', () => {
  it('single returns the row when exactly one matches', async () => {
    const { data, error } = await q().select('*').eq('id', 'a').single()
    expect(error).toBeNull()
    expect(data.id).toBe('a')
  })

  it('single ERRORS on zero matches instead of inventing a row', async () => {
    // The old mock returned rows[0] regardless, so "my filter matched nothing"
    // was indistinguishable from "here is your row".
    const { data, error } = await q().select('*').eq('id', 'nope').single()
    expect(data).toBeNull()
    expect(error.code).toBe('PGRST116')
  })

  it('single errors when more than one matches', async () => {
    const { error } = await q().select('*').eq('client_id', 'c1').single()
    expect(error.code).toBe('PGRST116')
  })

  it('maybeSingle tolerates zero matches', async () => {
    const { data, error } = await q().select('*').eq('id', 'nope').maybeSingle()
    expect(data).toBeNull()
    expect(error).toBeNull()
  })
})

describe('mutations are DEFERRED until the terminal step', () => {
  // supabase-js puts the filter AFTER the verb: `.update(x).eq('id', 1)`.
  // An implementation that applies the mutation inside update() runs with zero
  // filters registered and therefore rewrites EVERY ROW IN THE TABLE. That bug
  // was present in the first draft of this engine and these are its regressions.

  it('update touches only the filtered rows', async () => {
    await q().update({ status: 'CHANGED' }).eq('client_id', 'c2')
    expect(rows.find(r => r.id === 'c').status).toBe('CHANGED')
    expect(rows.find(r => r.id === 'a').status).toBe('open')      // must NOT leak
    expect(rows.find(r => r.id === 'b').status).toBe('pending')
    expect(rows.find(r => r.id === 'd').status).toBe('resolved')
  })

  it('delete removes only the filtered rows', async () => {
    await q().delete().eq('client_id', 'c2')
    expect(ids(rows)).toEqual(['a', 'b', 'd'])
  })

  it('update honours several chained filters', async () => {
    await q().update({ status: 'X' }).eq('client_id', 'c1').eq('status', 'open')
    expect(rows.map(r => `${r.id}:${r.status}`)).toEqual(['a:X', 'b:pending', 'c:open', 'd:resolved'])
  })

  it('update and delete return the affected rows', async () => {
    expect(ids((await q().update({ n: 0 }).eq('id', 'b')).data)).toEqual(['b'])
    expect(ids((await q().delete().in('id', ['a', 'd'])).data)).toEqual(['a', 'd'])
  })

  it('supports update(...).select().single()', async () => {
    const { data } = await q().update({ n: 99 }).eq('id', 'a').select().single()
    expect(data.n).toBe(99)
  })
})

describe('insert', () => {
  it('persists so the next read sees it', async () => {
    await q().insert({ id: 'e', client_id: 'c1', status: 'open', tags: [] })
    expect(ids((await q().select('*').eq('client_id', 'c1')).data)).toEqual(['a', 'b', 'd', 'e'])
  })

  it('generates an id when none is supplied', async () => {
    const { data } = await q().insert({ client_id: 'c9' })
    expect(typeof data[0].id).toBe('string')
    expect(data[0].id.length).toBeGreaterThan(0)
  })

  it('does not clobber a generated id when the payload carries an explicit undefined', async () => {
    // Spread order bug: `{ id: gen, ...row }` resets id to undefined when the
    // payload has an `id` key set to undefined, colliding every React list key.
    const { data } = await q().insert({ id: undefined, client_id: 'c9' })
    expect(data[0].id).toBeDefined()
  })
})

describe('edge cases', () => {
  it('an empty table filters to empty without throwing', async () => {
    const { data } = await createQuery(() => []).select('*').eq('x', 1)
    expect(data).toEqual([])
  })

  it('reads reflect a preceding write', async () => {
    await q().update({ status: 'R' }).eq('id', 'a')
    expect(ids((await q().select('*').eq('status', 'R')).data)).toEqual(['a'])
  })
})
