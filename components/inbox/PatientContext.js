'use client'

/**
 * PatientContext — content for the 3-pane inbox's right-hand context rail.
 * Renders its own `ContextPanel` (the shared chrome — header + scrollable
 * body) and fills it with three `ContextSection`s: Identity, Conversation,
 * AI summary. `thread == null` still renders inside ContextPanel so the rail
 * keeps its glass frame at all times; only the body swaps to an EmptyState.
 *
 * `messageCount` is a separate prop from `thread.messages.length` on purpose
 * — the caller may be tracking a live message list (realtime inserts) that
 * has diverged from the thread snapshot, so the count is passed in rather
 * than derived here.
 */

import { Avatar, ChannelBadge, ContextPanel, ContextSection, EmptyState } from '@/components/ui'
import { maskIdentity, formatTimestamp } from '@/lib/inbox'

function Spinner({ size = 12, color = 'var(--ink-1)', trackColor = 'var(--ink-4)' }) {
  return (
    <span
      className="inline-block rounded-full animate-spin shrink-0"
      style={{ width: size, height: size, border: `2px solid ${trackColor}`, borderTopColor: color }}
      aria-hidden="true"
    />
  )
}

export default function PatientContext({ thread, messageCount, summary, summarizing, onSummarize, onDismissSummary }) {
  if (!thread) {
    return (
      <ContextPanel title="Patient Context">
        <EmptyState
          title="No conversation selected"
          description="Pick a conversation from the list to see patient context here."
        />
      </ContextPanel>
    )
  }

  const channel = thread.channel || 'whatsapp'
  const displayName = maskIdentity(thread.sender_id, thread.channel, thread.username, thread.displayName)
  const senderId = thread.sender_id || thread.phone || 'Unknown'
  const firstSeen = thread.messages?.[0]?.created_at

  return (
    <ContextPanel title="Patient Context">
      <ContextSection label="Identity">
        <div className="flex items-center gap-3 mb-2.5">
          <Avatar name={displayName} channel={channel} size={56} />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[var(--ink-1)] truncate">{displayName}</p>
            <div className="mt-1">
              <ChannelBadge channel={channel} />
            </div>
          </div>
        </div>
        <p className="text-[11px] font-mono text-[var(--ink-4)] truncate" title={senderId}>
          {senderId}
        </p>
      </ContextSection>

      <ContextSection label="Conversation">
        <dl className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--ink-3)]">Messages</dt>
            <dd className="tnum text-[var(--ink-1)] font-medium">{messageCount ?? 0}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--ink-3)] shrink-0">First seen</dt>
            <dd className="tnum text-[var(--ink-1)] text-right truncate">
              {firstSeen ? formatTimestamp(firstSeen) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--ink-3)] shrink-0">Last active</dt>
            <dd className="tnum text-[var(--ink-1)] text-right truncate">
              {thread.lastAt ? formatTimestamp(thread.lastAt) : '—'}
            </dd>
          </div>
        </dl>
      </ContextSection>

      <ContextSection label="AI Summary">
        {summary ? (
          <div className="glass sheen rounded-[var(--r-md)] p-3 relative pr-7">
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">{summary}</p>
            <button
              type="button"
              onClick={() => onDismissSummary?.()}
              aria-label="Dismiss summary"
              className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-[var(--ink-4)] hover:text-[var(--ink-1)] hover:bg-white/[0.06] transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : summarizing ? (
          <div className="flex items-center gap-2 text-[12px] text-[var(--ink-3)] py-1">
            <Spinner size={13} />
            Summarizing…
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] text-[var(--ink-3)]">Generate a quick recap of this conversation.</p>
            <button
              type="button"
              onClick={() => onSummarize?.()}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: 'var(--status-open-soft)', color: 'var(--status-open)' }}
            >
              <span aria-hidden="true">✦</span> Summarize
            </button>
          </div>
        )}
      </ContextSection>
    </ContextPanel>
  )
}
