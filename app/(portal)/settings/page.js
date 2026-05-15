'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Replace with however you identify the current client
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

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('client_configs')
        .select('*')
        .eq('client_id', CLIENT_ID)
        .single();
      if (data) setConfig(data);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('client_configs')
      .upsert({ ...config, client_id: CLIENT_ID });
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert('Save failed: ' + error.message);
    }
  }

  function set(field, value) {
    setConfig(prev => ({ ...prev, [field]: value }));
  }

  if (loading) return <div className="p-8 text-white/40">Loading settings…</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">Settings</h1>
      <p className="text-sm text-white/40 mb-8">Changes take effect on the next conversation.</p>

      <div className="space-y-6">
        {/* Business Name */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Business name</label>
          <input
            type="text"
            value={config.business_name}
            onChange={e => set('business_name', e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bot Greeting */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Bot opening greeting</label>
          <p className="text-xs text-white/30 mb-1">What the bot says on the very first message.</p>
          <textarea
            rows={3}
            value={config.bot_greeting}
            onChange={e => set('bot_greeting', e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* System Prompt */}
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">System prompt</label>
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-2">
            <span className="text-amber-400 text-sm mt-0.5">⚠</span>
            <p className="text-xs text-amber-300">
              <strong>Advanced — change carefully.</strong> This controls the bot's core behavior. Mistakes here can break conversations for all users.
            </p>
          </div>
          <textarea
            rows={8}
            value={config.system_prompt}
            onChange={e => set('system_prompt', e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
        </div>

        {/* Toggles */}
        <div className="border border-white/10 rounded-xl divide-y divide-white/5">
          {[
            { key: 'booking_enabled', label: 'Booking feature', desc: 'Allow the bot to book appointments' },
            { key: 'lead_qualification_enabled', label: 'Lead qualification flow', desc: 'Collect name, phone, service interest and budget' },
            { key: 'review_collection_enabled', label: 'Review collection', desc: 'Ask satisfied customers to leave a review' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px=4 py-3">
              <div>
                <p className="text-sm font-medium text-white/80">{label}</p>
                <p className="text-xs text-white/30">{desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={config[key]}
                onClick={() => set(key, !config[key])}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  config[key] ? 'bg-blue-600' : 'bg-white/10'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    config[key] ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-green-400 font-medium">✓ Saved</span>}
        </div>
      </div>
    </div>
  );
}
