/**
 * Pure logic for the inbox, lifted verbatim out of app/(portal)/conversations/page.js
 * as the first step of the Phase 1 rewrite.
 *
 * WHY THIS EXISTS
 * That page was 1,037 lines mixing data fetching, realtime subscriptions,
 * optimistic sends and rendering. The subtlest code in the whole product lives
 * in here — `reconcileMessage` decides whether a patient sees one message or two,
 * `buildDeliveryMap` decides whether a "not delivered" warning lands on the right
 * bubble — and none of it was reachable by a test.
 *
 * Extracting it FIRST, before the components move, means the rewrite is provable:
 * these functions are locked by lib/__tests__/inbox.test.js, so if the refactor
 * changes their behaviour the tests fail rather than a patient getting a
 * duplicated message in production.
 *
 * Behaviour here is deliberately IDENTICAL to the original. Where the original
 * had a quirk, the quirk is preserved and documented rather than "improved" —
 * this file is a safety net, not a redesign.
 */

// ── Channel metadata ─────────────────────────────────────────────────────────

export const CHANNELS = ['whatsapp', 'instagram', 'messenger']

export const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
}

/**
 * Map the bot's session_status strings onto the design system's status tokens.
 *
 * Exported so the thread row and the chat header can't drift into disagreeing
 * about what colour a conversation is — they render the same conversation at the
 * same moment, two feet apart on screen.
 *
 * "Handed Off" maps to `pending`, not `resolved`: a human being needed is the
 * state that wants attention, and amber is the colour that asks for it.
 */
export function statusToken(status) {
  if (status === 'Handled by Bot') return 'open'
  if (status === 'Handed Off') return 'pending'
  return 'resolved'
}

// ── Identity ─────────────────────────────────────────────────────────────────

/**
 * Human-readable sender label.
 *
 * username/displayName come from the bot's Graph API resolution
 * (rag_server.py resolve_channel_identity), cached on the thread's most recent
 * conversation row. Falls back to a masked internal id when a sender hasn't been
 * resolved yet (brand-new conversation) or resolution failed (no page token).
 */
export function maskIdentity(id, channel, username, displayName) {
  if (channel === 'instagram' && username) return `@${username}`
  if (channel === 'messenger' && displayName) return displayName
  if (!id) return 'Unknown'
  if (channel === 'instagram') return `@ig_${id.slice(-6)}`
  if (channel === 'messenger') return `msg_${id.slice(-6)}`
  // WhatsApp: mask the phone number
  return id.slice(0, -6) + '***-**' + id.slice(-2)
}

/**
 * Find the best-known identity across a thread's messages.
 *
 * The bot backfills sender_username/sender_display_name onto every row of a
 * session once resolution completes, but resolution can be mid-flight — so scan
 * from the MOST RECENT message backwards, or a not-yet-backfilled older row
 * shadows the resolved newer one.
 */
export function pickIdentity(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.sender_username || m.sender_display_name) {
      return { username: m.sender_username || null, displayName: m.sender_display_name || null }
    }
  }
  return { username: null, displayName: null }
}

/** WhatsApp ids are stored without a leading '+'; IG/Messenger ids pass through. */
export function normalizeIdentity(id) {
  return id ? id.replace(/^\+/, '') : ''
}

// ── Message reconciliation ───────────────────────────────────────────────────

/**
 * Merge a realtime INSERT into the visible message list.
 *
 * A staff reply is rendered optimistically (id `opt_<ts>`) the instant it's sent,
 * and the same message then arrives again as a realtime INSERT carrying the real
 * DB row. Without this, both render and the patient's conversation shows the
 * message twice. Matching is by role + exact body, replacing the optimistic entry
 * in place so the bubble doesn't jump position.
 */
export function reconcileMessage(list, newRow) {
  const optIdx = list.findIndex(m =>
    typeof m.id === 'string' && m.id.startsWith('opt_') &&
    m.role === newRow.role && m.message === newRow.message
  )
  if (optIdx === -1) return [...list, newRow]
  const next = [...list]
  next[optIdx] = newRow
  return next
}

// ── Media ────────────────────────────────────────────────────────────────────

const IMAGE_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp)(\?.*)?$/i
const VIDEO_RE = /\.(mp4|mov|m4v|webm|3gp|mkv)(\?.*)?$/i

/**
 * A media message is logged as the URL alone, optionally followed by a caption.
 * Parse it back apart so the bubble can render the image/video inline.
 */
export function parseMediaMessage(raw) {
  const text = (raw || '').trim()
  const firstToken = text.split(/\s+/)[0] || ''
  const isUrl = /^https?:\/\//i.test(firstToken)
  if (isUrl && IMAGE_RE.test(firstToken)) {
    return { mediaUrl: firstToken, mediaType: 'image', caption: text.slice(firstToken.length).trim() }
  }
  if (isUrl && VIDEO_RE.test(firstToken)) {
    return { mediaUrl: firstToken, mediaType: 'video', caption: text.slice(firstToken.length).trim() }
  }
  return { mediaUrl: null, mediaType: null, caption: text }
}

// ── Delivery receipts ────────────────────────────────────────────────────────

