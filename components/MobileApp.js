'use client'

/**
 * MobileApp — a faithful web reproduction of the Tahsin.ai clinic companion app
 * (products/mobile, Expo/React Native), for the zero-login judge demo.
 *
 * Mirrors the real app's design system (lib/theme.ts) and screen structure:
 * bottom tabs Home / Inbox / Calendar / Patients + a conversation detail with
 * one-tap human takeover. Self-contained: seed data only, no backend, no login.
 */
import { useMemo, useState } from 'react'
import { tableData } from '@/lib/demoData'

// ── Design tokens (from products/mobile/lib/theme.ts) ────────────────────────
const C = {
  bg: '#000000', surface: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)',
  teal: '#00e5b0', textPrimary: '#F1F5F9', textSecondary: '#94A3B8', textMuted: 'rgba(255,255,255,0.28)',
  warning: '#ff9f0a', success: '#30d158',
  whatsapp: '#25D366', instagram: '#E1306C', messenger: '#0084FF',
}
const CLINIC = 'Marina Smile Dental'

// ── Helpers ──────────────────────────────────────────────────────────────────
function prettyName(phone, channel, sid) {
  const src = phone || sid.split('::')[1] || sid
  if (channel === 'instagram') {
    const handle = src.replace(/^ig:/, '').replace(/[^a-z0-9_.]/gi, '')
    return '@' + (handle || 'patient')
  }
  if (channel === 'messenger') {
    const name = src.replace(/^fb:/, '').replace(/[._]/g, ' ').trim()
    return name.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Messenger user'
  }
  // whatsapp — mask the number
  const d = (src.match(/\d/g) || []).join('')
  return d.length >= 6 ? `+${d.slice(0, 5)}···${d.slice(-2)}` : src
}
function channelMeta(ch) {
  if (ch === 'whatsapp') return { color: C.whatsapp, label: 'WhatsApp', glyph: '💬' }
  if (ch === 'instagram') return { color: C.instagram, label: 'Instagram', glyph: '📸' }
  return { color: C.messenger, label: 'Messenger', glyph: '💙' }
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.max(1, Math.floor(diff / 60000))}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ── Data model (derived from seed) ───────────────────────────────────────────
function useModel() {
  return useMemo(() => {
    const convs = tableData('conversations')
    const bookings = tableData('pending_bookings')
    const leads = tableData('leads')
    const notifs = tableData('notifications')

    // group conversation rows into threads by session_id
    const bySid = {}
    for (const row of convs) {
      ;(bySid[row.session_id] ||= []).push(row)
    }
    const threads = Object.entries(bySid).map(([sid, rows]) => {
      rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      const last = rows[rows.length - 1]
      const channel = last.channel || 'whatsapp'
      return {
        sid,
        channel,
        displayName: prettyName(last.phone_number, channel, sid),
        preview: last.content,
        lastAt: last.created_at,
        state: 'Bot',
        turns: rows.map((r) => ({ role: r.role, content: r.content, at: r.created_at })),
      }
    })
    // mark one thread as needing handoff (the emergency one), like the seed sessions table
    const handoffSids = new Set(tableData('sessions').map((s) => s.session_id))
    for (const t of threads) if (handoffSids.has(t.sid)) t.state = 'Handoff'
    threads.sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt))

    const confirmed = bookings.filter((b) => b.status === 'confirmed')
    const counts = {
      conversations: threads.length,
      bookings: confirmed.length,
      patients: leads.length,
      handoffs: threads.filter((t) => t.state === 'Handoff').length,
    }
    const unread = notifs.filter((n) => !n.read).length
    return { threads, bookings, leads, notifs, counts, unread }
  }, [])
}

