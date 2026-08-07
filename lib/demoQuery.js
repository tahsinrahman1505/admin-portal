/**
 * A small, faithful-enough PostgREST query engine over the in-memory demo
 * fixtures. Extracted from lib/supabase.js so it can be unit-tested directly.
 *
 * WHY THIS EXISTS
 * The original demo mock stubbed every filter as a no-op that returned the whole
 * table (`eq() { return builder }`, and so on for ~16 operators). That was fine
 * while the demo only ever listed rows, but it fails in two ways that matter now:
 *
 *   1. Filter UIs look broken. Anything that narrows a list — channel tabs, a
 *      status filter, a tag filter — appears to do nothing on the demo site,
 *      because every query returns everything regardless.
 *   2. It makes tests lie. An end-to-end test asserting "filtering by tag shows
 *      only tagged rows" would PASS against a mock that ignores the tag filter,
 *      because the seed happens to contain the row it looked for. A green test
 *      that cannot fail is worse than no test.
 *
 * SCOPE — deliberate limitations, documented rather than hidden:
 *   • No column projection. `.select('id, name')` returns whole rows. Projecting
 *     would be more faithful, but PostgREST's select string also expresses
 *     embedded joins (`select('*, doctors(*)')`) which this cannot resolve, so
 *     half-implementing projection would break more than it verifies.
 *   • `.or()` splits on commas, so a filter VALUE containing a literal comma
 *     parses wrongly. Real PostgREST allows quoting; no call site needs it.
 *   • Ordering follows Postgres defaults (NULLS LAST ascending, NULLS FIRST
 *     descending) but does not implement per-column collation.
 */

// ── Pattern + comparison helpers ────────────────────────────────────────────

const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g

/** SQL LIKE → RegExp. `%` is any run, `_` is exactly one char. */
function likeToRegExp(pattern, caseInsensitive) {
  const escaped = String(pattern)
    .replace(REGEX_SPECIALS, '\\$&')   // neutralise regex metachars first…
    .replace(/%/g, '.*')               // …then re-introduce the SQL wildcards
    .replace(/_/g, '.')
  return new RegExp(`^${escaped}$`, caseInsensitive ? 'i' : '')
}

/**
 * Ordering comparison. Numbers compare numerically; everything else compares as
 * a string. ISO-8601 timestamps sort correctly under string comparison, which is
 * why every fixture stores dates as ISO strings.
 */
function compareValues(a, b) {
  if (a === b) return 0
  if (a === null || a === undefined) return 1   // caller re-orients for direction
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : 1
  return String(a) < String(b) ? -1 : 1
}

function isNullish(v) {
  return v === null || v === undefined
}

/** One PostgREST operator applied to one cell. */
function applyOperator(cell, op, value) {
  switch (op) {
    case 'eq':  return cell === value
    case 'neq': return cell !== value
    case 'gt':  return !isNullish(cell) && compareValues(cell, value) > 0
    case 'gte': return !isNullish(cell) && compareValues(cell, value) >= 0
    case 'lt':  return !isNullish(cell) && compareValues(cell, value) < 0
    case 'lte': return !isNullish(cell) && compareValues(cell, value) <= 0
    case 'like':  return !isNullish(cell) && likeToRegExp(value, false).test(String(cell))
    case 'ilike': return !isNullish(cell) && likeToRegExp(value, true).test(String(cell))
    case 'in':    return Array.isArray(value) && value.includes(cell)
    case 'is': {
      if (value === null) return isNullish(cell)
      return cell === value
    }
    // Array containment (`@>`): every needle must be present in the cell array.
    // This is what a text[] tag column is filtered with.
    case 'contains': {
      if (!Array.isArray(cell)) return false
      const needles = Array.isArray(value) ? value : [value]
      return needles.every(n => cell.includes(n))
    }
    // Array overlap (`&&`): any needle present.
    case 'overlaps': {
      if (!Array.isArray(cell)) return false
      const needles = Array.isArray(value) ? value : [value]
      return needles.some(n => cell.includes(n))
    }
    default:
      throw new Error(`demoQuery: unsupported operator "${op}"`)
  }
}

/**
 * Parse one `.or()` term, e.g. `name.ilike.%ali%`.
 * PostgREST's own grammar: column.operator.value, value may itself contain dots
 * (a timestamp does), so only the FIRST TWO dots are separators.
 */