function normForMatch(s) {
  return (s || '').slice(0, 120).toLowerCase()
}

/**
 * Pair outbound messages with their Meta delivery receipts.
 *
 * `message_delivery` rows carry only a truncated `body_preview`, not a message
 * id, so matching is by body-prefix (in EITHER direction, since either side may
 * be the truncated one) plus nearest timestamp. Each delivery row is consumed at
 * most once, so two identical messages sent minutes apart can't both claim the
 * same receipt — otherwise a stale "not delivered" warning lands on the wrong
 * bubble and the clinic re-sends something the patient already got.
 */
export function buildDeliveryMap(messages, deliveries) {
  const map = new Map()
  if (!deliveries || deliveries.length === 0) return map
  const pool = deliveries.map(d => ({ d, used: false }))

  for (const msg of messages || []) {
    if (!msg) continue
    // Only outbound (clinic → patient) messages carry a receipt.
    if (msg.role !== 'bot' && msg.role !== 'owner') continue
    const body = normForMatch(msg.message)
    if (!body) continue
    const msgTime = new Date(msg.created_at).getTime()

    let best = null
    let bestDelta = Infinity
    for (const entry of pool) {
      if (entry.used) continue
      const prev = normForMatch(entry.d.body_preview)
      if (!prev) continue
      if (!(body.startsWith(prev) || prev.startsWith(body))) continue
      const delta = Math.abs(new Date(entry.d.created_at).getTime() - msgTime)
      if (delta < bestDelta) { bestDelta = delta; best = entry }
    }
    if (best) { best.used = true; map.set(msg.id, best.d) }
  }
  return map
}

/** Patient-facing explanation for a failed send, by Meta error code. */
export function failureReason(d) {
  const code = String(d.error_code || '')
  if (d.lane === 'clinic') {
    if (code === '131047') return 'Outside the 24-hour window — send an approved template to reply.'
    if (code === '131026') return "This number can't receive WhatsApp messages."
    if (code === '131053') return 'Media could not be delivered — try resending the attachment.'
    return d.error_title || 'Could not be delivered to this patient.'
  }
  if (d.lane === 'transient') return 'Temporary delivery issue — retrying automatically.'
  return 'Delivery issue on our side — the team has been alerted.'
}

// ── Thread assembly ──────────────────────────────────────────────────────────

/**
 * Group flat conversation rows into threads, newest-active first.
 *
 * Two deliberate rules, both load-bearing and both preserved from the original:
 *  - channel and status come from the LAST message, not the first. A patient can
 *    switch channels mid-relationship (old WhatsApp history, new Instagram DM),
 *    and a thread that was handed off once must not read as handed-off forever
 *    after the bot resumes.
 *  - a row with no session_id gets a synthetic one keyed on its row id, so
 *    orphaned rows each become their own thread rather than merging into one
 *    giant bogus conversation.
 */
export function buildThreads(rows) {
  const map = {}
  for (const row of rows || []) {
    const sid = row.session_id || ('nosession_' + row.id)
    if (!map[sid]) map[sid] = []
    map[sid].push(row)
  }

  return Object.entries(map).map(([sid, messages]) => ({
    session_id: sid,
    sender_id: messages[0]?.phone_number || sid,
    channel: messages[messages.length - 1]?.channel || messages[0]?.channel || 'whatsapp',
    phone: messages[0]?.phone_number || 'Unknown',
    status: messages[messages.length - 1]?.session_status || messages[0]?.session_status || 'Handled by Bot',
    firstMessage: messages.find(m => m.role === 'customer')?.message || messages[0]?.message,
    lastAt: messages[messages.length - 1]?.created_at,
    ...pickIdentity(messages),
    messages,
  })).sort(byLastActive)
}

/** Newest activity first. Exported so the realtime path re-sorts identically. */
export function byLastActive(a, b) {
  return new Date(b.lastAt) - new Date(a.lastAt)
}

// ── Filtering ────────────────────────────────────────────────────────────────

/**
 * Apply the inbox's channel filter and free-text search together.
 *
 * Search matches the sender id OR any message body in the thread — a clinic
 * looks people up by both "who" and "what they said".
 */
export function filterThreads(threads, { channel = 'all', search = '' } = {}) {
  const q = (search || '').toLowerCase().trim()
  return (threads || []).filter(t => {
    if (channel !== 'all' && (t.channel || 'whatsapp') !== channel) return false
    if (!q) return true
    if ((t.sender_id || t.phone || '').toLowerCase().includes(q)) return true
    return (t.messages || []).some(m => m.message?.toLowerCase().includes(q))
  })
}

/** Per-channel counts for the folder rail, plus an `all` total. */
export function channelCounts(threads) {
  return (threads || []).reduce((acc, t) => {
    const ch = t.channel || 'whatsapp'
    acc[ch] = (acc[ch] || 0) + 1
    acc.all = (acc.all || 0) + 1
    return acc
  }, {})
}

// ── Formatting ───────────────────────────────────────────────────────────────

export function formatTimestamp(ts) {
  const date = new Date(ts)
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ', ' + date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
}