// ── Small UI atoms ───────────────────────────────────────────────────────────
function ChannelDot({ ch, size = 8 }) {
  const m = channelMeta(ch)
  return <span style={{ width: size, height: size, borderRadius: size, background: m.color, display: 'inline-block' }} />
}
function Avatar({ text, bg = C.teal }) {
  return (
    <div style={{ width: 42, height: 42, borderRadius: 14, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
      {text}
    </div>
  )
}

// ── Screens ──────────────────────────────────────────────────────────────────
function HomeScreen({ model, onOpenThread, go }) {
  const { counts, threads } = model
  const recent = threads.slice(0, 4)
  const botPct = counts.conversations ? Math.round((1 - counts.handoffs / counts.conversations) * 100) : 100
  const metrics = [
    { label: 'Conversations', value: counts.conversations, accent: true },
    { label: 'Bookings', value: counts.bookings },
    { label: 'Patients', value: counts.patients },
    { label: 'Handoffs', value: counts.handoffs, alert: counts.handoffs > 0 },
  ]
  return (
    <div style={{ padding: '8px 16px 24px' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, color: C.textSecondary }}>Good morning 👋</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, letterSpacing: -0.5, marginTop: 2 }}>{CLINIC}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <IconBtn onClick={() => go('notifications')} badge={model.unread}>🔔</IconBtn>
          <Avatar text="M" />
        </div>
      </div>

      {/* hero */}
      <div style={{ padding: 20, background: C.surface, borderRadius: 22, border: '1px solid rgba(0,229,176,0.14)', position: 'relative', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 150, height: 150, borderRadius: 75, background: 'rgba(0,229,176,0.06)' }} />
        <div style={{ fontSize: 11, fontWeight: 600, color: C.teal, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Today</div>
        <div style={{ color: C.textPrimary, fontSize: 52, fontWeight: 700, letterSpacing: -2, lineHeight: 1 }}>{counts.conversations}</div>
        <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 4 }}>across WhatsApp · Instagram · Messenger</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 12, padding: '5px 10px', background: 'rgba(48,209,88,0.10)', borderRadius: 999 }}>
          <span style={{ color: C.success, fontSize: 11 }}>↗</span>
          <span style={{ color: C.success, fontSize: 11, fontWeight: 600 }}>Bot handling {botPct}%</span>
        </div>
      </div>

      {/* handoff alert */}
      {counts.handoffs > 0 && (
        <button onClick={() => go('inbox')} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'rgba(255,159,10,0.10)', border: '1px solid rgba(255,159,10,0.25)', borderRadius: 18, marginBottom: 16, cursor: 'pointer' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: C.textPrimary, fontWeight: 600, fontSize: 14 }}>{counts.handoffs} patient{counts.handoffs > 1 ? 's' : ''} need{counts.handoffs > 1 ? '' : 's'} attention</div>
            <div style={{ color: C.textSecondary, fontSize: 12 }}>Tap to open the Inbox</div>
          </div>
          <span style={{ color: C.warning }}>›</span>
        </button>
      )}

      {/* metric grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        {metrics.map((m) => (
          <div key={m.label} style={{ padding: 16, background: C.surface, borderRadius: 18, border: `1px solid ${m.alert ? 'rgba(255,159,10,0.25)' : m.accent ? 'rgba(0,229,176,0.18)' : C.border}` }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: m.alert ? C.warning : C.textPrimary, letterSpacing: -1 }}>{m.value}</div>
            <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* recent inbox */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Recent Inbox</div>
          <button onClick={() => go('inbox')} style={{ color: C.teal, fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>See all</button>
        </div>
        <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {recent.map((t, i) => (
            <button key={t.sid} onClick={() => onOpenThread(t)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'none', border: 'none', borderTop: i ? `1px solid ${C.border}` : 'none', cursor: 'pointer' }}>
              <ChannelDot ch={t.channel} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.textPrimary, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.displayName}</div>
                <div style={{ color: C.textSecondary, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.preview}</div>
              </div>
              <span style={{ fontSize: 10, color: t.state === 'Handoff' ? C.warning : C.textMuted, fontWeight: 600 }}>{t.state === 'Handoff' ? 'Handoff' : timeAgo(t.lastAt)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* quick row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <QuickCard color="rgba(59,130,246,0.14)" glyph="📊" label="Analytics" onClick={() => go('analytics')} />
        <QuickCard color="rgba(245,158,11,0.14)" glyph="🔔" label="Alerts" onClick={() => go('notifications')} badge={model.unread} />
      </div>
    </div>
  )
}

function InboxScreen({ model, onOpenThread }) {
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? model.threads : model.threads.filter((t) => t.channel === filter)
  const filters = [['all', 'All'], ['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['messenger', 'Messenger']]
  return (
    <div style={{ padding: '8px 16px 24px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, marginBottom: 14 }}>Inbox</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
        {filters.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', border: 'none', background: filter === k ? C.teal : 'rgba(255,255,255,0.05)', color: filter === k ? '#062018' : C.textSecondary }}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((t) => {
          const m = channelMeta(t.channel)
          return (
            <button key={t.sid} onClick={() => onOpenThread(t)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, cursor: 'pointer' }}>
              <Avatar text={m.glyph} bg="rgba(255,255,255,0.06)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: C.textPrimary, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.displayName}</span>
                </div>
                <div style={{ color: C.textSecondary, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{t.preview}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 10.5, color: C.textMuted }}>{timeAgo(t.lastAt)}</span>
                {t.state === 'Handoff'
                  ? <span style={{ fontSize: 9.5, color: C.warning, background: 'rgba(255,159,10,0.12)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>Handoff</span>
                  : <span style={{ fontSize: 9.5, color: C.success, background: 'rgba(48,209,88,0.10)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>Bot</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ConversationScreen({ thread, onBack }) {
  const [taken, setTaken] = useState(false)
  const [draft, setDraft] = useState('')
  const [extra, setExtra] = useState([])
  const m = channelMeta(thread.channel)
  const send = () => {
    if (!draft.trim()) return
    setExtra((e) => [...e, { role: 'staff', content: draft.trim(), at: new Date().toISOString() }])
    setDraft('')
  }
  const turns = [...thread.turns, ...extra]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: 'rgba(6,6,6,0.9)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.teal, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.textPrimary, fontSize: 14, fontWeight: 600 }}>{thread.displayName}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
            <ChannelDot ch={thread.channel} size={7} />
            <span style={{ fontSize: 11, color: C.textSecondary }}>{m.label} · {taken ? "You're handling" : 'Handled by Bot'}</span>
          </div>
        </div>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {turns.map((t, i) => {
          const mine = t.role === 'assistant' || t.role === 'staff'
          const isStaff = t.role === 'staff'
          return (
            <div key={i} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
              <div style={{ padding: '9px 12px', borderRadius: 16, fontSize: 13.5, lineHeight: 1.4, color: mine ? '#062018' : C.textPrimary, background: isStaff ? '#7dd3fc' : mine ? C.teal : 'rgba(255,255,255,0.06)', borderBottomRightRadius: mine ? 4 : 16, borderBottomLeftRadius: mine ? 16 : 4 }}>
                {t.content}
              </div>
              <div style={{ fontSize: 9.5, color: C.textMuted, marginTop: 3, textAlign: mine ? 'right' : 'left' }}>
                {isStaff ? 'You' : mine ? 'Bot' : 'Patient'} · {timeAgo(t.at)}
              </div>
            </div>
          )
        })}
      </div>

      {/* composer / takeover */}
      <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, background: 'rgba(6,6,6,0.9)' }}>
        {!taken ? (
          <button onClick={() => setTaken(true)} style={{ width: '100%', padding: 12, borderRadius: 14, background: 'rgba(0,229,176,0.12)', border: '1px solid rgba(0,229,176,0.3)', color: C.teal, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Take over this conversation
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Type a reply…" style={{ flex: 1, padding: '10px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, color: C.textPrimary, fontSize: 13.5, outline: 'none' }} />
            <button onClick={send} style={{ width: 40, height: 40, borderRadius: 999, background: C.teal, border: 'none', color: '#062018', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>➤</button>
          </div>
        )}
      </div>
    </div>
  )
}

function CalendarScreen({ model }) {
  const byDay = {}
  for (const b of model.bookings) {
    const d = new Date(b.start_time)
    const key = d.toDateString()
    ;(byDay[key] ||= []).push(b)
  }
  const days = Object.entries(byDay).sort((a, b) => new Date(a[0]) - new Date(b[0]))
  const statusColor = (s) => (s === 'confirmed' ? C.success : s === 'pending' ? C.warning : C.textMuted)
  return (
    <div style={{ padding: '8px 16px 24px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, marginBottom: 14 }}>Calendar</div>
      {days.map(([day, items]) => (
        <div key={day} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            {new Date(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary, width: 58 }}>{new Date(b.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary }}>{b.patient_name}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary }}>{b.service} · {b.doctor}</div>
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: statusColor(b.status), background: `${statusColor(b.status)}1a`, padding: '3px 7px', borderRadius: 6, textTransform: 'capitalize' }}>{b.status}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PatientsScreen({ model }) {
  return (
    <div style={{ padding: '8px 16px 24px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary, marginBottom: 14 }}>Patients</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {model.leads.map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
            <Avatar text={l.name.split(' ').map((w) => w[0]).slice(0, 2).join('')} bg="rgba(0,229,176,0.14)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary }}>{l.name}</div>
              <div style={{ fontSize: 12, color: C.textSecondary }}>{l.service_interest}</div>
            </div>
            <span style={{ fontSize: 11, color: C.textMuted }}>{l.phone.replace(/(\d{3})\d+(\d{2})/, '$1···$2')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SimpleScreen({ title, model, kind, onBack }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: C.teal, fontSize: 22, cursor: 'pointer' }}>‹</button>
        <div style={{ color: C.textPrimary, fontSize: 16, fontWeight: 700 }}>{title}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {kind === 'notifications'
          ? model.notifs.map((n) => (
              <div key={n.id} style={{ display: 'flex', gap: 12, padding: 14, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: n.read ? C.textMuted : C.teal, marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.textPrimary }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 2 }}>{n.body}</div>
                </div>
              </div>
            ))
          : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[['Response rate', '94%'], ['Lead conversion', '68%'], ['Booking rate', '75%'], ['Avg reply', '4.2s'], ['Total convos', String(model.counts.conversations)], ['Bookings', String(model.counts.bookings)]].map(([k, v]) => (
                <div key={k} style={{ padding: 16, background: C.surface, borderRadius: 16, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 26, fontWeight: 700, color: C.teal, letterSpacing: -1 }}>{v}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>{k}</div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

// ── Atoms ────────────────────────────────────────────────────────────────────
function IconBtn({ children, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`, position: 'relative', cursor: 'pointer', fontSize: 17 }}>
      {children}
      {badge > 0 && <span style={{ position: 'absolute', top: 6, right: 6, minWidth: 14, height: 14, borderRadius: 7, background: C.warning, color: '#000', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{badge}</span>}
    </button>
  )
}
function QuickCard({ color, glyph, label, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, cursor: 'pointer' }}>
      <span style={{ width: 30, height: 30, borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{glyph}</span>
      <span style={{ flex: 1, textAlign: 'left', color: C.textPrimary, fontSize: 14, fontWeight: 600 }}>{label}</span>
      {badge > 0 ? <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: C.warning, color: '#000', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span> : <span style={{ color: C.textMuted }}>›</span>}
    </button>
  )
}

const TABS = [
  { key: 'home', label: 'Home', glyph: '▦' },
  { key: 'inbox', label: 'Inbox', glyph: '💬' },
  { key: 'calendar', label: 'Calendar', glyph: '📅' },
  { key: 'patients', label: 'Patients', glyph: '👥' },
]

// ── Root ─────────────────────────────────────────────────────────────────────
export default function MobileApp() {
  const model = useModel()
  const [tab, setTab] = useState('home')
  const [thread, setThread] = useState(null)
  const [screen, setScreen] = useState(null) // 'analytics' | 'notifications'

  const openThread = (t) => setThread(t)
  const go = (s) => {
    if (s === 'inbox') { setTab('inbox'); return }
    setScreen(s)
  }

  let body
  if (thread) body = <ConversationScreen thread={thread} onBack={() => setThread(null)} />
  else if (screen === 'notifications') body = <SimpleScreen title="Alerts" kind="notifications" model={model} onBack={() => setScreen(null)} />
  else if (screen === 'analytics') body = <SimpleScreen title="Analytics" kind="analytics" model={model} onBack={() => setScreen(null)} />
  else if (tab === 'home') body = <HomeScreen model={model} onOpenThread={openThread} go={go} />
  else if (tab === 'inbox') body = <InboxScreen model={model} onOpenThread={openThread} />
  else if (tab === 'calendar') body = <CalendarScreen model={model} />
  else body = <PatientsScreen model={model} />

  const showTabs = !thread && !screen

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, color: C.textPrimary, fontFamily: 'var(--font-jakarta), system-ui, sans-serif' }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{body}</div>
      {showTabs && (
        <div style={{ display: 'flex', background: 'rgba(6,6,6,0.95)', borderTop: '0.5px solid rgba(255,255,255,0.06)', paddingTop: 8, paddingBottom: 10 }}>
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setScreen(null) }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
                {active && <span style={{ position: 'absolute', top: -2, width: 4, height: 4, borderRadius: 2, background: C.teal }} />}
                <span style={{ fontSize: 20, filter: active ? 'none' : 'grayscale(1) opacity(0.5)', color: active ? C.teal : 'rgba(255,255,255,0.35)' }}>{t.glyph}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? C.teal : 'rgba(255,255,255,0.35)' }}>{t.label}</span>
                {t.key === 'inbox' && model.counts.handoffs > 0 && <span style={{ position: 'absolute', top: -2, right: '28%', minWidth: 15, height: 15, borderRadius: 8, background: C.warning, color: '#000', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{model.counts.handoffs}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