function parseOrTerm(term) {
  const first = term.indexOf('.')
  const second = term.indexOf('.', first + 1)
  if (first === -1 || second === -1) return null
  const column = term.slice(0, first)
  const op = term.slice(first + 1, second)
  let raw = term.slice(second + 1)
  if (raw === 'null') raw = null
  else if (raw === 'true') raw = true
  else if (raw === 'false') raw = false
  return { column, op, value: raw }
}

// ── The builder ──────────────────────────────────────────────────────────────

/**
 * @param {() => object[]} getRows  returns the LIVE row array for the table
 */
export function createQuery(getRows) {
  const predicates = []
  const orderSpecs = []
  let limitCount = null
  let rangeSpec = null
  let headOnly = false
  // Deferred mutation. supabase-js puts the filter AFTER the verb —
  // `.update(payload).eq('id', x)` — so a mutation that executed eagerly inside
  // update()/delete() would run with ZERO filters registered and hit every row
  // in the table. Mutations are therefore recorded here and executed at the
  // terminal step (then/single/maybeSingle), once the filters are all present.
  let pending = null

  const addFilter = (column, op, value) => {
    predicates.push(row => applyOperator(row[column], op, value))
  }

  /** Rows matching every accumulated filter — LIVE objects, so writes stick. */
  function matched() {
    return getRows().filter(row => predicates.every(p => p(row)))
  }

  /** matched() plus ordering and pagination — the shape a SELECT returns. */
  function resolved() {
    let out = matched()

    for (let i = orderSpecs.length - 1; i >= 0; i--) {
      const { column, ascending, nullsFirst } = orderSpecs[i]
      out = [...out].sort((a, b) => {
        const av = a[column]
        const bv = b[column]
        const aNull = isNullish(av)
        const bNull = isNullish(bv)
        if (aNull && bNull) return 0
        // Postgres: NULLS LAST for ASC, NULLS FIRST for DESC — unless overridden.
        if (aNull) return nullsFirst ? -1 : 1
        if (bNull) return nullsFirst ? 1 : -1
        const cmp = compareValues(av, bv)
        return ascending ? cmp : -cmp
      })
    }

    if (rangeSpec) out = out.slice(rangeSpec.from, rangeSpec.to + 1)
    if (limitCount !== null) out = out.slice(0, limitCount)
    return out
  }

  /**
   * Execute a deferred update/delete against the filtered set.
   * Returns the affected rows, or null when there was no mutation queued.
   */
  function runPending() {
    if (!pending) return null
    const targets = matched()
    const op = pending
    pending = null

    if (op.kind === 'update') {
      for (const row of targets) Object.assign(row, op.payload)
      return targets
    }

    // delete — splice in reverse so earlier indices stay valid mid-loop,
    // then restore source order for the returned payload.
    const doomed = new Set(targets)
    const rows = getRows()
    const removed = []
    for (let i = rows.length - 1; i >= 0; i--) {
      if (doomed.has(rows[i])) removed.push(...rows.splice(i, 1))
    }
    return removed.reverse()
  }

  const builder = {
    // ── filters ──────────────────────────────────────────────────────────────
    eq(c, v)  { addFilter(c, 'eq', v);  return builder },
    neq(c, v) { addFilter(c, 'neq', v); return builder },
    gt(c, v)  { addFilter(c, 'gt', v);  return builder },
    gte(c, v) { addFilter(c, 'gte', v); return builder },
    lt(c, v)  { addFilter(c, 'lt', v);  return builder },
    lte(c, v) { addFilter(c, 'lte', v); return builder },
    like(c, v)  { addFilter(c, 'like', v);  return builder },
    ilike(c, v) { addFilter(c, 'ilike', v); return builder },
    in(c, v)    { addFilter(c, 'in', v);    return builder },
    is(c, v)    { addFilter(c, 'is', v);    return builder },
    contains(c, v) { addFilter(c, 'contains', v); return builder },
    overlaps(c, v) { addFilter(c, 'overlaps', v); return builder },

    not(c, op, v) {
      predicates.push(row => !applyOperator(row[c], op, v))
      return builder
    },

    filter(c, op, v) { addFilter(c, op, v); return builder },

    match(obj) {
      for (const [c, v] of Object.entries(obj)) addFilter(c, 'eq', v)
      return builder
    },

    /** `.or('a.eq.1,b.ilike.%x%')` — the terms are OR'd with each other. */
    or(expression) {
      const terms = String(expression).split(',').map(parseOrTerm).filter(Boolean)
      predicates.push(row => terms.some(t => {
        try { return applyOperator(row[t.column], t.op, t.value) } catch { return false }
      }))
      return builder
    },

    // ── shaping ──────────────────────────────────────────────────────────────
    order(column, opts = {}) {
      orderSpecs.push({
        column,
        ascending: opts.ascending !== false,
        nullsFirst: opts.nullsFirst ?? (opts.ascending === false),
      })
      return builder
    },
    limit(n) { limitCount = n; return builder },
    range(from, to) { rangeSpec = { from, to }; return builder },

    select(_columns, opts) {
      // Projection is intentionally not implemented — see the header note.
      if (opts && opts.head) headOnly = true
      return builder
    },

    // ── terminal single-row ops ──────────────────────────────────────────────
    // Faithful to supabase-js: single() ERRORS unless exactly one row matched;
    // maybeSingle() tolerates zero. The old mock always returned rows[0], which
    // hid "my filter matched nothing" behind a plausible-looking row.
    single() {
      const mutated = runPending()
      const rows = mutated ?? resolved()
      if (rows.length === 1) return Promise.resolve({ data: rows[0], error: null })
      return Promise.resolve({
        data: null,
        error: {
          code: 'PGRST116',
          message: rows.length === 0
            ? 'JSON object requested, multiple (or no) rows returned'
            : `More than one row returned (${rows.length})`,
          details: 'demo mode',
        },
      })
    },
    maybeSingle() {
      const mutated = runPending()
      const rows = mutated ?? resolved()
      return Promise.resolve({ data: rows[0] ?? null, error: null })
    },

    // ── mutations (persist for the page session) ─────────────────────────────
    insert(payload) {
      const incoming = Array.isArray(payload) ? payload : [payload]
      // Defaults go AFTER the spread on purpose: if `row` carries an explicit
      // `id: undefined` key, spreading it last would clobber the generated id
      // back to undefined and every React list key would collide on `undefined`.
      const created = incoming.map((row, i) => ({
        ...row,
        id: row.id ?? `demo-${Date.now()}-${i}`,
        created_at: row.created_at ?? new Date().toISOString(),
      }))
      getRows().push(...created)
      return makeSettled(created)
    },

    // Deferred — see `pending` above. Returns the builder so the caller can go
    // on to attach the filters that decide WHICH rows are affected.
    update(payload) {
      pending = { kind: 'update', payload }
      return builder
    },

    upsert(payload) {
      const incoming = Array.isArray(payload) ? payload : [payload]
      const rows = getRows()
      const result = incoming.map(next => {
        const idx = next.id ? rows.findIndex(r => r.id === next.id) : -1
        if (idx >= 0) { Object.assign(rows[idx], next); return rows[idx] }
        const created = {
          ...next,
          id: next.id ?? `demo-${Date.now()}`,
          created_at: next.created_at ?? new Date().toISOString(),
        }
        rows.push(created)
        return created
      })
      return makeSettled(result)
    },

    // Deferred — see `pending` above.
    delete() {
      pending = { kind: 'delete' }
      return builder
    },

    // Awaitable: `await supabase.from(t).select(...).eq(...)`
    then(onFulfilled, onRejected) {
      const mutated = runPending()
      if (mutated) {
        return Promise.resolve({ data: mutated, count: mutated.length, error: null })
          .then(onFulfilled, onRejected)
      }
      const rows = resolved()
      const payload = headOnly
        ? { data: null, count: matched().length, error: null }
        : { data: rows, count: matched().length, error: null }
      return Promise.resolve(payload).then(onFulfilled, onRejected)
    },
  }

  return builder
}

/**
 * A resolved mutation result that is still chainable — supabase-js allows
 * `.insert(x).select()` and `.delete().eq(...)`, and call sites await either the
 * mutation directly or the chained select.
 */
function makeSettled(rows) {
  const settled = {
    select() { return settled },
    single()      { return Promise.resolve({ data: rows[0] ?? null, error: null }) },
    maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }) },
    eq() { return settled },
    in() { return settled },
    match() { return settled },
    order() { return settled },
    limit() { return settled },
    then(onFulfilled, onRejected) {
      return Promise.resolve({ data: rows, count: rows.length, error: null })
        .then(onFulfilled, onRejected)
    },
  }
  return settled
}
