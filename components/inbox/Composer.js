'use client'

/**
 * Composer — the reply box for the 3-pane inbox's chat panel. Mirrors the
 * reply-box behaviour from the reference conversations page (Enter-to-send,
 * Shift+Enter newline, hidden file input for attach, Suggest reply, Send)
 * but purely presentational: value/sending/attaching/suggesting are all
 * controlled props, every action is a callback, and there is no fetch or
 * upload logic here — that stays with the caller.
 *
 * Color language matches MessageBubble's DEVIATION 2 note: Suggest/Send use
 * --prio-medium (the same "staff action" blue as the owner bubble and the
 * "You" label) instead of the reference's unthemed indigo.
 */

import { useRef } from 'react'

function Spinner({ size = 12, color = 'var(--ink-1)', trackColor = 'var(--ink-4)' }) {
  return (
    <span
      className="inline-block rounded-full animate-spin shrink-0"
      style={{ width: size, height: size, border: `2px solid ${trackColor}`, borderTopColor: color }}
      aria-hidden="true"
    />
  )
}

export default function Composer({
  value,
  onChange,
  onSend,
  onAttach,
  onSuggest,
  sending = false,
  attaching = false,
  suggesting = false,
  channelLabel = 'this channel',
  disabled = false,
}) {
  const fileInputRef = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && !sending && (value || '').trim()) onSend?.()
    }
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (f) onAttach?.(f)
  }

  const canSend = !disabled && !sending && Boolean((value || '').trim())

  return (
    <div
      className="shrink-0 border-t border-white/[0.06] bg-white/[0.02] px-4 py-3"
      style={{ fontFamily: 'var(--font-jakarta)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => onSuggest?.()}
          disabled={disabled || suggesting || sending}
          title="Draft a reply with AI — review and edit before sending"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'var(--prio-medium-soft)',
            color: 'var(--prio-medium)',
            borderColor: 'color-mix(in srgb, var(--prio-medium) 30%, transparent)',
          }}
        >
          {suggesting ? (
            <Spinner size={12} color="var(--prio-medium)" trackColor="color-mix(in srgb, var(--prio-medium) 35%, transparent)" />
          ) : (
            <span aria-hidden="true">✨</span>
          )}
          {suggesting ? 'Drafting…' : 'Suggest reply'}
        </button>
        <span className="text-[10.5px] text-[var(--ink-4)]">AI draft · you edit before sending</span>
      </div>

      <div className="flex items-end gap-2">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || attaching || sending}
          title="Attach image or video"
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.05] text-[var(--ink-2)] border border-white/[0.08] hover:bg-white/[0.08] hover:text-[var(--ink-1)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {attaching ? (
            <Spinner size={16} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
              />
            </svg>
          )}
        </button>
        <textarea
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Reply via ${channelLabel}… (Enter to send)`}
          rows={2}
          disabled={disabled}
          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-[var(--ink-1)] placeholder-[var(--ink-4)] outline-none resize-none focus:border-[var(--prio-medium)] transition-colors disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => onSend?.()}
          disabled={!canSend}
          className="shrink-0 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: 'var(--prio-medium-soft)',
            color: 'var(--prio-medium)',
            borderColor: 'color-mix(in srgb, var(--prio-medium) 35%, transparent)',
          }}
        >
          {sending ? (
            <Spinner size={14} color="var(--prio-medium)" trackColor="color-mix(in srgb, var(--prio-medium) 35%, transparent)" />
          ) : (
            'Send'
          )}
        </button>
      </div>
      <p className="text-[10.5px] text-[var(--ink-4)] mt-1.5 px-1">
        Replies go back on {channelLabel} · attach an image or video
      </p>
    </div>
  )
}
