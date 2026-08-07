/**
 * MessageBubble — one message in the 3-pane inbox's chat panel. Reproduces
 * the bubble behaviour of the reference conversations page (role label,
 * media rendering, timestamp line, delivery receipt) with deliberate
 * token-driven deviations from the original hardcoded colors — see the
 * DEVIATION notes below. No local state or handlers, so no 'use client'.
 *
 * DEVIATION 3 — "Tahsin.ai" and the "Read" receipt used --accent (mint) as
 * inline-style text originally; swapped to --status-open, mint's dedicated
 * light-theme-legible pair (measured ~1.3:1 contrast with --accent on the
 * bot bubble's 5% wash in light theme vs. ~3.2:1 with --status-open — an
 * improvement, though still under the 4.5:1 floor for text this small;
 * worth a follow-up if these labels need to read AA-clean).
 *
 * `isLast`: the reference page anchors an empty <div ref={bottomRef} /> after
 * the final message and scrolls it into view on every liveMessages change.
 * This component can't own that ref (purely presentational, no ref prop in
 * the contract), so when `isLast` is true it renders an inert marker
 * (`data-message-anchor="bottom"`) the parent can query
 * (`querySelector('[data-message-anchor="bottom"]')`) and scroll to instead.
 */

import { parseMediaMessage, formatTimestamp, failureReason, CHANNEL_LABEL } from '@/lib/inbox'

// DEVIATION 1 — the reference's "via <Channel>" label colored itself with
// CHANNEL_META[channel].text (a raw hex per channel). The equivalent
// light/dark-paired token is --ch-{channel}-text (see globals.css "3 ·
// Channel brand"), which is what ChannelBadge's label already uses.
const CH_TEXT = {
  whatsapp: 'var(--ch-whatsapp-text)',
  instagram: 'var(--ch-instagram-text)',
  messenger: 'var(--ch-messenger-text)',
}

// "Read" reuses --status-open, not --accent: both are the same mint in dark
// theme, but --status-open is the token globals.css deliberately darkens for
// light-theme TEXT legibility (see its "2 · Semantic" block) — --accent
// itself stays the bright, unreadable-as-small-text mint in both themes.
const RECEIPT_VIEW = {
  accepted: { label: 'Sent', color: 'var(--ink-4)' },
  sent: { label: 'Sent', color: 'var(--ink-4)' },
  delivered: { label: 'Delivered', color: 'var(--ink-3)' },
  read: { label: 'Read', color: 'var(--status-open)' },
}

function DeliveryReceipt({ delivery }) {
  if (!delivery) return null

  if (delivery.status === 'failed') {
    return (
      <span
        className="inline-flex items-start gap-1 mt-1.5 text-[10px] px-1.5 py-0.5 rounded-md leading-snug border"
        style={{
          color: 'var(--prio-urgent)',
          background: 'var(--prio-urgent-soft)',
          borderColor: 'color-mix(in srgb, var(--prio-urgent) 30%, transparent)',
        }}
      >
        <span className="shrink-0" aria-hidden="true">⚠</span>
        <span>Not delivered — {failureReason(delivery)}</span>
      </span>
    )
  }

  const view = RECEIPT_VIEW[delivery.status]
  if (!view) return null
  const tick = delivery.status === 'delivered' || delivery.status === 'read' ? '✓✓' : '✓'

  return (
    <span className="inline-flex items-center gap-1 mt-1 text-[10px]" style={{ color: view.color }}>
      <span aria-hidden="true">{tick}</span>
      {view.label}
    </span>
  )
}

export default function MessageBubble({ message, channel, delivery, isLast }) {
  if (!message) return null

  const role = message.role
  const isCustomer = role === 'customer'
  const isOwner = role === 'owner'
  const isBot = role === 'bot'
  const msgChannel = message.channel || channel || 'whatsapp'
  const media = parseMediaMessage(message.message)

  // DEVIATION 2 — the reference gave every customer bubble the same
  // hardcoded WhatsApp green (#005c4b) and every owner bubble a hardcoded
  // indigo-600/80, neither of which is a themed token (and indigo has no
  // token equivalent in globals.css at all). Customer uses the paired
  // --glass-bg-strong surface; owner reuses --prio-medium (blue, already
  // light/dark-paired) as the "staff reply" identity color, matching the
  // "You" label and Composer's Suggest/Send actions for a consistent
  // human-vs-bot color language built only from existing tokens.
  const bubbleClassName = isBot ? 'bg-white/[0.05] border border-white/[0.07] rounded-tl-sm' : isCustomer ? 'rounded-tr-sm' : 'rounded-tl-sm'
  const bubbleStyle = isCustomer
    ? { background: 'var(--glass-bg-strong)', color: 'var(--ink-1)' }
    : isOwner
      ? {
          background: 'color-mix(in srgb, var(--prio-medium) 20%, var(--glass-bg-strong))',
          border: '1px solid color-mix(in srgb, var(--prio-medium) 38%, transparent)',
          color: 'var(--ink-1)',
        }
      : { color: 'var(--ink-2)' }

  return (
    <>
      <div className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[62%] rounded-2xl px-4 py-2.5 ${bubbleClassName}`} style={bubbleStyle}>
          {isBot && (
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--status-open)' }}>
              Tahsin.ai
            </p>
          )}
          {isOwner && (
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--prio-medium)' }}>
              You
            </p>
          )}
          {isCustomer && msgChannel !== 'whatsapp' && (
            <p
              className="text-[10px] font-semibold uppercase tracking-wider mb-1"
              style={{ color: CH_TEXT[msgChannel] }}
            >
              via {CHANNEL_LABEL[msgChannel] || msgChannel}
            </p>
          )}

          {media.mediaUrl ? (
            <div className="space-y-1.5">
              {media.mediaType === 'video' ? (
                <video
                  src={media.mediaUrl}
                  controls
                  className="rounded-lg max-w-full object-cover"
                  style={{ maxHeight: 288 }}
                />
              ) : (
                <a href={media.mediaUrl} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote media URL, no image domain allowlist configured */}
                  <img
                    src={media.mediaUrl}
                    alt="attachment"
                    className="rounded-lg max-w-full object-cover"
                    style={{ maxHeight: 288 }}
                  />
                </a>
              )}
              {media.caption && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{media.caption}</p>}
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{message.message}</p>
          )}

          <p
            className="text-[10.5px] mt-1.5"
            style={{ color: isCustomer ? 'var(--ink-3)' : 'var(--ink-4)' }}
          >
            {isCustomer ? 'Customer' : isOwner ? 'Owner' : 'Bot'} · {formatTimestamp(message.created_at)}
          </p>

          {!isCustomer && delivery && (
            <div className="mt-1">
              <DeliveryReceipt delivery={delivery} />
            </div>
          )}
        </div>
      </div>
      {isLast && <div data-message-anchor="bottom" className="h-px w-px" aria-hidden="true" />}
    </>
  )
}
