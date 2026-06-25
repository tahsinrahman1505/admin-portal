'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? 'default';

export default function SettingsPage() {
  const [config, setConfig] = useState({
    business_name: '',
    bot_greeting: '',
    system_prompt: '',
    booking_enabled: true,
    lead_qualification_enabled: true,
    review_collection_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [gcalMsg, setGcalMsg] = useState(null);
  const [gcalBusy, setGcalBusy] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('client_configs').select('*').eq('client_id', CLIENT_ID).single();
      if (data) setConfig(data);
      setLoading(false);
    }
    load();
  }, []);

  // Surface the Google Calendar connect result after the OAuth redirect, then
  // clean the query string so a refresh doesn't re-show it.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const g = p.get('gcal');
    if (g === 'connected') {
      setGcalMsg({ ok: true, text: `Google Calendar connected${p.get('email') ? ' — ' + p.get('email') : ''}.` });
    } else if (g === 'error') {
      setGcalMsg({ ok: false, text: `Couldn't connect Google Calendar (${p.get('reason') || 'unknown'}). Please try again.` });
    }
    if (g) window.history.replaceState({}, '', '/settings');
  }, []);

  async function handleDisconnect() {
    if (!confirm('Disconnect Google Calendar? The bot will stop booking into it.')) return;
    setGcalBusy(true);
    try {
      await fetch('/api/google/disconnect', { method: 'POST' });
      setConfig(prev => ({ ...prev, google_email: null, google_refresh_token: null }));
      setGcalMsg({ ok: true, text: 'Google Calendar disconnected.' });
    } catch {
      setGcalMsg({ ok: false, text: 'Disconnect failed. Please try again.' });
    } finally {
      setGcalBusy(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from('client_configs').upsert({ ...config, client_id: CLIENT_ID });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else alert('Save failed: ' + error.message);
  }

  function set(field, value) { setConfig(prev => ({ ...prev, [field]: value })); }

  if (loading) return <div className="p-8 text-white/30 text-sm">Loading settings…</div>;

  const inputClass = "w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[13.5px] text-white placeholder-white/20 outline-none focus:border-[#00e5b0]/40 focus:bg-[#00e5b0]/[0.03] transition-all duration-200";

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-[1.4rem] font-extrabold text-white tracking-tight mb-1">Settings</h1>
      <p className="text-[12.5px] text-white/35 mb-8">Changes take effect on the next conversation.</p>

      <div className="space-y-5">
        {/* Business name */}
        <div>
          <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-2">Business name</label>
          <input type="text" value={config.business_name} onChange={e => set('business_name', e.target.value)} className={inputClass} />
        </div>

        {/* Bot greeting */}
        <div>
          <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-1">Bot opening greeting</label>
          <p className="text-[11.5px] text-white/25 mb-2">What the bot says on the very first message.</p>
          <textarea rows={3} value={config.bot_greeting} onChange={e => set('bot_greeting', e.target.value)} className={`${inputClass} resize-none`} />
        </div>

        {/* System prompt */}
        <div>
          <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-2">System prompt</label>
          <div className="flex items-start gap-2.5 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3 mb-3">
            <span className="text-amber-400 text-base mt-0.5">⚠</span>
            <p className="text-[12px] text-amber-300/80">
              <strong>Advanced — change carefully.</strong> This controls the bot&apos;s core behavior. Mistakes here can break conversations for all users.
            </p>
          </div>
          <textarea rows={8} value={config.system_prompt} onChange={e => set('system_prompt', e.target.value)} className={`${inputClass} font-mono text-[12px] resize-y`} />
        </div>

        {/* Toggles */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl divide-y divide-white/[0.05]">
          {[
            { key: 'booking_enabled',              label: 'Booking feature',         desc: 'Allow the bot to book appointments' },
            { key: 'lead_qualification_enabled',   label: 'Lead qualification flow', desc: 'Collect name, phone, service interest and budget' },
            { key: 'review_collection_enabled',    label: 'Review collection',       desc: 'Ask satisfied customers to leave a review' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-[13.5px] font-medium text-white/80">{label}</p>
                <p className="text-[12px] text-white/30 mt-0.5">{desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={config[key]}
                onClick={() => set(key, !config[key])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors outline-none ${
                  config[key] ? 'bg-[#00e5b0]' : 'bg-white/10'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${config[key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          ))}
        </div>

        {/* Google Calendar connect */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-white/80">Google Calendar</p>
              <p className="text-[12px] text-white/30 mt-0.5 truncate">
                {config.google_email
                  ? <>Connected as <span className="text-[#00e5b0]">{config.google_email}</span></>
                  : 'Connect so the bot books into your real calendar — and never double-books.'}
              </p>
            </div>
            {config.google_email ? (
              <button
                onClick={handleDisconnect}
                disabled={gcalBusy}
                className="shrink-0 px-4 py-2 text-[12.5px] font-semibold rounded-xl border border-white/[0.12] text-white/60 hover:text-white hover:border-white/25 transition disabled:opacity-50"
              >
                {gcalBusy ? '…' : 'Disconnect'}
              </button>
            ) : (
              <a
                href="/api/google/start"
                className="shrink-0 px-4 py-2 text-[12.5px] font-bold rounded-xl bg-[#00e5b0] text-[#080808] hover:brightness-110 active:scale-[0.98] transition whitespace-nowrap"
              >
                Connect Google Calendar
              </a>
            )}
          </div>
          {gcalMsg && (
            <p className={`mt-3 text-[12px] ${gcalMsg.ok ? 'text-[#00e5b0]' : 'text-amber-300/80'}`}>
              {gcalMsg.text}
            </p>
          )}
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#00e5b0] text-[#080808] text-[13.5px] font-bold rounded-xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all duration-150"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && (
            <span className="text-[13px] text-[#00e5b0] font-medium flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
