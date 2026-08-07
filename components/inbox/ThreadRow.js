'use client'

/**
 * ThreadRow — one row in the 3-pane inbox's thread list. Built on top of the
 * shared `ListRow` primitive, which already owns the selectable-row chrome
 * (row height off --row-h-lg, the accent left-border + soft wash on
 * `selected`, and Enter/Space keyboard activation) — this component only
 * supplies the thread-specific content.
 *
 * Layout is 3 stacked lines next to the avatar rather than one wide row,
 * deliberately: at the 340px `--pane-list` width the row must truncate, not
 * wrap or overflow, and a StatusBadge chip + a full timestamp string don't
 * both fit on one line without one crowding out the other.
 */

import { Avatar, ChannelBadge, StatusBadge, PriorityBadge, Tag, ListRow } from '@/components/ui'
import { maskIdentity, formatTimestamp } from '@/lib/inbox'

const STATUS_MAP = {
  'Handled by Bot': 'open',
  'Handed Off': 'pending',
}

function statusVariant(status) {
  return STATUS_MAP[status] || 'resolved'
}

export default function ThreadRow({ thread, selected, onSelect }) {
  if (!thread) return null

  const channel = thread.channel || 'whatsapp'
  const displayName = maskIdentity(thread.sender_id, thread.channel, thread.username, thread.displayName)
  // thread.tags/.priority/.triageStatus come from lib/triage.js's mergeMeta —
  // absent when the caller hasn't wired triage in yet, so every read below
  // defaults rather than assuming the field exists.
  const tags = thread.tags || []
  const isResolved = thread.triageStatus === 'resolved'

  return (
    <ListRow selected={selected} onClick={() => onSelect?.(thread)} density="lg">
      <Avatar name={displayName} channel={channel} size={38} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-[var(--ink-1)] truncate min-w-0">{displayName}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {thread.priority && <PriorityBadge priority={thread.priority} variant="dot" />}
            <span className="text-[10.5px] text-[var(--ink-4)] tnum">{formatTimestamp(thread.lastAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <ChannelBadge channel={channel} showLabel={false} />
          <StatusBadge status={statusVariant(thread.status)} />
          {/* Distinct visual language from StatusBadge on purpose — see the
              file header. This is manual triage state; the badge above is the
              bot's session state. Reusing the same colored-pill vocabulary for
              both would read as one signal that just happens to be redundant
              or contradictory. */}
          {isResolved && (
            <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: 'var(--ink-4)' }} title="Marked resolved">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-3 h-3" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
          )}
        </div>
        <p className="text-[12px] text-[var(--ink-3)] truncate mt-1">{thread.firstMessage}</p>
        {tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 overflow-hidden">
            {tags.slice(0, 2).map(name => <Tag key={name} label={name} size="sm" />)}
            {tags.length > 2 && (
              <span className="text-[10px] text-[var(--ink-4)] shrink-0">+{tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </ListRow>
  )
}
