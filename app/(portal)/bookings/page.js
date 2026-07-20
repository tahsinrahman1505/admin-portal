'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { TableSkeleton } from '@/components/Skeleton';

const STATUS_STYLES = {
  confirmed: { bg: 'bg-[#00e5b0]/[0.12]', text: 'text-[#00e5b0]', border: 'border-[#00e5b0]/20', dot: 'bg-[#00e5b0]', block: 'bg-[#00e5b0]/20 border-[#00e5b0]/30 text-[#00e5b0]' },
  pending:   { bg: 'bg-amber-500/[0.1]',  text: 'text-amber-300',  border: 'border-amber-500/20', dot: 'bg-amber-400', block: 'bg-amber-500/15 border-amber-500/25 text-amber-300' },
  cancelled: { bg: 'bg-red-500/[0.08]',   text: 'text-red-400',    border: 'border-red-500/15',   dot: 'bg-red-400',   block: 'bg-red-500/12 border-red-500/20 text-red-400' },
};

// No-show risk buckets — color-coded, explainable. Scores come from the
// read-only /bookings/risk endpoint (rules-based scorer on the RAG server).
const RISK_STYLES = {
  high:    { bg: 'bg-red-500/[0.12]',   text: 'text-red-300',    border: 'border-red-500/25',    dot: 'bg-red-400',    label: 'High' },
  medium:  { bg: 'bg-amber-500/[0.1]',  text: 'text-amber-300',  border: 'border-amber-500/20',  dot: 'bg-amber-400',  label: 'Medium' },
  low:     { bg: 'bg-[#00e5b0]/[0.1]',  text: 'text-[#00e5b0]',  border: 'border-[#00e5b0]/20',  dot: 'bg-[#00e5b0]',  label: 'Low' },
  unknown: { bg: 'bg-white/[0.04]',     text: 'text-white/40',   border: 'border-white/[0.08]',  dot: 'bg-white/30',   label: 'N/A' },
};

