'use client'

/**
 * AssigneeSelector — popover assignee picker. Shows the current assignee as
 * an Avatar + name, or "Unassigned" in muted text when `value` is null. Menu:
 * "Unassigned" first, then each ACTIVE staff member (inactive staff aren't
 * assignable to new work). If `value` currently points at an inactive staff
 * member, that member is still shown pinned at the top of the assignable list
 * — labeled "Inactive" — so existing state is never silently hidden. Same
 * open/close/keyboard pattern as PrioritySelector.js.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '@/components/ui'

const SIZES = {
  sm: { trigger: 'px-1.5 py-1', avatar: 20, menuItem: 'px-2.5 py-1.5 text-[12px]', menuAvatar: 20 },
  md: { trigger: 'px-2 py-1.5', avatar: 24, menuItem: 'px-3 py-2 text-[13px]', menuAvatar: 24 },
}

export default function AssigneeSelector({ staff, value, onChange, size = 'md' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const s = SIZES[size] || SIZES.md

  const current = useMemo(() => (staff || []).find((st) => st.id === value) || null, [staff, value])
  const assignable = useMemo(() => (staff || []).filter((st) => st.active), [staff])
  // The current assignee stays visible even if inactive (pinned to the top),
  // so picking a different assignee never quietly erases who it's on now.
  const menuStaff = useMemo(() => {
    if (current && !current.active) return [current, ...assignable]
    return assignable
  }, [current, assignable])

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function select(staffId) {
    onChange(staffId)
    setOpen(false)
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={current ? `Assigned to ${current.name}. Click to change` : 'Unassigned. Click to assign'}
        className={`inline-flex items-center gap-2 rounded-full transition-colors hover:bg-white/[0.06] ${s.trigger}`}
        style={{ fontFamily: 'var(--font-jakarta)' }}
      >
        {current ? (
          <>
            <Avatar name={current.name} src={current.avatar_url} size={s.avatar} />
            <span className="text-[12.5px] text-[var(--ink-1)]">{current.name}</span>
          </>
        ) : (
          <span className="text-[12px] text-[var(--ink-3)]">Unassigned</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Set assignee"
          className="glass-overlay sheen absolute left-0 top-full mt-1.5 w-52 rounded-[var(--r-sm)] z-50 overflow-hidden py-1 max-h-72 overflow-y-auto"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => select(null)}
            className={`w-full text-left ${s.menuItem} text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors`}
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            Unassigned
          </button>
          {menuStaff.map((st) => (
            <button
              key={st.id}
              type="button"
              role="menuitem"
              onClick={() => select(st.id)}
              className={`w-full text-left flex items-center gap-2 ${s.menuItem} hover:bg-white/[0.06] transition-colors`}
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              <Avatar name={st.name} src={st.avatar_url} size={s.menuAvatar} />
              <span className="text-[var(--ink-1)] truncate">{st.name}</span>
              {!st.active && (
                <span className="ml-auto shrink-0 text-[10px] text-[var(--ink-3)]">Inactive</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
