/**
 * ChannelBadge — WhatsApp / Instagram / Messenger identity chip. The dot and
 * chip fill use --ch-{channel} (the true brand hue, kept as-is in both
 * themes); the label TEXT uses --ch-{channel}-text, which globals.css
 * deliberately darkens in light mode — see the "3 · Channel brand" note
 * there: real brand green/pink/blue all fail 4.5:1 contrast on the light
 * ground. Do not swap `-text` for the plain token or light-mode labels
 * become unreadable. Purely presentational: no state or handlers, so no
 * 'use client' directive.
 */

const CHANNEL = {
  whatsapp: { label: 'WhatsApp', dot: 'var(--ch-whatsapp)', text: 'var(--ch-whatsapp-text)', soft: 'var(--ch-whatsapp-soft)' },
  instagram: { label: 'Instagram', dot: 'var(--ch-instagram)', text: 'var(--ch-instagram-text)', soft: 'var(--ch-instagram-soft)' },
  messenger: { label: 'Messenger', dot: 'var(--ch-messenger)', text: 'var(--ch-messenger-text)', soft: 'var(--ch-messenger-soft)' },
}

export default function ChannelBadge({ channel, showLabel = true }) {
  const c = CHANNEL[channel]
  if (!c) return null

  if (!showLabel) {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0"
        style={{ background: c.dot }}
        role="img"
        aria-label={c.label}
      />
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: c.text, background: c.soft, fontFamily: 'var(--font-jakarta)' }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.dot }} aria-hidden="true" />
      {c.label}
    </span>
  )
}