function RiskBadge({ risk }) {
  if (!risk) return <span className="text-white/15 text-[12px]">—</span>;
  const r = RISK_STYLES[risk.bucket] ?? RISK_STYLES.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-lg border ${r.bg} ${r.text} ${r.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.dot}`} />
      {r.label}{risk.bucket !== 'unknown' ? ` · ${risk.score}` : ''}
    </span>
  );
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 8); // 8am–6pm
const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDateLabel(date) {
  return date.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });
}

const patientName = (b) => b.patient_name || b.name || 'Unnamed patient';

// Split a stored appointment_date (ISO datetime) into <input> date/time values.
function splitForInputs(iso) {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/* ── Create / Edit form modal ── */
// Mounted only while open, with a key tied to the booking being edited, so the
// lazy initializer below runs fresh each open — no sync setState-in-effect.
function BookingFormModal({ open, onClose, onSubmit, initial, saving }) {
  const [form, setForm] = useState(() => {
    if (initial) {
      const { date, time } = splitForInputs(initial.appointment_date);
      return {
        patient_name: initial.patient_name || initial.name || '',
        phone: initial.phone || '',
        service: initial.service || '',
        date, time,
        status: initial.status || 'confirmed',
        notes: initial.notes || '',
      };
    }
    return { patient_name: '', phone: '', service: '', date: '', time: '', status: 'confirmed', notes: '' };
  });
  const [err, setErr] = useState('');

  if (!open) return null;

  const field = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit() {
    if (!form.patient_name.trim()) { setErr('Patient name is required.'); return; }
    const appointment_date = form.date ? `${form.date}T${form.time || '09:00'}` : '';
    const res = await onSubmit({
      patient_name: form.patient_name.trim(),
      phone: form.phone.trim(),
      service: form.service.trim(),
      appointment_date,
      status: form.status,
      notes: form.notes.trim(),
    });
    if (res?.warning) setErr(res.warning);
    else if (res?.ok === false) setErr(res.error || 'Could not save.');
  }

  const inputCls = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-[13px] text-white placeholder-white/25 outline-none focus:border-[#00e5b0]/40 transition-colors';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[92vw] glass-strong sheen border border-white/[0.08] rounded-2xl z-50 overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <p className="text-white font-semibold text-[14px]">{initial ? 'Edit booking' : 'New booking'}</p>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-3.5">
          <div>
            <label className="text-white/30 text-[11px] mb-1 block">Patient name *</label>
            <input className={inputCls} value={form.patient_name} onChange={field('patient_name')} placeholder="e.g. Fatima Al Mansoori" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/30 text-[11px] mb-1 block">Phone</label>
              <input className={inputCls} value={form.phone} onChange={field('phone')} placeholder="+9715XXXXXXXX" />
            </div>
            <div>
              <label className="text-white/30 text-[11px] mb-1 block">Service</label>
              <input className={inputCls} value={form.service} onChange={field('service')} placeholder="e.g. Cleaning" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/30 text-[11px] mb-1 block">Date</label>
              <input type="date" className={inputCls} value={form.date} onChange={field('date')} />
            </div>
            <div>
              <label className="text-white/30 text-[11px] mb-1 block">Time</label>
              <input type="time" className={inputCls} value={form.time} onChange={field('time')} />
            </div>
          </div>
          <div>
            <label className="text-white/30 text-[11px] mb-1 block">Status</label>
            <select className={inputCls} value={form.status} onChange={field('status')}>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="text-white/30 text-[11px] mb-1 block">Notes</label>
            <textarea rows={2} className={inputCls + ' resize-none'} value={form.notes} onChange={field('notes')} placeholder="Optional — e.g. phoned in, prefers morning" />
          </div>
          {err && <p className="text-amber-400 text-[11.5px]">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12.5px] text-white/50 hover:text-white/80 transition-colors">Cancel</button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-[12.5px] font-medium bg-[#00e5b0] text-[#04140f] hover:bg-[#00e5b0]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add booking'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ── Detail drawer ── */
function BookingDrawer({ booking, risk, onClose, onEdit, onCancel, busy }) {
  if (!booking) return null;
  const s = STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending;
  const d = new Date(booking.appointment_date ?? booking.created_at);
  const isCancelled = (booking.status || '').toLowerCase() === 'cancelled';
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-0 top-0 h-full w-[360px] glass-strong sheen border-l border-white/[0.08] z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <p className="text-white font-semibold text-[14px]">{patientName(booking)}</p>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {booking.status || 'pending'}
            </div>
            {booking.source && (
              <span className="text-[10.5px] text-white/30 bg-white/[0.04] border border-white/[0.07] px-2 py-1 rounded-lg capitalize">
                {booking.source === 'bot' ? '🤖 Bot' : booking.source}
              </span>
            )}
          </div>
          {[
            { label: 'Phone',    val: booking.phone   || '—' },
            { label: 'Service',  val: booking.service || '—' },
            { label: 'Date',     val: d.toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
            { label: 'Time',     val: d.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) },
            ...(booking.notes ? [{ label: 'Notes', val: booking.notes }] : []),
          ].map(row => (
            <div key={row.label} className="flex flex-col gap-1">
              <p className="text-white/25 text-[11px]">{row.label}</p>
              <p className="text-white/70 text-[13px]">{row.val}</p>
            </div>
          ))}
          {risk && risk.bucket !== 'unknown' && (
            <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-white/25 text-[11px]">No-show risk</p>
                <RiskBadge risk={risk} />
              </div>
              {risk.factors?.length > 0 && (
                <ul className="flex flex-col gap-1.5 mt-0.5">
                  {risk.factors.map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[12px] text-white/55">
                      <span className="text-white/30 tabular-nums shrink-0">+{f.points}</span>
                      <span>{f.detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={() => onEdit(booking)}
            className="flex-1 px-4 py-2.5 rounded-xl text-[12.5px] font-medium bg-white/[0.05] text-white/70 border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
          >
            Edit
          </button>
          {!isCancelled && (
            <button
              onClick={() => onCancel(booking)}
              disabled={busy}
              className="flex-1 px-4 py-2.5 rounded-xl text-[12.5px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-40"
            >
              {busy ? 'Cancelling…' : 'Cancel booking'}
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('calendar'); // 'calendar' | 'list'
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selected, setSelected]   = useState(null);
  const [portalClientId, setPortalClientId] = useState(null);
  const [botClientId, setBotClientId]       = useState('');
  const [riskMap, setRiskMap]               = useState({}); // booking.id -> {score,bucket,factors}
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [saving, setSaving]       = useState(false);
  const [busy, setBusy]           = useState(false);
  const realtimeRef = useRef(null);

  const fetchBookings = useCallback(async (pcid) => {
    const { data } = await supabase
      .from('pending_bookings')
      .select('*')
      .eq('client_id', pcid)
      .order('appointment_date', { ascending: true });
    setBookings(data || []);
  }, []);

  // No-show risk is computed server-side (read-only); merge it in by booking id.
  // Best-effort: a risk-fetch failure never blocks the bookings table.
  const fetchRisk = useCallback(async (botCid) => {
    try {
      const res = await fetch(`/api/rag/bookings/risk?client_id=${encodeURIComponent(botCid || 'dental_demo')}`);
      const data = await res.json();
      if (data?.ok && Array.isArray(data.bookings)) {
        setRiskMap(Object.fromEntries(data.bookings.map((b) => [b.id, b.risk])));
      }
    } catch { /* ignore — table still renders without risk */ }
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, bot_client_id')
        .eq('user_id', user.id)
        .single();
      if (!clientRow) { setLoading(false); return; }
      setPortalClientId(clientRow.id);
      setBotClientId(clientRow.bot_client_id || 'dental_demo');
      await fetchBookings(clientRow.id);
      setLoading(false);
      fetchRisk(clientRow.bot_client_id || 'dental_demo');
    }
    load();
  }, [fetchBookings, fetchRisk, router]);

  // Realtime: reflect new/changed bookings (bot-made or from another device).
  useEffect(() => {
    if (!portalClientId) return;
    if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    const ch = supabase
      .channel('bookings-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_bookings', filter: `client_id=eq.${portalClientId}` },
        () => { fetchBookings(portalClientId); fetchRisk(botClientId); })
      .subscribe();
    realtimeRef.current = ch;
    return () => supabase.removeChannel(ch);
  }, [portalClientId, botClientId, fetchBookings, fetchRisk]);

  async function callBooking(action, payload) {
    const res = await fetch(`/api/rag/bookings/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: botClientId || 'dental_demo', ...payload }),
    });
    return res.json().catch(() => ({ ok: false, error: 'Network error' }));
  }

  async function handleSubmit(form) {
    setSaving(true);
    try {
      const data = editing
        ? await callBooking('update', { booking_id: editing.id, ...form })
        : await callBooking('create', form);
      if (data?.ok) {
        await fetchBookings(portalClientId);
        if (!data.warning) { setFormOpen(false); setEditing(null); setSelected(null); }
      }
      return data;
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(booking) {
    setBusy(true);
    try {
      const data = await callBooking('cancel', { booking_id: booking.id });
      if (data?.ok) { await fetchBookings(portalClientId); setSelected(null); }
    } finally {
      setBusy(false);
    }
  }

  function openCreate() { setEditing(null); setFormOpen(true); }
  function openEdit(b)  { setEditing(b); setSelected(null); setFormOpen(true); }

  if (loading) return <TableSkeleton />;

  /* Build week days */
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  function bookingsForDay(day) {
    return bookings.filter(b => sameDay(new Date(b.appointment_date ?? b.created_at), day));
  }
  function hourOf(b) {
    return new Date(b.appointment_date ?? b.created_at).getHours();
  }

  const today = new Date();

  /* ── CALENDAR VIEW ── */
  const CalendarView = (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/[0.06] mb-0">
          <div />
          {weekDays.map((d, i) => {
            const isToday = sameDay(d, today);
            return (
              <div key={i} className={`px-2 py-3 text-center ${isToday ? 'border-b-2 border-[#00e5b0]' : ''}`}>
                <p className="text-[10.5px] text-white/30 uppercase tracking-wider">{DAYS[d.getDay()]}</p>
                <p className={`text-[15px] font-bold mt-0.5 ${isToday ? 'text-[#00e5b0]' : 'text-white/60'}`}>{d.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="relative">
          {HOURS.map(h => (
            <div key={h} className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/[0.04]" style={{ minHeight: 56 }}>
              <div className="px-2 py-1 text-[10px] text-white/20 tabular-nums pt-1.5">{h % 12 || 12}{h < 12 ? 'am' : 'pm'}</div>
              {weekDays.map((day, di) => {
                const dayBookings = bookingsForDay(day).filter(b => hourOf(b) === h);
                return (
                  <div key={di} className="relative border-l border-white/[0.03] px-1 py-0.5 space-y-0.5">
                    {dayBookings.map((b, bi) => {
                      const s = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending;
                      return (
                        <motion.button
                          key={b.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: bi * 0.05 }}
                          onClick={() => setSelected(b)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-[10.5px] font-semibold border truncate transition-all hover:brightness-125 ${s.block}`}
                        >
                          {patientName(b)}
                        </motion.button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── LIST VIEW ── */
  const ListViewEl = (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full text-[13px]">
        <thead className="border-b border-white/[0.07]">
          <tr>
            {['Name', 'Phone', 'Service', 'Date', 'Risk', 'Status'].map(h => (
              <th key={h} className="px-5 py-3.5 text-left text-[10.5px] font-semibold text-white/25 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {bookings.map((b, i) => {
            const s = STATUS_STYLES[b.status] ?? STATUS_STYLES.pending;
            return (
              <motion.tr
                key={b.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                onClick={() => setSelected(b)}
              >
                <td className="px-5 py-3.5 font-medium text-white/80">{patientName(b)}</td>
                <td className="px-5 py-3.5 text-white/40">{b.phone || '—'}</td>
                <td className="px-5 py-3.5 text-white/40">{b.service || '—'}</td>
                <td className="px-5 py-3.5 text-white/30 tabular-nums text-[12px]">
                  {new Date(b.appointment_date ?? b.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-5 py-3.5"><RiskBadge risk={riskMap[b.id]} /></td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-lg border ${s.bg} ${s.text} ${s.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                    {b.status || 'pending'}
                  </span>
                </td>
              </motion.tr>
            );
          })}
          {bookings.length === 0 && (
            <tr><td colSpan={6} className="px-5 py-14 text-center text-white/15 text-[13px]">No bookings yet. Add one with “New booking”.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between mb-6 flex-wrap gap-4"
      >
        <div>
          <h1 className="text-[1.35rem] font-extrabold text-white tracking-tight">Bookings</h1>
          <p className="text-[12.5px] text-white/30 mt-0.5">{bookings.length} total</p>
        </div>

        <div className="flex items-center gap-3">
          {/* New booking */}
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold bg-[#00e5b0] text-[#04140f] hover:bg-[#00e5b0]/90 transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>
            New booking
          </button>

          {/* Week nav — only shown in calendar mode */}
          {view === 'calendar' && (
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.07] rounded-xl px-3 py-2">
              <button
                onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }}
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>
              </button>
              <span className="text-white/50 text-[12px] font-medium w-36 text-center">
                {formatDateLabel(weekDays[0])} – {formatDateLabel(weekDays[6])}
              </span>
              <button
                onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }}
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
              </button>
              <button
                onClick={() => setWeekStart(getWeekStart(new Date()))}
                className="text-[11px] font-semibold text-[#00e5b0]/60 hover:text-[#00e5b0] transition-colors ml-1 border border-[#00e5b0]/20 px-2 py-0.5 rounded-lg"
              >
                Today
              </button>
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.07] rounded-xl p-1 gap-1">
            {[
              { id: 'calendar', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"/></svg> },
              { id: 'list',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg> },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`p-2 rounded-lg transition-all duration-150 ${view === v.id ? 'bg-[#00e5b0]/[0.15] text-[#00e5b0]' : 'text-white/30 hover:text-white/60'}`}
              >
                {v.icon}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {Object.entries(STATUS_STYLES).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className="text-white/30 text-[11px] capitalize">{key}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass sheen rounded-[var(--r-md)] relative overflow-hidden"
      >
        {view === 'calendar' ? CalendarView : ListViewEl}
      </motion.div>

      {/* Drawer */}
      <AnimatePresence>
        {selected && (
          <BookingDrawer
            booking={selected}
            risk={riskMap[selected.id]}
            onClose={() => setSelected(null)}
            onEdit={openEdit}
            onCancel={handleCancel}
            busy={busy}
          />
        )}
      </AnimatePresence>

      {/* Create / Edit modal */}
      <AnimatePresence>
        {formOpen && (
          <BookingFormModal
            key={editing ? `edit-${editing.id}` : 'create'}
            open={formOpen}
            initial={editing}
            saving={saving}
            onClose={() => { setFormOpen(false); setEditing(null); }}
            onSubmit={handleSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
