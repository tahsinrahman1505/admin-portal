'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { resolveBotClientId } from '@/lib/clientId'
import { TableSkeleton } from '@/components/Skeleton'

const STATUS_COLORS = {
  due:       { bg: 'bg-[#00e5b0]/[0.1]', text: 'text-[#00e5b0]', dot: 'bg-[#00e5b0]', label: 'Due' },
  scheduled: { bg: 'bg-blue-400/[0.1]',  text: 'text-blue-400',  dot: 'bg-blue-400',  label: 'Scheduled' },
  contacted: { bg: 'bg-yellow-400/[0.1]',text: 'text-yellow-400',dot: 'bg-yellow-400',label: 'Contacted' },
  rebooked:  { bg: 'bg-emerald-400/[0.1]',text: 'text-emerald-400',dot: 'bg-emerald-400',label: 'Rebooked' },
  dismissed: { bg: 'bg-white/[0.06]',    text: 'text-white/40',  dot: 'bg-white/25',  label: 'Dismissed' },
  opted_out: { bg: 'bg-red-400/[0.1]',   text: 'text-red-400',   dot: 'bg-red-400',   label: 'Opted out' },
}

function maskPhone(phone) {
  if (!phone) return '—'
  const clean = phone.replace(/\D/g, '')
  if (clean.length >= 7) return `+${clean.slice(0, clean.length - 4).replace(/.(?=.{2})/g, '*')}${clean.slice(-4)}`
  return phone
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dueLabel(iso) {
  if (!iso) return { text: '—', cls: 'text-white/30' }
  const days = Math.round((new Date(iso + 'T00:00:00').getTime() - Date.now()) / 86400000)
  if (days < 0)   return { text: `${Math.abs(days)}d overdue`, cls: 'text-[#00e5b0]' }
  if (days === 0) return { text: 'today', cls: 'text-[#00e5b0]' }
  if (days <= 30) return { text: `in ${days}d`, cls: 'text-yellow-400' }
  return { text: `in ${days}d`, cls: 'text-white/40' }
}

export default function RecallPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [interval, setInterval] = useState(6)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  // ── Tier-1 automatic sync ───────────────────────────────────────────────────
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncCfg, setSyncCfg] = useState(null)      // saved config from the server
  const [syncUrl, setSyncUrl] = useState('')
  const [syncEnabled, setSyncEnabled] = useState(false)
  const [syncInterval, setSyncInterval] = useState(6)
  const [syncBusy, setSyncBusy] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  async function loadSyncCfg() {
    try {
      const res = await fetch('/api/roster/sync', { credentials: 'include' })
      const data = await res.json()
      if (data.config) {
        setSyncCfg(data.config)
        setSyncUrl(data.config.roster_sync_url || '')
        setSyncEnabled(!!data.config.roster_sync_enabled)
        setSyncInterval(data.config.roster_sync_interval_months || 6)
      }
    } catch { /* non-fatal: the manual importer still works */ }
  }

  async function saveSync() {
    setSyncBusy(true); setSyncMsg(null)
    try {
      const res = await fetch('/api/roster/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          client_id: clientId,
          roster_sync_url: syncUrl,
          roster_sync_enabled: syncEnabled,
          roster_sync_interval_months: syncInterval,
        }),
      })
      const data = await res.json()
      setSyncMsg(res.ok ? { ok: true, msg: 'Settings saved.' } : { ok: false, msg: data.error || 'Could not save.' })
      if (res.ok) await loadSyncCfg()
    } catch {
      setSyncMsg({ ok: false, msg: 'Network error while saving.' })
    }
    setSyncBusy(false)
  }

  async function runSyncNow() {
    setSyncBusy(true); setSyncMsg(null)
    try {
      const res = await fetch('/api/roster/sync', { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSyncMsg({ ok: true, msg: `Imported ${data.imported} patient${data.imported === 1 ? '' : 's'}${data.skipped ? ` · ${data.skipped} skipped (no phone)` : ''}.` })
        await load(clientId)
      } else {
        setSyncMsg({ ok: false, msg: data.error || 'Sync failed.' })
      }
      await loadSyncCfg()
    } catch {
      setSyncMsg({ ok: false, msg: 'Network error during sync.' })
    }
    setSyncBusy(false)
  }

  async function load(cid) {
    setLoading(true)
    try {
      const res = await fetch(`/api/roster?client_id=${encodeURIComponent(cid)}`, { credentials: 'include' })
      const data = await res.json()
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch {
      setRows([])
    }
    setLoading(false)
  }

  useEffect(() => {
    (async () => {
      const cid = await resolveBotClientId()
      setClientId(cid)
      await load(cid)
      await loadSyncCfg()
    })()
  }, [])

  async function onFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setImportOpen(true)
  }

  async function runImport() {
    if (!csvText.trim() || !clientId) return
    setImporting(true)
    setResult(null)
    try {
      const res = await fetch('/api/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ client_id: clientId, csv: csvText, recall_interval_months: interval }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, msg: data.error || 'Import failed.' })
      } else {
        setResult({ ok: true, msg: `Imported ${data.imported} patient${data.imported !== 1 ? 's' : ''}${data.skipped ? ` · ${data.skipped} skipped (no phone)` : ''}.` })
        setCsvText('')
        await load(clientId)
      }
    } catch {
      setResult({ ok: false, msg: 'Network error during import.' })
    }
    setImporting(false)
  }

  // Freshest possible "now" for due-date math on every render — an effect-set
  // ref would lag behind (only updates on its own trigger, plus an extra
  // render pass), which is worse for a due/overdue count than a direct read.
  // eslint-disable-next-line react-hooks/purity -- wall-clock read needed fresh each render; caching it would make due/overdue counts go stale
  const now = Date.now()
  const stats = {
    total: rows.length,
    dueNow: rows.filter(r => r.next_due_date && new Date(r.next_due_date + 'T00:00:00').getTime() <= now && ['due', 'scheduled'].includes(r.recall_status)).length,
    dueSoon: rows.filter(r => {
      if (!r.next_due_date) return false
      const days = (new Date(r.next_due_date + 'T00:00:00').getTime() - now) / 86400000
      return days > 0 && days <= 30
    }).length,
    rebooked: rows.filter(r => r.recall_status === 'rebooked').length,
  }

  const FILTERS = ['all', 'due', 'scheduled', 'contacted', 'rebooked']
  const filtered = rows.filter(r => {
    const matchFilter = filter === 'all' || r.recall_status === filter
    const matchSearch = !search || (r.name || '').toLowerCase().includes(search.toLowerCase()) || (r.phone || '').includes(search)
    return matchFilter && matchSearch
  })

  return (
    <div className="p-7 max-w-[1100px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between mb-6 gap-4"
      >
        <div>
          <h1 className="text-white font-extrabold text-[1.35rem] tracking-tight" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Recall &amp; Reactivation
          </h1>
          <p className="text-white/30 text-[12.5px] mt-0.5 max-w-[560px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
            Import your patient list from any practice software (name, phone, last-visit date). We track who&apos;s due for their next visit — the source for automated recall outreach.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => setSyncOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-white/60 text-[12.5px] font-semibold hover:text-white/85 hover:bg-white/[0.07] transition-colors"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992M4.031 9.348a8.25 8.25 0 0113.803-3.7l3.181 3.182m-18.03 4.822l3.181 3.182a8.25 8.25 0 0013.803-3.7" />
            </svg>
            Auto-sync
            {syncCfg?.roster_sync_enabled && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e5b0]" title="Automatic sync is on" />
            )}
          </button>
          <button
            onClick={() => setImportOpen(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00e5b0]/[0.12] border border-[#00e5b0]/25 text-[#00e5b0] text-[12.5px] font-semibold hover:bg-[#00e5b0]/[0.18] transition-colors"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Import patient list
          </button>
        </div>
      </motion.div>

      {/* Import panel */}
      <AnimatePresence>
        {importOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/70 text-[13px] font-semibold" style={{ fontFamily: 'var(--font-jakarta)' }}>Import from CSV</p>
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/60 text-[11.5px] font-medium hover:text-white/85 transition-colors"
                    style={{ fontFamily: 'var(--font-jakarta)' }}
                  >
                    Choose file…
                  </button>
                </div>
              </div>
              <p className="text-white/25 text-[11px] mb-2" style={{ fontFamily: 'var(--font-jakarta)' }}>
                Paste rows, or choose a file. First row must be headers. Recognized columns: <span className="text-white/40">name, phone, last visit, type</span>. Only a phone column is required.
              </p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={'name,phone,last visit,type\nAisha Al Mansoori,0501234567,12/01/2026,Cleaning\nOmar Haddad,0559876543,05/12/2025,Checkup'}
                rows={6}
                className="w-full bg-black/20 border border-white/[0.08] rounded-xl px-3.5 py-3 text-[12px] text-white/75 placeholder-white/20 outline-none focus:border-[#00e5b0]/30 transition-colors font-mono resize-y"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <label className="flex items-center gap-2 text-white/40 text-[12px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                  Recall cycle
                  <select
                    value={interval}
                    onChange={e => setInterval(parseInt(e.target.value, 10))}
                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 text-[12px] outline-none focus:border-[#00e5b0]/30"
                  >
                    {[3, 4, 6, 9, 12].map(m => <option key={m} value={m} className="glass-strong sheen">{m} months</option>)}
                  </select>
                </label>
                <div className="flex items-center gap-3">
                  {result && (
                    <span className={`text-[12px] font-medium ${result.ok ? 'text-[#00e5b0]' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-jakarta)' }}>
                      {result.msg}
                    </span>
                  )}
                  <button
                    onClick={runImport}
                    disabled={importing || !csvText.trim()}
                    className="px-4 py-2 rounded-xl bg-[#00e5b0] text-[#04231c] text-[12.5px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 transition-all"
                    style={{ fontFamily: 'var(--font-jakarta)' }}
                  >
                    {importing ? 'Importing…' : 'Import'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tier-1 automatic sync panel */}
      <AnimatePresence>
        {syncOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden mb-6"
          >
            <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5">
              <p className="text-white/70 text-[13px] font-semibold mb-1" style={{ fontFamily: 'var(--font-jakarta)' }}>
                Keep it up to date automatically
              </p>
              <p className="text-white/25 text-[11px] mb-3 max-w-[640px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                Set your practice software to export the patient list to a cloud folder (Google&nbsp;Drive, Google&nbsp;Sheets, Dropbox or OneDrive), then paste the share link here. We re-read it every night, so the list never goes stale. Works with any software — nothing to install.
              </p>

              <label className="block text-white/40 text-[11.5px] mb-1.5" style={{ fontFamily: 'var(--font-jakarta)' }}>
                Export link
              </label>
              <input
                type="url"
                value={syncUrl}
                onChange={e => setSyncUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…  or  https://www.dropbox.com/s/…/patients.csv"
                className="w-full bg-black/20 border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-[12px] text-white/75 placeholder-white/20 outline-none focus:border-[#00e5b0]/30 transition-colors"
              />
              <p className="text-white/20 text-[10.5px] mt-1.5" style={{ fontFamily: 'var(--font-jakarta)' }}>
                The link must be viewable by anyone with the link. Share-page links are converted to a direct download automatically.
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-white/40 text-[12px] cursor-pointer" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    <input
                      type="checkbox"
                      checked={syncEnabled}
                      onChange={e => setSyncEnabled(e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#00e5b0]"
                    />
                    Sync automatically each night
                  </label>
                  <label className="flex items-center gap-2 text-white/40 text-[12px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    Recall cycle
                    <select
                      value={syncInterval}
                      onChange={e => setSyncInterval(parseInt(e.target.value, 10))}
                      className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-white/70 text-[12px] outline-none focus:border-[#00e5b0]/30"
                    >
                      {[3, 4, 6, 9, 12].map(m => <option key={m} value={m} className="glass-strong sheen">{m} months</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveSync}
                    disabled={syncBusy}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white/60 text-[12px] font-medium hover:text-white/85 disabled:opacity-40 transition-colors"
                    style={{ fontFamily: 'var(--font-jakarta)' }}
                  >
                    Save
                  </button>
                  <button
                    onClick={runSyncNow}
                    disabled={syncBusy || !syncUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-[#00e5b0] text-[#04231c] text-[12.5px] font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-105 transition-all"
                    style={{ fontFamily: 'var(--font-jakarta)' }}
                  >
                    {syncBusy ? 'Working…' : 'Sync now'}
                  </button>
                </div>
              </div>

              {syncMsg && (
                <p className={`text-[12px] font-medium mt-3 ${syncMsg.ok ? 'text-[#00e5b0]' : 'text-red-400'}`} style={{ fontFamily: 'var(--font-jakarta)' }}>
                  {syncMsg.msg}
                </p>
              )}

              {/* Last-run status — without this a failing nightly sync is invisible:
                  the roster just quietly stops updating. */}
              {syncCfg?.roster_last_sync_at && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                  <span className={`w-1.5 h-1.5 rounded-full ${syncCfg.roster_last_sync_status === 'ok' ? 'bg-[#00e5b0]' : 'bg-red-400'}`} />
                  <span className="text-white/35 text-[11.5px]" style={{ fontFamily: 'var(--font-jakarta)' }}>
                    Last sync {new Date(syncCfg.roster_last_sync_at).toLocaleString()} — {syncCfg.roster_last_sync_detail || syncCfg.roster_last_sync_status}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat tiles */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
      >
        {[
          { label: 'Total patients', value: stats.total, accent: 'text-white/80' },
          { label: 'Due now', value: stats.dueNow, accent: 'text-[#00e5b0]' },
          { label: 'Due within 30d', value: stats.dueSoon, accent: 'text-yellow-400' },
          { label: 'Rebooked', value: stats.rebooked, accent: 'text-emerald-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/[0.07] rounded-2xl px-4 py-3.5">
            <p className="text-white/30 text-[11px] mb-1" style={{ fontFamily: 'var(--font-jakarta)' }}>{s.label}</p>
            <p className={`text-[1.6rem] font-extrabold leading-none ${s.accent}`} style={{ fontFamily: 'var(--font-jakarta)' }}>{s.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="flex flex-wrap items-center gap-3 mb-5"
      >
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or phone…"
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl pl-8 pr-3 py-2 text-[12.5px] text-white/70 placeholder-white/20 outline-none focus:border-[#00e5b0]/30 transition-colors"
            style={{ fontFamily: 'var(--font-jakarta)' }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all duration-150 capitalize ${
                filter === s
                  ? 'bg-[#00e5b0]/[0.15] text-[#00e5b0] border border-[#00e5b0]/20'
                  : 'bg-white/[0.04] text-white/30 border border-white/[0.06] hover:text-white/50'
              }`}
              style={{ fontFamily: 'var(--font-jakarta)' }}
            >
              {s === 'all' ? `All (${rows.length})` : (STATUS_COLORS[s]?.label || s)}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      {loading ? <TableSkeleton /> : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Patient', 'Phone', 'Last visit', 'Next due', 'Status'].map(h => (
                    <th key={h} className="text-left text-[10.5px] font-semibold text-white/25 uppercase tracking-wider px-5 py-3.5" style={{ fontFamily: 'var(--font-jakarta)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-white/20 text-[13px] py-12" style={{ fontFamily: 'var(--font-jakarta)' }}>
                      {rows.length === 0 ? 'No patients yet — import your list to get started.' : 'No patients match this filter.'}
                    </td>
                  </tr>
                ) : filtered.map((p, i) => {
                  const sc = STATUS_COLORS[p.recall_status] ?? STATUS_COLORS.due
                  const due = dueLabel(p.next_due_date)
                  return (
                    <motion.tr
                      key={p.id || p.phone}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.02, 0.4) }}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#00e5b0]/[0.08] border border-[#00e5b0]/15 flex items-center justify-center shrink-0">
                            <span className="text-[#00e5b0]/60 text-[12px] font-bold" style={{ fontFamily: 'var(--font-jakarta)' }}>
                              {(p.name || '?').trim().charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-white/75 text-[13px] font-medium" style={{ fontFamily: 'var(--font-jakarta)' }}>
                            {p.name || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-white/50 text-[12.5px]" style={{ fontFamily: 'var(--font-jakarta)' }}>{maskPhone(p.phone)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-white/45 text-[12.5px]" style={{ fontFamily: 'var(--font-jakarta)' }}>{fmtDate(p.last_visit_date)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="text-white/55 text-[12.5px]" style={{ fontFamily: 'var(--font-jakarta)' }}>{fmtDate(p.next_due_date)}</span>
                          <span className={`text-[10.5px] font-semibold ${due.cls}`} style={{ fontFamily: 'var(--font-jakarta)' }}>{due.text}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${sc.bg} ${sc.text}`} style={{ fontFamily: 'var(--font-jakarta)' }}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  )
}
