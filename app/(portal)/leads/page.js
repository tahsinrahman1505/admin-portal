'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const STATUS_STYLES = {
  New:    'bg-blue-500/20 text-blue-300',
  Called: 'bg-amber-500/20 text-amber-300',
  Booked: 'bg-green-500/20 text-green-300',
  Dead:   'bg-white/5 text-white/30',
};

const ROW_STYLES = {
  New:    '',
  Called: '',
  Booked: '',
  Dead:   'opacity-50',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setLeads(data || []);
    setLoading(false);
  }

  async function updateStatus(id, newStatus) {
    // Optimistic update
    setLeads(prev =>
      prev.map(l => (l.id === id ? { ...l, status: newStatus } : l))
    );
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) {
      console.error(error);
      fetchLeads(); // revert on error
    }
  }

  function exportCSV() {
    const headers = ['Name', 'Phone', 'Service Interest', 'Budget', 'Date', 'Status'];
    const rows = leads.map(l => [
      l.name,
      l.phone,
      l.service_interest,
      l.budget,
      new Date(l.created_at).toLocaleDateString(),
      l.status,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-8 text-white/40">Loading leads…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Leads</h1>
          <p className="text-sm text-white/40 mt-1">{leads.length} total</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white/80 transition"
        >
          ↓ Export CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr>
              {['Name', 'Phone', 'Service Interest', 'Budget', 'Date', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {leads.map(lead => (
              <tr key={lead.id} className={`hover:bg-white/[0.03] transition-colors ${ROW_STYLES[lead.status] ?? ''}`}>
                <td className="px-4 py-3 font-medium text-white/90">{lead.name}</td>
                <td className="px-4 py-3 text-white/50">{lead.phone}</td>
                <td className="px-4 py-3 text-white/50">{lead.service_interest}</td>
                <td className="px-4 py-3 text-white/50">{lead.budget}</td>
                <td className="px-4 py-3 text-white/40">
                  {new Date(lead.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={e => updateStatus(lead.id, e.target.value)}
                    className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_STYLES[lead.status] ?? ''}`}
                    style={{ background: 'transparent' }}
                  >
                    {['New', 'Called', 'Booked', 'Dead'].map(s => (
                      <option key={s} value={s} style={{ background: '#1a1a1a', color: 'white' }}>{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-white/20">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
