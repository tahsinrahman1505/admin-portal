'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// All doctor API calls go through server-side proxy routes (/api/rag/doctors/*)
// so RAG_API_SECRET never touches the browser bundle.
const PROXY_BASE = '/api/rag/doctors';
const CLIENT_ID  = process.env.NEXT_PUBLIC_CLIENT_ID ?? 'dental_demo';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const inputCls = "w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[13px] text-white placeholder-white/20 outline-none focus:border-[#00e5b0]/40 transition-all duration-200";
const btnCls   = "px-4 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200";

function headers() {
  return { 'Content-Type': 'application/json' };
}

// ── Doctor card ──────────────────────────────────────────────────────────────
function DoctorCard({ doctor, onEdit, onManage, onDeactivate }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 flex items-start justify-between gap-4"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-[#00e5b0]/10 border border-[#00e5b0]/20 flex items-center justify-center text-[#00e5b0] font-bold text-[15px] shrink-0">
          {(doctor.display_name || doctor.name || '?')[0].toUpperCase()}
        </div>
        <div>
          <p className="text-white font-semibold text-[14px]">{doctor.display_name || doctor.name}</p>
          <p className="text-white/35 text-[12px] mt-0.5">{doctor.specialization || 'General Dentist'}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${doctor.is_active ? 'bg-[#00e5b0]/10 text-[#00e5b0]' : 'bg-white/5 text-white/30'}`}>
              {doctor.is_active ? 'Active' : 'Inactive'}
            </span>
            <span className="text-white/20 text-[11px]">{doctor.calendar_id === 'primary' ? 'Primary calendar' : 'Custom calendar'}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <a
          href={`/api/google/start?doctor_id=${doctor.id}`}
          title={doctor.google_email ? `Connected: ${doctor.google_email}` : "Connect this doctor's Google Calendar"}
          className={`${btnCls} ${doctor.google_email ? 'bg-[#00e5b0]/10 text-[#00e5b0] hover:bg-[#00e5b0]/20' : 'bg-white/[0.06] text-white/60 hover:bg-white/[0.1]'}`}
        >
          {doctor.google_email ? 'Calendar ✓' : 'Connect calendar'}
        </a>
        <button onClick={() => onManage(doctor)} className={`${btnCls} bg-[#00e5b0]/10 text-[#00e5b0] hover:bg-[#00e5b0]/20`}>Schedule & Leaves</button>
        <button onClick={() => onEdit(doctor)}   className={`${btnCls} bg-white/[0.06] text-white/60 hover:bg-white/[0.1]`}>Edit</button>
        {doctor.is_active && (
          <button onClick={() => onDeactivate(doctor.id)} className={`${btnCls} bg-red-500/10 text-red-400 hover:bg-red-500/20`}>Deactivate</button>
        )}
      </div>
    </motion.div>
  );
}

