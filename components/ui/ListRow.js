'use client'

/**
 * ListRow — selectable row for list/inbox surfaces. Height comes off the
 * shared density scale (--row-h-sm|md|lg from globals.css) so rows line up
 * across inbox / leads / bookings. `role="option"` (a listbox-item contract,
 * not a native <button>) is why activation is wired manually via
 * onKeyDown — Enter/Space call the same onClick handler a mouse click would.
 *
 * The density value is a MIN height, not a fixed one — a real bug shipped
 * from getting this wrong: ThreadRow (Phase 2) added an optional 4th line for
 * tag chips, and a fixed height let that line overflow visibly into the row
 * below rather than growing to fit. A fixed height was fine as long as every
 * row's content was uniform; the moment a row can carry variable content
 * (tags present or not), the container has to be allowed to grow.
 */

const ROW_H = { sm: 'var(--row-h-sm)', md: 'var(--row-h-md)', lg: 'var(--row-h-lg)' }

export default function ListRow({ selected, onClick, density = 'lg', children }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.(e)
    }
  }

  return (
    <div
      role="option"
      aria-selected={!!selected}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center gap-3 px-[var(--pane-pad)] py-2 cursor-pointer transition-colors duration-200 border-b border-white/[0.04] last:border-0 ${
        selected ? 'bg-[var(--accent-soft)]' : 'hover:bg-white/[0.03]'
      }`}
      style={{ minHeight: ROW_H[density] || ROW_H.lg, fontFamily: 'var(--font-jakarta)' }}
    >
      {selected && (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: 'var(--accent)' }} aria-hidden="true" />
      )}
      {children}
    </div>
  )
}
