'use client'

/**
 * Tag — rounded chip, optionally removable. Background is a low-alpha wash
 * of `color` via `color-mix(in srgb, ${color} 14%, transparent)` so any
 * semantic token (or a caller-supplied color) gets a correctly-tinted
 * backdrop without needing a bespoke `-soft` CSS variable per color. The
 * remove button's hover wash uses `bg-white/10` (not a raw color) — the
 * `--color-white` token flips per theme, so it reads as a light wash in dark
 * mode and a dark wash in light mode automatically.
 */

const SIZES = {
  sm: { pad: 'pl-2 pr-1.5 py-0.5', text: 'text-[10.5px]', dot: 'w-1.5 h-1.5', btn: 'w-3.5 h-3.5' },
  md: { pad: 'pl-2.5 pr-2 py-1', text: 'text-[12px]', dot: 'w-2 h-2', btn: 'w-4 h-4' },
}

export default function Tag({ label, color = 'var(--accent)', onRemove, size = 'md' }) {
  const s = SIZES[size] || SIZES.md

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${s.pad} ${s.text} rounded-full font-medium`}
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 28%, transparent)`,
        fontFamily: 'var(--font-jakarta)',
      }}
    >
      <span className={`shrink-0 rounded-full ${s.dot}`} style={{ background: color }} aria-hidden="true" />
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className={`shrink-0 ${s.btn} rounded-full flex items-center justify-center hover:bg-white/10 transition-colors`}
          style={{ color }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-2.5 h-2.5">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </span>
  )
}
