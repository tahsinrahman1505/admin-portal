'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { TableSkeleton } from '@/components/Skeleton';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// H6 fix: always scope queries to this portal's clinic
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || 'dental_demo';

const STATUS_STYLES = {
  confirmed: { bg: 'bg-[#00e5b0]/[0.12]', text: 'text-[#00e5b0]', border: 'border-[#00e5b0]/20', dot: 'bg-[#00e5b0]', block: 'bg-[#00e5b0]/20 border-[#00e5b0]/30 text-[#00e5b0]' },
  pending:   { bg: 'bg-amber-500/[0.1]',  text: 'text-amber-300',  border: 'border-amber-500/20', dot: 'bg-amber-400', block: 'bg-amber-500/15 border-amber-500/25 text-amber-300' },
  cancelled: { bg: 'bg-red-500/[0.08]',   text: 'text-red-400',    border: 'border-red-500/15',   dot: 'bg-red-400',   block: 'bg-red-500/12 border-red-500/20 text-red-400' },
};

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

/* ── Detail drawer ── */
function BookingDrawer({ booking, onClose }) {
  if (!booking) return null;
  const s = STATUS_STYLES[booking.status] ?? STATUS_STYLES.pending;
  const d = new Date(booking.appointment_date ?? booking.created_at);
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
        className="fixed right-0 top-0 h-full w-[360px] bg-[#0e1c22] border-l border-white/[0.08] z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <p className="text-white font-semibold text-[14px]">{booking.name || 'Unnamed patient'}</p>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
            {booking.status || 'pending'}
          </div>
          {[
            { label: 'Phone',    val: booking.phone   || '—' },
            { label: 'Service',  val: booking.service || '—' },
            { label: 'Date',     val: d.toLocaleDateString('en-AE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
            { label: 'Time',     val: d.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) },
          ].map(row => (
            <div key={row.label} className="flex flex-col gap-1">
              <p className="text-white/25 text-[11px]">{row.label}</p>
              <p className="text-white/70 text-[13px]">{row.val}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}

export default function BookingsPage() {
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState('calendar'); // 'calendar' | 'list'
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selected, setSelected]   = useState(null);

  useEffect(() => {
    async function fetchBookings() {
      const { data } = await supabase
        .from('pending_bookings')
        .select('*')
        .eq('client_id', CLIENT_ID)
        .order('created_at', { ascending: true });
      setBookings(data || []);
      setLoading(false);
    }
    fetchBookings();
  }, []);

  if (loading) return <TableSkeleton />;

  /* Build week days */
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  /* Map bookings onto calendar slots */
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
        {/* Day headers */}
        <div className="grid grid-cols-[52px_repeat(7,1fr)] border-b border-white/[0.06] mb-0">
          <div /> {/* gutter */}
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

        {/* Time grid */}
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
                          {b.name || b.phone || `#${b.id}`}
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
            {['Name', 'Phone', 'Service', 'Date', 'Status'].map(h => (
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
                <td className="px-5 py-3.5 font-medium text-white/80">{b.name || '—'}</td>
                <td className="px-5 py-3.5 text-white/40">{b.phone || '—'}</td>
                <td className="px-5 py-3.5 text-white/40">{b.service || '—'}</td>
                <td className="px-5 py-3.5 text-white/30 tabular-nums text-[12px]">
                  {new Date(b.appointment_date ?? b.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
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
            <tr><td colSpan={5} className="px-5 py-14 text-center text-white/15 text-[13px]">No bookings yet.</td></tr>
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
        className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden"
      >
        {view === 'calendar' ? CalendarView : ListViewEl}
      </motion.div>

      {/* Drawer */}
      <AnimatePresence>
        {selected && <BookingDrawer booking={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
