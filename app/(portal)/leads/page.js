'use client';
import { useEffect, useState } from 'react';
// Use the shared client from lib/supabase.js, never a local createClient().
// The shared module is demo-aware: under NEXT_PUBLIC_DEMO_MODE it swaps in the
// in-memory mock. Building a client here bypassed that entirely, so on the demo
// deployment this page tried to reach the placeholder URL and died on a CSP
// connect-src violation — the page rendered empty for every visitor. It also
// created a second GoTrue client in the same tab, which supabase-js warns about.
import { supabase } from '@/lib/supabase';
import { TableSkeleton } from '@/components/Skeleton';

const STATUS_STYLES = {
  New:    'bg-[#00e5b0]/10 text-[#00e5b0]',
  Called: 'bg-amber-500/15 text-amber-300',
  Booked: 'bg-emerald-500/15 text-emerald-400',
  Dead:   'bg-white/5 text-white/25',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchLeads() {
    const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (!error) setLeads(data || []);
    setLoading(false);
  }

  // Wrapped in an inline IIFE, same pattern as the channels page's `init()` —
  // keeps the effect body itself from calling setState synchronously.
  useEffect(() => { (async () => { await fetchLeads(); })(); }, []);

  async function updateStatus(id, newStatus) {
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status: newStatus } : l)));
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', id);
    if (error) { console.error(error); fetchLeads(); }
  }

  function exportCSV() {
    const headers = ['Name', 'Phone', 'Service Interest', 'Budget', 'Date', 'Status'];
    const rows = leads.map(l => [l.name, l.phone, l.service_interest, l.budget, new Date(l.created_at).toLocaleDateString(), l.status]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <TableSkeleton />;

  return (
    <div className="p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[1.4rem] font-extrabold text-white tracking-tight">Leads</h1>
          <p className="text-[12.5px] text-white/35 mt-0.5">{leads.length} total</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[13px] font-medium text-white/50 hover:bg-[#00e5b0]/[0.07] hover:text-[#00e5b0] hover:border-[#00e5b0]/25 transition-all duration-150"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto glass sheen rounded-[var(--r-md)] relative">
        <table className="w-full text-[13px]">
          <thead className="border-b border-white/[0.07]">
            <tr>
              {['Name', 'Phone', 'Service Interest', 'Budget', 'Date', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-white/25 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {leads.map(lead => (
              <tr key={lead.id} className={`hover:bg-white/[0.025] transition-colors ${lead.status === 'Dead' ? 'opacity-45' : ''}`}>
                <td className="px-4 py-3 font-medium text-white/90">{lead.name}</td>
                <td className="px-4 py-3 text-white/45">{lead.phone}</td>
                <td className="px-4 py-3 text-white/45">{lead.service_interest}</td>
                <td className="px-4 py-3 text-white/45">{lead.budget}</td>
                <td className="px-4 py-3 text-white/30">{new Date(lead.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={e => updateStatus(lead.id, e.target.value)}
                    className={`text-[11.5px] font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer ${STATUS_STYLES[lead.status] ?? ''}`}
                    style={{ background: 'transparent' }}
                  >
                    {['New', 'Called', 'Booked', 'Dead'].map(s => (
                      <option key={s} value={s} style={{ background: '#111', color: 'white' }}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-14 text-center text-white/15">No leads yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