// ── Add / Edit Doctor modal ──────────────────────────────────────────────────
function DoctorModal({ doctor, onSave, onClose }) {
  const isEdit = !!doctor?.id;
  const [form, setForm] = useState({
    name:                doctor?.name || '',
    display_name:        doctor?.display_name || '',
    specialization:      doctor?.specialization || '',
    calendar_id:         doctor?.calendar_id || 'primary',
    calendar_token_path: doctor?.calendar_token_path || '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave() {
    if (!form.name.trim()) { setErr('Doctor name is required.'); return; }
    setSaving(true);
    setErr('');
    try {
      const url    = isEdit ? `${PROXY_BASE}/${doctor.id}?client_id=${CLIENT_ID}` : PROXY_BASE;
      const method = isEdit ? 'PUT' : 'POST';
      const body   = isEdit ? form : { ...form, client_id: CLIENT_ID };
      const r = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
      if (!r.ok) throw new Error(await r.text());
      onSave();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-[#0e1c22] border border-white/[0.09] rounded-2xl z-50 p-6 shadow-2xl">
        <h2 className="text-white font-bold text-[16px] mb-5">{isEdit ? 'Edit Doctor' : 'Add Doctor'}</h2>
        <div className="space-y-4">
          {[
            { label: 'Full name *',      key: 'name',           ph: 'Ahmed Al Rashidi' },
            { label: 'Display name',     key: 'display_name',   ph: 'Dr. Ahmed' },
            { label: 'Specialization',   key: 'specialization', ph: 'General Dentist' },
            { label: 'Google Calendar ID', key: 'calendar_id',  ph: 'primary or calendar@group.calendar.google.com' },
            { label: 'Token file path',  key: 'calendar_token_path', ph: '/root/dental-rag/token_dr_ahmed.json (optional)' },
          ].map(({ label, key, ph }) => (
            <div key={key}>
              <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-[0.1em] mb-1.5">{label}</label>
              <input type="text" className={inputCls} placeholder={ph}
                value={form[key]} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
          {err && <p className="text-red-400 text-[12px]">{err}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} disabled={saving}
            className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold ${saving ? 'bg-[#00e5b0]/30 text-white/40' : 'bg-[#00e5b0] text-[#0a1a1f] hover:bg-[#00ffcc]'} transition-all`}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Doctor'}
          </button>
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] text-white/40 hover:text-white/70 transition-colors">Cancel</button>
        </div>
      </motion.div>
    </>
  );
}

// ── Schedule + Leaves management panel ──────────────────────────────────────
function ManagePanel({ doctor, onClose }) {
  const [tab, setTab]         = useState('schedule');
  const [schedule, setSchedule] = useState([]);
  const [leaves, setLeaves]   = useState([]);
  const [loadingSch, setLoadingSch] = useState(true);
  const [loadingLv, setLoadingLv]   = useState(true);
  const [saving, setSaving]   = useState(false);
  const [addLeave, setAddLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_date: '', is_full_day: true, leave_start: '', leave_end: '', reason: '' });
  const [msg, setMsg] = useState('');

  const doctorName = doctor.display_name || doctor.name;

  const loadSchedule = useCallback(async () => {
    setLoadingSch(true);
    try {
      const r = await fetch(`${PROXY_BASE}/${doctor.id}/schedule`, { headers: headers() });
      const d = await r.json();
      // Ensure all 7 days present, fill missing with defaults
      const map = {};
      (d.schedule || []).forEach(row => { map[row.day_of_week] = row; });
      const full = Array.from({ length: 7 }, (_, i) => map[i] || {
        doctor_id: doctor.id, day_of_week: i,
        is_working: i < 5, work_start: '09:00', work_end: '17:00',
        break_start: '13:00', break_end: '14:00',
      });
      setSchedule(full);
    } finally { setLoadingSch(false); }
  }, [doctor.id]);

  const loadLeaves = useCallback(async () => {
    setLoadingLv(true);
    try {
      const r = await fetch(`${PROXY_BASE}/${doctor.id}/leaves`, { headers: headers() });
      const d = await r.json();
      setLeaves(d.leaves || []);
    } finally { setLoadingLv(false); }
  }, [doctor.id]);

  useEffect(() => { loadSchedule(); loadLeaves(); }, [loadSchedule, loadLeaves]);

  function setSchDay(i, k, v) {
    setSchedule(prev => prev.map((row, idx) => idx === i ? { ...row, [k]: v } : row));
  }

  async function saveSchedule() {
    setSaving(true); setMsg('');
    try {
      const r = await fetch(`${PROXY_BASE}/${doctor.id}/schedule?client_id=${CLIENT_ID}`, {
        method: 'PUT', headers: headers(), body: JSON.stringify(schedule),
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg('Schedule saved ✓');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  async function deleteLeave(leaveId) {
    await fetch(`${PROXY_BASE}/${doctor.id}/leaves/${leaveId}?client_id=${CLIENT_ID}`, { method: 'DELETE', headers: headers() });
    loadLeaves();
  }

  async function submitLeave() {
    if (!leaveForm.leave_date) { setMsg('Please select a date.'); return; }
    setSaving(true);
    try {
      const r = await fetch(`${PROXY_BASE}/${doctor.id}/leaves?client_id=${CLIENT_ID}`, {
        method: 'POST', headers: headers(), body: JSON.stringify(leaveForm),
      });
      if (!r.ok) throw new Error(await r.text());
      setAddLeave(false);
      setLeaveForm({ leave_date: '', is_full_day: true, leave_start: '', leave_end: '', reason: '' });
      loadLeaves();
      setMsg('Leave added ✓');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed right-0 top-0 h-full w-[560px] bg-[#0e1c22] border-l border-white/[0.08] z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] shrink-0">
          <div>
            <p className="text-white font-semibold text-[15px]">{doctorName}</p>
            <p className="text-white/30 text-[12px]">{doctor.specialization || 'General Dentist'}</p>
          </div>
          <button onClick={onClose} className="text-white/25 hover:text-white/60 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] shrink-0">
          {['schedule', 'leaves'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-[13px] font-semibold capitalize transition-colors ${tab === t ? 'text-[#00e5b0] border-b-2 border-[#00e5b0]' : 'text-white/30 hover:text-white/60'}`}>
              {t === 'schedule' ? 'Weekly Schedule' : 'Leaves & Exceptions'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── SCHEDULE TAB ── */}
          {tab === 'schedule' && (
            <>
              {loadingSch ? (
                <p className="text-white/20 text-sm">Loading…</p>
              ) : (
                schedule.map((row, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white font-medium text-[13px]">{DAYS[i]}</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className={`w-9 h-5 rounded-full transition-colors relative ${row.is_working ? 'bg-[#00e5b0]' : 'bg-white/10'}`}
                          onClick={() => setSchDay(i, 'is_working', !row.is_working)}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${row.is_working ? 'left-4' : 'left-0.5'}`} />
                        </div>
                        <span className="text-white/40 text-[12px]">{row.is_working ? 'Working' : 'Day off'}</span>
                      </label>
                    </div>
                    {row.is_working && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-white/30 text-[11px] mb-1">Start</p>
                          <input type="time" className={inputCls} value={row.work_start || '09:00'}
                            onChange={e => setSchDay(i, 'work_start', e.target.value)} />
                        </div>
                        <div>
                          <p className="text-white/30 text-[11px] mb-1">End</p>
                          <input type="time" className={inputCls} value={row.work_end || '17:00'}
                            onChange={e => setSchDay(i, 'work_end', e.target.value)} />
                        </div>
                        <div>
                          <p className="text-white/30 text-[11px] mb-1">Break start (optional)</p>
                          <input type="time" className={inputCls} value={row.break_start || ''}
                            onChange={e => setSchDay(i, 'break_start', e.target.value || null)} />
                        </div>
                        <div>
                          <p className="text-white/30 text-[11px] mb-1">Break end (optional)</p>
                          <input type="time" className={inputCls} value={row.break_end || ''}
                            onChange={e => setSchDay(i, 'break_end', e.target.value || null)} />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}

          {/* ── LEAVES TAB ── */}
          {tab === 'leaves' && (
            <>
              <button onClick={() => setAddLeave(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-[#00e5b0]/30 text-[#00e5b0] text-[13px] font-medium hover:bg-[#00e5b0]/5 transition-colors">
                + Add Leave / Exception
              </button>

              {addLeave && (
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
                  <p className="text-white/70 text-[13px] font-medium">New Leave</p>
                  <div>
                    <p className="text-white/30 text-[11px] mb-1">Date *</p>
                    <input type="date" className={inputCls}
                      value={leaveForm.leave_date}
                      onChange={e => setLeaveForm(p => ({ ...p, leave_date: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={leaveForm.is_full_day}
                      onChange={e => setLeaveForm(p => ({ ...p, is_full_day: e.target.checked }))}
                      className="accent-[#00e5b0]" />
                    <span className="text-white/60 text-[13px]">Full day off</span>
                  </label>
                  {!leaveForm.is_full_day && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-white/30 text-[11px] mb-1">From</p>
                        <input type="time" className={inputCls}
                          value={leaveForm.leave_start}
                          onChange={e => setLeaveForm(p => ({ ...p, leave_start: e.target.value }))} />
                      </div>
                      <div>
                        <p className="text-white/30 text-[11px] mb-1">To</p>
                        <input type="time" className={inputCls}
                          value={leaveForm.leave_end}
                          onChange={e => setLeaveForm(p => ({ ...p, leave_end: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-white/30 text-[11px] mb-1">Reason (internal)</p>
                    <input type="text" className={inputCls} placeholder="Annual leave, Training…"
                      value={leaveForm.reason}
                      onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={submitLeave} disabled={saving}
                      className="flex-1 py-2 rounded-xl bg-[#00e5b0] text-[#0a1a1f] text-[13px] font-semibold hover:bg-[#00ffcc] transition-colors">
                      {saving ? 'Saving…' : 'Add Leave'}
                    </button>
                    <button onClick={() => setAddLeave(false)}
                      className="px-4 py-2 text-white/40 hover:text-white/70 text-[13px]">Cancel</button>
                  </div>
                </div>
              )}

              {loadingLv ? (
                <p className="text-white/20 text-sm">Loading…</p>
              ) : leaves.length === 0 ? (
                <p className="text-white/20 text-[13px] text-center py-6">No leaves scheduled</p>
              ) : (
                leaves.map(lv => (
                  <div key={lv.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-white text-[13px] font-medium">
                        {new Date(lv.leave_date + 'T00:00').toLocaleDateString('en-AE', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-white/35 text-[12px] mt-0.5">
                        {lv.is_full_day ? 'Full day' : `${lv.leave_start || ''} – ${lv.leave_end || ''}`}
                        {lv.reason ? ` · ${lv.reason}` : ''}
                      </p>
                    </div>
                    <button onClick={() => deleteLeave(lv.id)}
                      className="text-red-400/50 hover:text-red-400 transition-colors text-[12px]">Remove</button>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] shrink-0 flex items-center gap-3">
          {tab === 'schedule' && (
            <button onClick={saveSchedule} disabled={saving}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${saving ? 'bg-[#00e5b0]/30 text-white/40' : 'bg-[#00e5b0] text-[#0a1a1f] hover:bg-[#00ffcc]'}`}>
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
          )}
          {msg && <p className="text-[#00e5b0] text-[12px]">{msg}</p>}
        </div>
      </motion.div>
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const [doctors, setDoctors]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editDoc, setEditDoc]     = useState(null);   // null=closed, {}=new, {...}=edit
  const [manageDoc, setManageDoc] = useState(null);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${PROXY_BASE}?client_id=${CLIENT_ID}`, { headers: headers() });
      const d = await r.json();
      setDoctors(d.doctors || []);
    } catch { setDoctors([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadDoctors(); }, [loadDoctors]);

  async function handleDeactivate(id) {
    if (!confirm('Deactivate this doctor? They will no longer receive bookings.')) return;
    await fetch(`${PROXY_BASE}/${id}?client_id=${CLIENT_ID}`, { method: 'DELETE', headers: headers() });
    loadDoctors();
  }

  const activeDocs   = doctors.filter(d => d.is_active);
  const inactiveDocs = doctors.filter(d => !d.is_active);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-[1.4rem] font-extrabold text-white tracking-tight mb-1">Team</h1>
          <p className="text-[12.5px] text-white/35">
            {activeDocs.length === 0
              ? 'No doctors configured — bot uses the primary calendar.'
              : `${activeDocs.length} active doctor${activeDocs.length > 1 ? 's' : ''} · multi-doctor booking ${activeDocs.length > 1 ? 'enabled' : 'single-doctor mode'}`}
          </p>
        </div>
        <button onClick={() => setEditDoc({})}
          className="px-4 py-2.5 bg-[#00e5b0] text-[#0a1a1f] rounded-xl text-[13px] font-bold hover:bg-[#00ffcc] transition-colors">
          + Add Doctor
        </button>
      </div>

      {loading ? (
        <p className="text-white/20 text-sm">Loading…</p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {activeDocs.map(d => (
              <DoctorCard key={d.id} doctor={d}
                onEdit={setEditDoc} onManage={setManageDoc} onDeactivate={handleDeactivate} />
            ))}
          </AnimatePresence>

          {activeDocs.length === 0 && (
            <div className="text-center py-16 text-white/20">
              <p className="text-[14px]">No doctors added yet.</p>
              <p className="text-[12px] mt-1">The bot currently uses the primary calendar.</p>
            </div>
          )}

          {inactiveDocs.length > 0 && (
            <div className="mt-8">
              <p className="text-white/20 text-[11px] uppercase tracking-widest mb-3">Inactive</p>
              <div className="space-y-3 opacity-50">
                {inactiveDocs.map(d => (
                  <DoctorCard key={d.id} doctor={d} onEdit={setEditDoc} onManage={setManageDoc} onDeactivate={() => {}} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {editDoc !== null && (
          <DoctorModal doctor={editDoc?.id ? editDoc : null}
            onSave={() => { setEditDoc(null); loadDoctors(); }}
            onClose={() => setEditDoc(null)} />
        )}
        {manageDoc && (
          <ManagePanel doctor={manageDoc} onClose={() => setManageDoc(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
