/**
 * Pure logic for conversation triage: tags, priority, manual status, assignment.
 * Backs the `conversation_meta` / `client_tags` / `staff` tables added in
 * migrations/003_conversation_meta.sql.
 *
 * NAMING NOTE — two different things are both called "status" in this app, and
 * they must not be confused:
 *   - `thread.status` (from lib/inbox.js buildThreads) is the BOT'S session
 *     state — "Handled by Bot" / "Handed Off" / "Pending" — i.e. who is
 *     currently answering. Unchanged by this file.
 *   - `thread.triageStatus` (added here, from conversation_meta.status) is a
 *     MANUAL staff decision — "did someone mark this open/pending/resolved" —
 *     independent of who's currently answering. A bot-handled thread can be
 *     staff-marked resolved; a human-handled thread can still be open.
 *
 * ASSIGNMENT NOTE — `staff` rows are assignment LABELS, not real logins (see
 * the table comment in the migration). Because every account still signs in
 * as the one shared clinic user, there is no per-session "which agent am I"
 * identity to build YMA's literal "Mine" tab against. The honest equivalent
 * given that constraint is an assignee filter (All / Unassigned / a specific
 * staff member) rather than a tab that silently means nothing.
 */

export const TRIAGE_STATUSES = ['open', 'pending', 'resolved']
export const PRIORITIES = ['urgent', 'high', 'medium', 'low']

const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 }

/**
 * Merge conversation_meta rows onto threads built by lib/inbox.js's
 * buildThreads. A thread with no meta row yet (nobody has triaged it) defaults
 * to triageStatus 'open', no priority, no assignee, no tags — never null/undefined
 * fields that would make every consumer defensive-code the missing-row case.
 *
 * @param {object[]} threads
 * @param {Record<string, object>} metaBySessionId - keyed by session_id
 */
export function mergeMeta(threads, metaBySessionId = {}) {
  return threads.map(t => {
    const meta = metaBySessionId[t.session_id]
    return {
      ...t,
      triageStatus: meta?.status ?? 'open',
      priority: meta?.priority ?? null,
      assigneeId: meta?.assignee_id ?? null,
      tags: meta?.tags ?? [],
    }
  })
}

/**
 * Apply the triage filters on top of lib/inbox.js's filterThreads (channel +
 * search). Composes with AND semantics, same as filterThreads.
 *
 * @param {object[]} threads - already merged via mergeMeta
 * @param {{triageStatus?: string, assigneeId?: string|null, tag?: string}} criteria
 *   `assigneeId: null` means "unassigned" (not "no filter") — pass the key
 *   absent entirely to mean no filter. `assigneeId: 'any'` means "assigned to
 *   someone, don't care who".
 */
export function filterByTriage(threads, criteria = {}) {
  return threads.filter(t => {
    if (criteria.triageStatus && criteria.triageStatus !== 'all' && t.triageStatus !== criteria.triageStatus) {
      return false
    }
    if ('assigneeId' in criteria) {
      if (criteria.assigneeId === 'any') {
        if (!t.assigneeId) return false
      } else if (criteria.assigneeId !== t.assigneeId) {
        return false
      }
    }
    if (criteria.tag && !t.tags.includes(criteria.tag)) return false
    return true
  })
}

/** Counts for the status segmented tabs. */
export function triageStatusCounts(threads) {
  const counts = { all: threads.length, open: 0, pending: 0, resolved: 0 }
  for (const t of threads) counts[t.triageStatus] = (counts[t.triageStatus] || 0) + 1
  return counts
}

/**
 * Sort threads by priority (urgent first), falling back to most-recent-active
 * within the same priority tier. Threads with no priority sort last.
 */
export function sortByPriority(threads) {
  return [...threads].sort((a, b) => {
    const ra = a.priority ? PRIORITY_RANK[a.priority] : 99
    const rb = b.priority ? PRIORITY_RANK[b.priority] : 99
    if (ra !== rb) return ra - rb
    return new Date(b.lastAt) - new Date(a.lastAt)
  })
}

/**
 * Normalize a free-typed tag name for the "does this tag already exist"
 * check — case/whitespace-insensitive so a clinic can't end up with "VIP" and
 * "vip" as two separate tags in the catalogue.
 */
export function normalizeTagName(name) {
  return (name || '').trim().toLowerCase()
}

/** Find an existing catalogue tag matching a typed name, case-insensitively. */
export function findExistingTag(catalogue, name) {
  const norm = normalizeTagName(name)
  if (!norm) return null
  return catalogue.find(t => normalizeTagName(t.name) === norm) || null
}
