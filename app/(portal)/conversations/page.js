'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ConversationsSkeleton } from '@/components/Skeleton'
import { EmptyState, StatusBadge, SegmentedTabs, Drawer } from '@/components/ui'
import { FolderRail, ThreadRow, MessageBubble, Composer, PatientContext } from '@/components/inbox'

const API_URL     = '/api/rag'
const API_HEADERS = { 'Content-Type': 'application/json' }

// Pure inbox logic now lives in lib/inbox.js, where it is covered by
// lib/__tests__/inbox.test.js (50 assertions). It used to be defined inline in
// this file, which meant the two subtlest functions in the product —
// reconcileMessage (does a sent message render once or twice?) and
// buildDeliveryMap (which bubble does a "not delivered" warning attach to?) —
// were unreachable by any test.
import {
  maskIdentity, normalizeIdentity, reconcileMessage, pickIdentity,
  buildDeliveryMap, buildThreads, filterThreads, channelCounts,
  formatTimestamp, CHANNEL_LABEL, byLastActive, statusToken,
} from '@/lib/inbox'
import { mergeMeta, filterByTriage, triageStatusCounts } from '@/lib/triage'

// Upload constraints are enforced by the storage bucket; mirrored here only so a
// too-large or wrong-type file fails fast with a friendly message.
const MAX_MEDIA_BYTES = 25 * 1024 * 1024
const MEDIA_CONTENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'image/heic', 'image/heif', 'image/bmp',
  'video/mp4', 'video/quicktime', 'video/x-m4v',
  'video/webm', 'video/3gpp', 'video/x-matroska',
])

