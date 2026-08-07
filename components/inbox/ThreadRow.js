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

import { Avatar, ChannelBadge, StatusBadge, ListRow } from '@/components/ui'
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

  return (
    <ListRow selected={selected} onClick={() => onSelect?.(thread)} density="lg">
      <Avatar name={displayName} channel={channel} size={38} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-[var(--ink-1)] truncate min-w-0">{displayName}</span>
          <span className="text-[10.5px] text-[var(--ink-4)] tnum shrink-0">{formatTimestamp(thread.lastAt)}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <ChannelBadge channel={channel} showLabel={false} />
          <StatusBadge status={statusVariant(thread.status)} />
        </div>
        <p className="text-[12px] text-[var(--ink-3)] truncate mt-1">{thread.firstMessage}</p>
      </div>
    </ListRow>
  )
}
