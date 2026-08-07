'use client'

/**
 * Avatar — shows `src` if given (and it doesn't fail to load), else up-to-2
 * -character initials on a glass backdrop. If `channel` is passed, a small
 * brand-colored dot badge sits bottom-right (same --ch-{channel} dot color
 * as ChannelBadge). A plain <img> is used rather than next/image because
 * `src` may be an arbitrary remote URL and next.config.mjs has no image
 * domain allowlist configured — matches the existing raw-<img> usage in
 * app/(portal)/conversations/page.js.
 */

import { useState } from 'react'

const CH_DOT = {
  whatsapp: 'var(--ch-whatsapp)',
  instagram: 'var(--ch-instagram)',
  messenger: 'var(--ch-messenger)',
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export default function Avatar({ name, src, channel, size = 36 }) {
  const [errored, setErrored] = useState(false)
  const showImage = Boolean(src) && !errored
  const dot = CH_DOT[channel]
  const altText = name ? `${name}'s avatar` : 'Avatar'

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote src, no image domain allowlist configured
        <img
          src={src}
          alt={altText}
          onError={() => setErrored(true)}
          className="w-full h-full rounded-full object-cover border border-white/[0.09]"
        />
      ) : (
        <span
          className="w-full h-full rounded-full flex items-center justify-center glass text-[var(--ink-1)] font-semibold"
          style={{ fontFamily: 'var(--font-jakarta)', fontSize: Math.max(10, size * 0.36) }}
          role="img"
          aria-label={altText}
        >
          {initials(name)}
        </span>
      )}
      {dot && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
          style={{
            width: Math.max(9, size * 0.3),
            height: Math.max(9, size * 0.3),
            background: dot,
            borderColor: 'var(--bg-base)',
          }}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