function extFromName(name, fallback) {
  const dot = (name || '').lastIndexOf('.')
  if (dot > -1 && dot < name.length - 1) return name.slice(dot + 1).toLowerCase()
  return fallback
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const router = useRouter()
  const [threads, setThreads]           = useState([])
  const [selected, setSelected]         = useState(null)
  const [search, setSearch]             = useState('')
  const [channelTab, setChannelTab]     = useState('all')
  // Triage: conversation_meta keyed by session_id, plus the two small
  // per-clinic catalogues (staff for assignment, client_tags for the tag
  // picker). See migrations/003_conversation_meta.sql and lib/triage.js.
  const [metaBySession, setMetaBySession] = useState({})
  const [staffList, setStaffList]         = useState([])
  const [tagCatalogue, setTagCatalogue]   = useState([])
  const [triageStatusTab, setTriageStatusTab] = useState('all')
  // '' = no filter, 'any' = assigned to someone, 'null' = unassigned, or a staff id.
  // Deliberately all STRINGS, never the bare JS value null — this state feeds an
  // HTML <select>, whose option values are always strings, and lib/triage.js's
  // filterByTriage separately uses the literal `null` to mean "unassigned"
  // (see its docstring). Mixing the two null-shaped values caused a real bug
  // here on first pass: the <select>'s "Unassigned" option submitted the STRING
  // "null", which is truthy and doesn't structurally equal the `null` triage.js
  // checks for — so the unassigned filter silently matched everything instead
  // of nothing. Converted to the real `null` only at the filterByTriage call.
  const [assigneeFilter, setAssigneeFilter]   = useState('')
  const [loading, setLoading]           = useState(true)
  const [handoffSessions, setHandoffSessions] = useState([]) // [{sender_id, channel, ...}]
  const [botClientId, setBotClientId]   = useState('')
  const [portalClientId, setPortalClientId] = useState(null)
  const [resuming, setResuming]         = useState(null)
  const [takingOver, setTakingOver]     = useState(null)
  const [replyText, setReplyText]       = useState('')
  const [sending, setSending]           = useState(false)
  const [attaching, setAttaching]       = useState(false)
  // Summaries are keyed by session_id and kept for the whole visit. They used to
  // be a single value cleared on every thread switch, so a clinic that generated
  // a summary, glanced at another conversation and came back had to regenerate
  // it — a wasted model call and a wasted wait, for something that hadn't changed.
  const [summaries, setSummaries]       = useState({})
  const [summarizing, setSummarizing]   = useState(false)
  const [suggesting, setSuggesting]     = useState(false)

  // Patient context is a fixed pane at 2xl+ and a Drawer below it (see the
  // render below) — this only controls the drawer; the fixed pane needs no
  // open/close state since it's always visible at that width.
  const [contextOpen, setContextOpen]   = useState(false)

  const [liveMessages, setLiveMessages] = useState([])
  const [deliveries, setDeliveries]     = useState([]) // message_delivery rows for selected thread
  const bottomRef   = useRef(null)
  const realtimeRef = useRef(null)
  const fileInputRef = useRef(null)


  // ── Load handoff sessions ──
  const loadHandoffSessions = useCallback(async (botCid) => {
    if (!botCid) return
    try {
      const { data } = await supabase
        .from('sessions')
        .select('session_id, state, channel')
        .eq('state', 'handoff')
        .like('session_id', `${botCid}::%`)
      if (data) {
        const sessions = data.map(r => ({
          sender_id: r.session_id.replace(`${botCid}::`, ''),
          channel:   r.channel || 'whatsapp',
        }))
        setHandoffSessions(sessions)
      }
    } catch (e) {
      console.error('loadHandoffSessions error:', e)
    }
  }, [])

  // ── Initial data load ──
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, bot_client_id')
        .eq('user_id', user.id)
        .single()
      if (!clientRow) { setLoading(false); return }

      const botCid = clientRow.bot_client_id || ''
      setBotClientId(botCid)
      setPortalClientId(clientRow.id)

      // Fetch DESC + limit, then reverse to ascending (fix 2026-08-25): this used
      // to fetch ascending with NO limit at all, relying on PostgREST's implicit
      // default row cap (1000). That cap silently truncated the query from the
      // OLDEST end — so once this clinic passed 1000 rows (it's now at 1068),
      // every page load quietly dropped the newest ~68 rows, including every
      // conversation from today. Ordering DESC with an explicit limit guarantees
      // the most recent messages are always included no matter how large the
      // table grows; only very old history can fall outside the window, which is
      // the right tradeoff for an inbox. buildThreads() requires ascending order
      // (it reads messages[0] as oldest and messages[length-1] as newest per
      // thread), hence the .reverse() below.
      const { data: rowsDesc } = await supabase
        .from('conversations')
        .select('*')
        .eq('client_id', clientRow.id)
        .order('created_at', { ascending: false })
        .limit(5000)
      const rows = rowsDesc ? [...rowsDesc].reverse() : rowsDesc

      if (!rows) { setLoading(false); return }

      // Grouping/sorting rules (channel + status from the LAST message, orphan
      // rows kept separate) live in lib/inbox.js and are covered by tests.
      const threadList = buildThreads(rows)

      setThreads(threadList)
      if (threadList.length > 0) {
        setSelected(threadList[0])
        setLiveMessages(threadList[0].messages)
      }

      // Triage catalogues + per-thread meta. All three are RLS-scoped to this
      // clinic (see migrations/003_conversation_meta.sql) — no client_id filter
      // needed here beyond what RLS already enforces, matching how `clients`/
      // `conversations` are read elsewhere in this file.
      const [metaRes, staffRes, tagsRes] = await Promise.all([
        supabase.from('conversation_meta').select('*').eq('client_id', clientRow.id),
        supabase.from('staff').select('*').eq('client_id', clientRow.id).order('name'),
        supabase.from('client_tags').select('*').eq('client_id', clientRow.id).order('name'),
      ])
      if (metaRes.data) {
        setMetaBySession(Object.fromEntries(metaRes.data.map(m => [m.session_id, m])))
      }
      if (staffRes.data) setStaffList(staffRes.data)
      if (tagsRes.data) setTagCatalogue(tagsRes.data)

      await loadHandoffSessions(botCid)
      setLoading(false)
    }
    load()
  }, [loadHandoffSessions, router])

  // ── Supabase Realtime ──
  useEffect(() => {
    if (!portalClientId) return

    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current)

    const channel = supabase
      .channel('conversations-inbox')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'conversations',
        filter: `client_id=eq.${portalClientId}`,
      }, (payload) => {
        const newRow = payload.new
        // Refresh handoff sessions whenever a handoff status row arrives
        if (newRow.session_status === 'Handed Off') {
          loadHandoffSessions(botClientId)
        }
        setThreads(prev => {
          const idx = prev.findIndex(t => t.session_id === newRow.session_id)
          if (idx === -1) {
            const newThread = {
              session_id:   newRow.session_id,
              sender_id:    newRow.phone_number || newRow.session_id,
              channel:      newRow.channel || 'whatsapp',
              phone:        newRow.phone_number || 'Unknown',
              status:       newRow.session_status || 'Handed Off',
              firstMessage: newRow.role === 'customer' ? newRow.message : '',
              lastAt:       newRow.created_at,
              ...pickIdentity([newRow]),
              messages:     [newRow],
            }
            return [newThread, ...prev]
          }
          const updated = [...prev]
          const mergedMessages = reconcileMessage(updated[idx].messages, newRow)
          updated[idx] = {
            ...updated[idx],
            lastAt:   newRow.created_at,
            status:   newRow.session_status || updated[idx].status,
            channel:  newRow.channel || updated[idx].channel,
            ...pickIdentity(mergedMessages),
            messages: mergedMessages,
          }
          // Same comparator the initial load uses, so a realtime arrival can't
          // order the list differently from a refresh.
          return updated.sort(byLastActive)
        })
        setSelected(sel => {
          if (sel && sel.session_id === newRow.session_id) {
            setLiveMessages(prev => reconcileMessage(prev, newRow))
          }
          return sel
        })
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversations',
        filter: `client_id=eq.${portalClientId}`,
      }, (payload) => {
        const updated = payload.new
        setThreads(prev => prev.map(t => {
          if (t.session_id !== updated.session_id) return t
          // Covers both delivery-status patches AND the identity backfill: a
          // brand-new sender's username/display name resolves in the background
          // after the first message inserts, then lands here as an UPDATE.
          const mergedMessages = t.messages.map(m => m.id === updated.id ? updated : m)
          return {
            ...t,
            status: updated.session_status || t.status,
            ...pickIdentity(mergedMessages),
            messages: mergedMessages,
          }
        }))
        setLiveMessages(prev => prev.map(m => m.id === updated.id ? updated : m))
        setSelected(sel => {
          if (!sel || sel.session_id !== updated.session_id) return sel
          const mergedMessages = sel.messages.map(m => m.id === updated.id ? updated : m)
          return { ...sel, ...pickIdentity(mergedMessages), messages: mergedMessages }
        })
      })
      .subscribe()

    realtimeRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [portalClientId, botClientId, loadHandoffSessions])

  // ── Realtime: conversation_meta ──
  // Separate channel from the conversations one above: different table, and a
  // conversation_meta row is a simple upsert-by-session_id (no message-merging
  // logic needed — INSERT and UPDATE can share one handler, unlike the
  // conversations channel where reconcileMessage does real work).
  useEffect(() => {
    if (!portalClientId) return
    const channel = supabase
      .channel('conversation-meta')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'conversation_meta',
        filter: `client_id=eq.${portalClientId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setMetaBySession(prev => {
            const next = { ...prev }
            delete next[payload.old.session_id]
            return next
          })
          return
        }
        const row = payload.new
        setMetaBySession(prev => ({ ...prev, [row.session_id]: row }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [portalClientId])

  // ── Switch liveMessages when the selected thread changes ──
  // Still an effect, deliberately. `liveMessages` is ALSO written by the realtime
  // subscription above (via reconcileMessage, which de-duplicates an optimistic
  // send against the echoed DB row). Moving this reset into render, or into a
  // `key`, changes the ordering between "thread switched" and "realtime row
  // arrived" — and getting that ordering wrong duplicates or drops a message in
  // a live patient chat, which nobody would catch in review. The summary reset
  // that used to sit here is gone: summaries are now keyed by session, so
  // switching threads no longer discards one.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected) setLiveMessages(selected.messages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.session_id])

  // ── Load delivery receipts for the selected thread ──
  useEffect(() => {
    const sid = selected?.session_id
    let cancelled = false
    ;(async () => {
      if (!sid) { if (!cancelled) setDeliveries([]); return }
      const { data, error } = await supabase
        .from('message_delivery')
        .select('wamid,session_id,channel,status,lane,error_code,error_title,body_preview,created_at')
        .eq('session_id', sid)
        .order('created_at', { ascending: true })
      if (cancelled) return
      setDeliveries(error ? [] : (data || []))
    })()
    return () => { cancelled = true }
  }, [selected?.session_id])

  // ── Realtime delivery updates for the selected thread ──
  useEffect(() => {
    if (!selected?.session_id) return
    const ch = supabase
      .channel(`delivery-${selected.session_id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'message_delivery',
        filter: `session_id=eq.${selected.session_id}`,
      }, (payload) => {
        const row = payload.new
        if (!row) return
        setDeliveries(prev => {
          const idx = prev.findIndex(d => d.wamid && d.wamid === row.wamid)
          if (idx === -1) return [...prev, row]
          const next = [...prev]; next[idx] = row; return next
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [selected?.session_id])

  // Map each outbound message → its delivery receipt
  const deliveryMap = useMemo(
    () => buildDeliveryMap(liveMessages, deliveries),
    [liveMessages, deliveries]
  )

  // ── Auto-scroll ──
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [liveMessages])

  // ── Handoff check — now channel-aware ──
  function isHandedOff(thread) {
    // Primary: the MOST RECENT message's status — a conversation that was
    // ever handed off in the past (any earlier message) must not stay stuck
    // reading as handed off forever after a resume; only the latest state
    // matters. thread.status already tracks this (set from the last message
    // on load, and kept current by the realtime INSERT/UPDATE handlers and
    // the optimistic flips in handleResume/handleTakeover).
    if (thread.status === 'Handed Off') return true
    if (thread.status) return false
    // Fallback for a thread with no status yet: sessions table check
    // (conversations table is readable by anon; sessions is RLS-blocked so
    // this is often empty, but still worth trying).
    const norm = normalizeIdentity(thread.sender_id || thread.phone)
    return handoffSessions.some(h => h.sender_id === norm)
  }

  function getStatus(thread) {
    return isHandedOff(thread) ? 'Handed Off' : thread.status
  }

  function getThreadChannel(thread) {
    // Try to find the channel from handoff sessions for accuracy
    const norm = normalizeIdentity(thread.sender_id || thread.phone)
    const hs   = handoffSessions.find(h => h.sender_id === norm)
    return hs?.channel || thread.channel || 'whatsapp'
  }

  // ── Resume Bot ──
  async function handleResume(thread) {
    const norm = normalizeIdentity(thread.sender_id || thread.phone)
    setResuming(norm)
    try {
      const res = await fetch(`${API_URL}/session/resume`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ session_id: norm, client_id: botClientId || 'dental_demo' })
      })
      if (res.ok) {
        setHandoffSessions(prev => prev.filter(h => h.sender_id !== norm))
        // Optimistic — this used to rely entirely on the realtime UPDATE
        // subscription to flip the primary status source (thread.status /
        // message.session_status). When that round-trip lagged, the button
        // looked like it "didn't work" even though the backend had already
        // succeeded, so staff would click it repeatedly. Flip it locally too.
        setThreads(prev => prev.map(t => t.session_id === thread.session_id ? { ...t, status: 'Handled by Bot' } : t))
        setSelected(sel => sel && sel.session_id === thread.session_id ? { ...sel, status: 'Handled by Bot' } : sel)
      }
    } catch (e) { console.error('Resume error:', e) }
    finally { setResuming(null) }
  }

  // ── Take Over — pause the bot at any time, not just after 24h ──
  async function handleTakeover(thread) {
    const norm = normalizeIdentity(thread.sender_id || thread.phone)
    setTakingOver(norm)
    try {
      const res = await fetch(`${API_URL}/session/takeover`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ session_id: norm, client_id: botClientId || 'dental_demo' })
      })
      if (res.ok) {
        // Optimistic — the backend also flips conversations.session_status,
        // which arrives via the realtime UPDATE subscription above, but that
        // round-trip can lag; set it locally too so the reply box appears now.
        setThreads(prev => prev.map(t => t.session_id === thread.session_id ? { ...t, status: 'Handed Off' } : t))
        setSelected(sel => sel && sel.session_id === thread.session_id ? { ...sel, status: 'Handed Off' } : sel)
      }
    } catch (e) { console.error('Takeover error:', e) }
    finally { setTakingOver(null) }
  }

  // ── AI Summary ──
  // Written into the per-session map, and captured into `sid` up front so a
  // summary that resolves after the user has moved on lands on the conversation
  // it was actually generated for, not whichever one happens to be open.
  async function handleSummarize() {
    if (!selected || summarizing) return
    const sid = selected.session_id
    setSummarizing(true)
    setSummaries(prev => ({ ...prev, [sid]: null }))
    try {
      const res = await fetch(`${API_URL}/session/summary`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ session_id: sid, client_id: botClientId || 'dental_demo' })
      })
      const data = await res.json()
      setSummaries(prev => ({ ...prev, [sid]: data.summary || 'No summary available.' }))
    } catch {
      setSummaries(prev => ({ ...prev, [sid]: 'Failed to generate summary. Please try again.' }))
    } finally { setSummarizing(false) }
  }

  /** Summary for the conversation currently on screen. */
  const summary = selected ? (summaries[selected.session_id] ?? null) : null
  const dismissSummary = () => {
    if (selected) setSummaries(prev => ({ ...prev, [selected.session_id]: null }))
  }

  // ── Triage mutations ──
  // conversation_meta rows are created LAZILY, on the first triage action —
  // not eagerly for every thread on load. Nothing else in the app needs a row
  // to exist (lib/triage.js's mergeMeta defaults an absent row to
  // open/no-priority/unassigned/no-tags), so an untouched thread never writes
  // one. Every mutation therefore upserts rather than updates: the first
  // action on a thread creates its row, every action after that updates it.
  //
  // Each setter applies an OPTIMISTIC local update before the request resolves
  // — the realtime subscription above will confirm it moments later, but
  // without this a click feels like it "did nothing" for the round-trip, which
  // is exactly the complaint that drove the optimistic patterns already in
  // this file (handleResume/handleTakeover/handleSend).
  function upsertMeta(sessionId, patch) {
    if (!portalClientId) return
    setMetaBySession(prev => ({
      ...prev,
      [sessionId]: { ...(prev[sessionId] || { session_id: sessionId, client_id: portalClientId }), ...patch, updated_at: new Date().toISOString() },
    }))
    supabase.from('conversation_meta')
      .upsert({ session_id: sessionId, client_id: portalClientId, ...patch, updated_at: new Date().toISOString() })
      .then(({ error }) => { if (error) console.error('conversation_meta upsert failed:', error) })
  }

  function setThreadPriority(sessionId, priority) {
    upsertMeta(sessionId, { priority })
  }

  function setThreadAssignee(sessionId, assigneeId) {
    upsertMeta(sessionId, { assignee_id: assigneeId })
  }

  function setThreadTriageStatus(sessionId, status) {
    upsertMeta(sessionId, { status, resolved_at: status === 'resolved' ? new Date().toISOString() : null })
  }

  function addThreadTag(sessionId, tagName) {
    const current = metaBySession[sessionId]?.tags || []
    if (current.includes(tagName)) return
    upsertMeta(sessionId, { tags: [...current, tagName] })
  }

  function removeThreadTag(sessionId, tagName) {
    const current = metaBySession[sessionId]?.tags || []
    upsertMeta(sessionId, { tags: current.filter(t => t !== tagName) })
  }

  // Creating a brand-new tag is a separate table (client_tags is the per-clinic
  // catalogue, not the array on conversation_meta) — optimistic here too, so
  // typing a new tag and immediately applying it doesn't feel like two steps.
  async function createTag(name, color = 'var(--accent)') {
    if (!portalClientId) return null
    const optimistic = { id: `opt_${Date.now()}`, client_id: portalClientId, name, color, created_at: new Date().toISOString() }
    setTagCatalogue(prev => [...prev, optimistic])
    const { data, error } = await supabase.from('client_tags')
      .insert({ client_id: portalClientId, name, color })
      .select().single()
    if (error) {
      console.error('client_tags insert failed:', error)
      setTagCatalogue(prev => prev.filter(t => t.id !== optimistic.id))
      return null
    }
    setTagCatalogue(prev => prev.map(t => t.id === optimistic.id ? data : t))
    return data
  }

  // ── AI Suggested reply (draft into the reply box; staff edits before sending) ──
  async function handleSuggest() {
    if (!selected || suggesting) return
    setSuggesting(true)
    try {
      const res = await fetch(`${API_URL}/session/suggest`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({ session_id: selected.session_id, client_id: botClientId || 'dental_demo' })
      })
      const data = await res.json()
      if (data.suggestion) setReplyText(data.suggestion)
    } catch (e) { console.error('Suggest error:', e) }
    finally { setSuggesting(false) }
  }

  // ── Owner reply — channel-aware ──
  async function handleSend() {
    if (!replyText.trim() || !selected || sending) return
    const msgText  = replyText.trim()
    const threadCh = getThreadChannel(selected)
    const norm     = normalizeIdentity(selected.sender_id || selected.phone)
    setReplyText(''); setSending(true)

    const optimisticMsg = {
      id: `opt_${Date.now()}`, session_id: selected.session_id,
      phone_number: selected.phone, role: 'owner', message: msgText,
      session_status: 'Handed Off', created_at: new Date().toISOString(),
    }
    setLiveMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch(`${API_URL}/session/send`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({
          session_id: norm,
          message:    msgText,
          client_id:  botClientId || 'dental_demo',
          channel:    threadCh,
        })
      })
      if (!res.ok) {
        setLiveMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
        console.error('Send failed:', await res.text())
      }
    } catch (e) {
      setLiveMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      console.error('Send error:', e)
    } finally { setSending(false) }
  }

  // ── Attach + send media ──
  // 1) sign a clinic-scoped upload URL, 2) PUT the binary straight to Supabase
  // Storage with the signed token, 3) send the resulting public link to the
  // patient. Same backend core as the mobile app, so it behaves identically.
  async function handleAttach(file) {
    if (!file || !selected || attaching) return
    const threadCh = getThreadChannel(selected)
    const norm     = normalizeIdentity(selected.sender_id || selected.phone)
    const mimeType = file.type || ''
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image'

    if (!MEDIA_CONTENT_TYPES.has(mimeType.toLowerCase())) {
      alert('Unsupported file type. Send an image or video.')
      return
    }
    if (file.size > MAX_MEDIA_BYTES) {
      alert('File is too large. The limit is 25 MB.')
      return
    }

    setAttaching(true)
    try {
      const ext = extFromName(file.name, mediaType === 'video' ? 'mp4' : 'jpg')

      // 1) Ask the backend for a signed upload URL.
      const signRes = await fetch(`${API_URL}/media/sign-upload`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({
          session_id: norm,
          ext,
          content_type: mimeType.toLowerCase(),
          client_id: botClientId || 'dental_demo',
        }),
      })
      if (!signRes.ok) { console.error('Sign failed:', await signRes.text()); alert('Could not prepare the upload. Please try again.'); return }
      const signed = await signRes.json()

      // 2) Upload the binary directly to Supabase Storage with the signed token.
      const upRes = await fetch(signed.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType, 'cache-control': '2592000' },
        body: file,
      })
      if (!upRes.ok) { console.error('Upload failed:', upRes.status); alert(`Upload failed (${upRes.status}). Please try again.`); return }

      // Optimistic bubble — store as "<url> <caption>" like the backend logs it.
      const optimisticMsg = {
        id: `opt_${Date.now()}`, session_id: selected.session_id,
        phone_number: selected.phone, role: 'owner', message: signed.public_url,
        session_status: 'Handed Off', created_at: new Date().toISOString(),
      }
      setLiveMessages(prev => [...prev, optimisticMsg])

      // 3) Send the public link to the patient via the channel.
      const sendRes = await fetch(`${API_URL}/session/send-media`, {
        method: 'POST', headers: API_HEADERS,
        body: JSON.stringify({
          session_id: norm,
          media_url:  signed.public_url,
          media_type: mediaType,
          caption:    '',
          client_id:  botClientId || 'dental_demo',
          channel:    threadCh,
        }),
      })
      if (!sendRes.ok) {
        setLiveMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
        console.error('Send-media failed:', await sendRes.text())
        alert('The file uploaded but could not be sent. Please try again.')
      }
    } catch (e) {
      console.error('Attach error:', e)
      alert('Something went wrong sending the attachment.')
    } finally {
      setAttaching(false)
    }
  }

  // Counts for the folder rail, and the channel + search filter. Both live in
  // lib/inbox.js so the filter composition is unit-tested rather than trusted.
  const counts = channelCounts(threads)
  // Triage meta merges onto every thread BEFORE any filtering, so an untriaged
  // thread (no conversation_meta row yet) still carries the defaults
  // mergeMeta assigns (triageStatus 'open', no priority, unassigned, no tags)
  // and participates correctly in the Open tab / assignee filter rather than
  // silently vanishing from every triage-aware view.
  const withMeta = mergeMeta(threads, metaBySession)
  const triageCounts = triageStatusCounts(withMeta)
  const filtered = filterByTriage(
    filterThreads(withMeta, { channel: channelTab, search }),
    {
      triageStatus: triageStatusTab,
      ...(assigneeFilter !== '' ? { assigneeId: assigneeFilter === 'null' ? null : assigneeFilter } : {}),
    },
  )

  if (loading) return <ConversationsSkeleton />

  const selectedHandedOff = selected ? isHandedOff(selected) : false
  const selectedStatus    = selected ? getStatus(selected)   : null
  const selectedChannel   = selected ? getThreadChannel(selected) : 'whatsapp'
  const channelLabel      = CHANNEL_LABEL[selectedChannel] || CHANNEL_LABEL.whatsapp
  const busyKey           = selected ? normalizeIdentity(selected.sender_id || selected.phone) : null
  // Looked up fresh from `withMeta` rather than trusting fields already on
  // `selected` — `selected` can have been set before conversation_meta finished
  // loading, or before a realtime update landed, so its own .priority/.tags
  // would be stale. This lookup is always current.
  const selectedMeta = selected ? withMeta.find(t => t.session_id === selected.session_id) : null

  /* ── Four panes ────────────────────────────────────────────────────────────
     folders │ thread list │ chat │ patient context

     The context rail is the point of the redesign: previously there was nowhere
     to see WHO you were talking to, and the AI summary appeared as a banner over
     the transcript then vanished on the next thread switch. Below `2xl` the rail
     is hidden rather than squeezed — four columns under ~1400px leaves the chat
     itself too narrow to read, and the chat is the job. */
  return (
    <div className="flex h-full overflow-hidden">
      <FolderRail channel={channelTab} onChannelChange={setChannelTab} counts={counts} />

      {/* Thread list */}
      <div
        className="shrink-0 flex flex-col border-r border-white/[0.06] bg-white/[0.015] min-w-0"
        style={{ width: 'var(--pane-list)' }}
      >
        <div className="px-4 py-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[13px] font-semibold text-[var(--ink-1)]" style={{ fontFamily: 'var(--font-jakarta)' }}>
              {channelTab === 'all' ? 'All conversations' : CHANNEL_LABEL[channelTab]}
            </h1>
            <span className="text-[11px] text-[var(--ink-3)] bg-white/5 px-2 py-0.5 rounded-full tnum">
              {filtered.length}
            </span>
          </div>
          <input
            type="text"
            aria-label="Search conversations"
            placeholder="Search messages…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px]
                       text-[var(--ink-1)] placeholder-[var(--ink-4)] outline-none
                       focus:border-[var(--accent)] transition-colors"
          />
          <div className="mt-2.5 flex items-center gap-2">
            <SegmentedTabs
              size="sm"
              value={triageStatusTab}
              onChange={setTriageStatusTab}
              options={[
                { value: 'all', label: 'All', count: triageCounts.all },
                { value: 'open', label: 'Open', count: triageCounts.open },
                { value: 'pending', label: 'Pending', count: triageCounts.pending },
                { value: 'resolved', label: 'Resolved', count: triageCounts.resolved },
              ]}
            />
            {/* A native <select> here rather than a 4th custom popover — the
                trigger/menu/keyboard/outside-click machinery the other three
                selectors need doesn't earn its cost for a single-purpose list
                filter, and a real <select> is free, accessible-by-default. */}
            <select
              aria-label="Filter by assignee"
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              className="ml-auto shrink-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1
                         text-[11px] text-[var(--ink-2)] outline-none focus:border-[var(--accent)] transition-colors"
            >
              <option value="">Everyone</option>
              <option value="any">Assigned</option>
              <option value="null">Unassigned</option>
              {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Conversations">
          {filtered.length === 0 && (
            <EmptyState
              title="No conversations"
              description={search ? 'Nothing matches that search.' : 'New patient messages will appear here.'}
            />
          )}
          {filtered.map(thread => (
            <ThreadRow
              key={thread.session_id}
              thread={{ ...thread, status: getStatus(thread) }}
              selected={selected?.session_id === thread.session_id}
              onSelect={() => {
                setSelected(thread)
                setLiveMessages(thread.messages)
                loadHandoffSessions(botClientId)
              }}
            />
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden glass-strong sheen min-w-0">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              title="Select a conversation"
              description="Pick a patient from the list to read the thread and reply."
            />
          </div>
        ) : (
          <>
            <div className="shrink-0 border-b border-white/[0.06] bg-white/[0.02] px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-[var(--ink-1)] truncate" style={{ fontFamily: 'var(--font-jakarta)' }}>
                  {maskIdentity(selected.sender_id || selected.phone, selectedChannel, selected.username, selected.displayName)}
                </p>
                <p className="text-[12px] text-[var(--ink-3)]">
                  {liveMessages.length} messages · {formatTimestamp(selected.lastAt)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Patient context is a fixed pane at 2xl+ (below, unchanged) —
                    below that width it's hidden entirely, so this is the only
                    way to reach patient identity, AI summary, and every triage
                    control (status/priority/assignee/tags). Hidden at 2xl+
                    since the fixed pane already shows all of that there. */}
                <button
                  type="button"
                  onClick={() => setContextOpen(true)}
                  aria-label="Patient info"
                  title="Patient info"
                  className="2xl:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--ink-3)]
                             hover:text-[var(--ink-1)] hover:bg-white/[0.06] transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-[18px] h-[18px]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                </button>
                <StatusBadge status={statusToken(selectedStatus)} />
                {selectedHandedOff ? (
                  <button
                    onClick={() => handleResume(selected)}
                    disabled={resuming === busyKey}
                    className="px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: 'var(--status-open)', background: 'var(--status-open-soft)' }}
                  >
                    {resuming === busyKey ? 'Resuming…' : 'Resume bot'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleTakeover(selected)}
                    disabled={takingOver === busyKey}
                    title="Pause the bot and reply yourself"
                    className="px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: 'var(--prio-medium)', background: 'var(--prio-medium-soft)' }}
                  >
                    {takingOver === busyKey ? 'Taking over…' : 'Take over'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {liveMessages.map((msg, i) => (
                <MessageBubble
                  key={msg.id || i}
                  message={msg}
                  channel={selectedChannel}
                  delivery={deliveryMap.get(msg.id)}
                  isLast={i === liveMessages.length - 1}
                />
              ))}
              {selectedHandedOff && (
                <div className="flex justify-center py-2">
                  <span
                    className="text-[11px] px-3 py-1 rounded-full"
                    style={{ color: 'var(--status-pending)', background: 'var(--status-pending-soft)' }}
                  >
                    Human handling this conversation
                  </span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Replies are only possible while the bot is paused — otherwise the
                bot and a human would both be answering the same patient. */}
            {selectedHandedOff && (
              <Composer
                value={replyText}
                onChange={setReplyText}
                onSend={handleSend}
                onAttach={handleAttach}
                onSuggest={handleSuggest}
                sending={sending}
                attaching={attaching}
                suggesting={suggesting}
                channelLabel={channelLabel}
              />
            )}
          </>
        )}
      </div>

      {/* Patient context — a fixed pane at 2xl+, and (same props, same live
          state) a Drawer below that width, opened by the header button above.
          One props object so the two renders can't drift out of sync. */}
      {(() => {
        const contextProps = {
          thread: selected,
          messageCount: liveMessages.length,
          summary,
          summarizing,
          onSummarize: handleSummarize,
          onDismissSummary: dismissSummary,
          triageStatus: selectedMeta?.triageStatus,
          priority: selectedMeta?.priority,
          assigneeId: selectedMeta?.assigneeId,
          tags: selectedMeta?.tags,
          staff: staffList,
          tagCatalogue,
          onSetTriageStatus: setThreadTriageStatus,
          onSetPriority: setThreadPriority,
          onSetAssignee: setThreadAssignee,
          onAddTag: addThreadTag,
          onRemoveTag: removeThreadTag,
          onCreateTag: createTag,
        }
        return (
          <>
            <div className="hidden 2xl:block shrink-0" style={{ width: 'var(--pane-context)' }}>
              <PatientContext {...contextProps} />
            </div>
            <Drawer open={contextOpen} onClose={() => setContextOpen(false)} label="Patient context">
              <PatientContext {...contextProps} onClose={() => setContextOpen(false)} />
            </Drawer>
          </>
        )
      })()}
    </div>
  )
}
