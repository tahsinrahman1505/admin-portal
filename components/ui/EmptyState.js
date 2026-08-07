/**
 * EmptyState — centered, muted placeholder for empty lists/panels. `icon` and
 * `action` are caller-supplied ReactNodes (e.g. an inline SVG, a button) so
 * this component stays purely a layout shell. No state or handlers of its
 * own, so no 'use client' directive.
 */

export default function EmptyState({ icon, title, description, action }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center px-6 py-16"
      style={{ fontFamily: 'var(--font-jakarta)' }}
    >
      {icon && (
        <div className="mb-4 text-[var(--ink-3)] [&_svg]:w-8 [&_svg]:h-8" aria-hidden="true">
          {icon}
        </div>
      )}
      {title && <p className="text-[var(--ink-1)] text-[15px] font-semibold">{title}</p>}
      {description && <p className="text-[var(--ink-3)] text-[13px] mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
