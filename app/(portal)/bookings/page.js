'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const STATUS_STYLES = {
  confirmed: 'bg-green-500/20 text-green-300',
  pending:   'bg-amber-500/20 text-amber-300',
  cancelled: 'bg-red-500/20 text-red-300',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  async function fetchBookings() {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setBookings(data || []);
    setLoading(false);
  }

  if (loading) return <div className="p-8 text-white/40">Loading bookings…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Bookings</h1>
          <p className="text-sm text-white/40 mt-1">{bookings.length} total</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10">
            <tr>
              {['Name', 'Phone', 'Service', 'Date', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {bookings.map(b => (
              <tr key={b.id} className="hover:bg-white/[0.03] transition-colors">
                <td className="px-4 py-3 font-medium text-white/90">{b.name || '—'}</td>
                <td className="px-4 py-3 text-white/50">{b.phone || '—'}</td>
                <td className="px-4 py-3 text-white/50">{b.service || '—'}</td>
                <td className="px-4 py-3 text-white/40">
                  {new Date(b.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[b.status] ?? 'bg-white/5 text-white/30'}`}>
                    {b.status || 'pending'}
                  </span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-white/20">
                  No bookings yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
