'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function DashboardPage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [loading, setLoading] = useState(true)
  const [clientName, setClientName] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: clientRow } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('user_id', user.id)
        .single()

      if (!clientRow) { console.error('No client record found'); return }

      setClientName(clientRow.client_name || 'Client')
      const clientId = clientRow.id

      const [
        { count: totalConversations },
        { count: leadsCount },
        { count: appointmentsCount },
        { data: reviewsData }
      ] = await Promise.all([
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('leads').select('*', { count: 'exact', head: true }).eq('client_id', clientId),
        supabase.from('pending_bookings').select('*', { count: 'exact', head: true }).eq('client_id', clientId).eq('status', 'confirmed'),
        supabase.from('reviews').select('rating').eq('client_id', clientId)
      ])

      const avgRating = reviewsData?.length > 0
        ? (reviewsData.reduce((s, r) => s + r.rating, 0) / reviewsData.length).toFixed(1)
        : 'N/A'

      setMetrics({ totalConversations: totalConversations ?? 0, leadsCount: leadsCount ?? 0, appointmentsCount: appointmentsCount ?? 0, avgRating })
      setLastUpdated(new Date().toLocaleTimeString())
      setLoading(false)
    }
    init()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const cards = metrics ? [
    { label: 'Total Conversations', value: metrics.totalConversations, icon: '💬', change: '+12%', color: '#4f6ef7' },
    { label: 'Leads Captured', value: metrics.leadsCount, icon: '🎯', change: '+8%', color: '#10b981' },
    { label: 'Appointments Booked', value: metrics.appointmentsCount, icon: '📅', change: '+5%', color: '#f59e0b' },
    { label: 'Avg Rating', value: metrics.avgRating, icon: '⭐', change: '+0.2', color: '#ec4899' },
  ] : []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0a0f; }

        .dash-root {
          min-height: 100vh;
          background: #0a0a0f;
          font-family: 'DM Sans', sans-serif;
          color: #fff;
          position: relative;
          overflow-x: hidden;
        }
        .bg-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(140px);
          opacity: 0.08;
          pointer-events: none;
          z-index: 0;
        }
        .orb1 { width: 800px; height: 800px; background: #4f6ef7; top: -300px; left: -200px; }
        .orb2 { width: 500px; height: 500px; background: #10b981; bottom: -100px; right: -100px; }

        /* Sidebar */
        .sidebar {
          position: fixed;
          left: 0; top: 0; bottom: 0;
          width: 220px;
          background: rgba(255,255,255,0.02);
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 32px 20px;
          z-index: 100;
          display: flex;
          flex-direction: column;
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 48px;
          padding: 0 8px;
        }
        .brand-dot {
          width: 10px; height: 10px;
          background: #4f6ef7;
          border-radius: 50%;
          box-shadow: 0 0 12px #4f6ef7;
          flex-shrink: 0;
        }
        .brand-name {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 14px;
          color: rgba(255,255,255,0.6);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .nav-label {
          font-size: 10px;
          font-weight: 500;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 0 8px;
          margin-bottom: 8px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 14px;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          transition: all 0.15s;
          margin-bottom: 2px;
          text-decoration: none;
        }
        .nav-item:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.8); }
        .nav-item.active { background: rgba(79,110,247,0.12); color: #4f6ef7; }
        .nav-icon { font-size: 16px; }
        .sidebar-bottom { margin-top: auto; }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 14px;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          transition: all 0.15s;
          background: none;
          border: none;
          font-family: 'DM Sans', sans-serif;
          width: 100%;
        }
        .logout-btn:hover { background: rgba(239,68,68,0.08); color: #f87171; }

        /* Main content */
        .main {
          margin-left: 220px;
          padding: 40px 48px;
          position: relative;
          z-index: 1;
        }

        /* Header */
        .header { margin-bottom: 40px; animation: fadeUp 0.5s ease both; }
        .header-greeting {
          font-size: 13px;
          color: rgba(255,255,255,0.3);
          margin-bottom: 6px;
          letter-spacing: 0.04em;
        }
        .header-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px;
          font-weight: 800;
          color: #fff;
        }
        .header-title span { color: #4f6ef7; }

        /* Stats bar */
        .stats-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }
        .live-dot {
          width: 6px; height: 6px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 6px #10b981;
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .live-text { font-size: 12px; color: rgba(255,255,255,0.3); }

        /* Cards grid */
        .cards-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }

        .metric-card {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 28px 24px;
          position: relative;
          overflow: hidden;
          transition: transform 0.2s, border-color 0.2s;
          animation: fadeUp 0.5s ease both;
        }
        .metric-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,0.14); }
        .metric-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent), transparent);
          opacity: 0.6;
        }
        .metric-card:nth-child(1) { animation-delay: 0.1s; }
        .metric-card:nth-child(2) { animation-delay: 0.2s; }
        .metric-card:nth-child(3) { animation-delay: 0.3s; }
        .metric-card:nth-child(4) { animation-delay: 0.4s; }

        .card-icon {
          font-size: 22px;
          margin-bottom: 20px;
          display: block;
        }
        .card-value {
          font-family: 'Syne', sans-serif;
          font-size: 40px;
          font-weight: 800;
          color: #fff;
          line-height: 1;
          margin-bottom: 8px;
        }
        .card-label {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          margin-bottom: 16px;
        }
        .card-change {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #10b981;
          background: rgba(16,185,129,0.1);
          border-radius: 20px;
          padding: 3px 10px;
        }

        /* Bottom section */
        .bottom-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          animation: fadeUp 0.5s 0.5s ease both;
        }
        .panel {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 20px;
          padding: 28px;
        }
        .panel-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: rgba(255,255,255,0.7);
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .activity-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .activity-item:last-child { border-bottom: none; }
        .activity-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .activity-text { font-size: 13px; color: rgba(255,255,255,0.5); flex: 1; }
        .activity-time { font-size: 11px; color: rgba(255,255,255,0.2); }

        .score-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .score-label { font-size: 13px; color: rgba(255,255,255,0.4); }
        .score-bar-wrap {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.06);
          border-radius: 4px;
          margin: 0 16px;
          overflow: hidden;
        }
        .score-bar { height: 100%; border-radius: 4px; }
        .score-val { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.6); min-width: 24px; text-align: right; }

        .timestamp {
          margin-top: 32px;
          font-size: 12px;
          color: rgba(255,255,255,0.18);
          display: flex;
          align-items: center;
          gap: 6px;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .loading-screen {
          min-height: 100vh;
          background: #0a0a0f;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'DM Sans', sans-serif;
        }
        .loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .loader-dots {
          display: flex;
          gap: 6px;
        }
        .loader-dot {
          width: 8px; height: 8px;
          background: #4f6ef7;
          border-radius: 50%;
          animation: bounce 1.2s infinite;
        }
        .loader-dot:nth-child(2) { animation-delay: 0.2s; }
        .loader-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        .loader-text { font-size: 13px; color: rgba(255,255,255,0.3); }
      `}</style>

      {loading ? (
        <div className="loading-screen">
          <div className="loader">
            <div className="loader-dots">
              <div className="loader-dot" />
              <div className="loader-dot" />
              <div className="loader-dot" />
            </div>
            <span className="loader-text">Loading your dashboard...</span>
          </div>
        </div>
      ) : (
        <div className="dash-root">
          <div className="bg-orb orb1" />
          <div className="bg-orb orb2" />

          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-brand">
              <div className="brand-dot" />
              <span className="brand-name">Dental Portal</span>
            </div>
            <div className="nav-label">Menu</div>
            <a className="nav-item active"><span className="nav-icon">▣</span> Dashboard</a>
            <a className="nav-item"><span className="nav-icon">💬</span> Conversations</a>
            <a className="nav-item"><span className="nav-icon">🎯</span> Leads</a>
            <a className="nav-item"><span className="nav-icon">📅</span> Bookings</a>
            <a className="nav-item"><span className="nav-icon">⚙️</span> Settings</a>
            <div className="sidebar-bottom">
              <button className="logout-btn" onClick={handleLogout}>
                <span>↩</span> Sign out
              </button>
            </div>
          </aside>

          {/* Main */}
          <main className="main">
            <div className="header">
              <p className="header-greeting">Good morning 👋</p>
              <h1 className="header-title">
                <span>{clientName}</span> Dashboard
              </h1>
              <div className="stats-bar">
                <div className="live-dot" />
                <span className="live-text">Live data · Last updated {lastUpdated}</span>
              </div>
            </div>

            {/* Metric Cards */}
            <div className="cards-grid">
              {cards.map((card) => (
                <div
                  key={card.label}
                  className="metric-card"
                  style={{ '--accent': card.color }}
                >
                  <span className="card-icon">{card.icon}</span>
                  <div className="card-value">{card.value}</div>
                  <div className="card-label">{card.label}</div>
                  <span className="card-change">↑ {card.change} this week</span>
                </div>
              ))}
            </div>

            {/* Bottom panels */}
            <div className="bottom-grid">
              <div className="panel">
                <div className="panel-title">⚡ Recent Activity</div>
                {[
                  { text: 'New conversation started', time: '2m ago', color: '#4f6ef7' },
                  { text: 'Lead captured — Ahmed Rahman', time: '14m ago', color: '#10b981' },
                  { text: 'Appointment confirmed', time: '1h ago', color: '#f59e0b' },
                  { text: 'New 5★ review received', time: '3h ago', color: '#ec4899' },
                ].map((item, i) => (
                  <div className="activity-item" key={i}>
                    <div className="activity-dot" style={{ background: item.color }} />
                    <span className="activity-text">{item.text}</span>
                    <span className="activity-time">{item.time}</span>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="panel-title">📊 Performance Score</div>
                {[
                  { label: 'Response Rate', val: 94, color: '#4f6ef7' },
                  { label: 'Lead Conversion', val: 68, color: '#10b981' },
                  { label: 'Booking Rate', val: 75, color: '#f59e0b' },
                  { label: 'Customer Satisfaction', val: 90, color: '#ec4899' },
                ].map((s) => (
                  <div className="score-row" key={s.label}>
                    <span className="score-label">{s.label}</span>
                    <div className="score-bar-wrap">
                      <div className="score-bar" style={{ width: `${s.val}%`, background: s.color }} />
                    </div>
                    <span className="score-val">{s.val}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="timestamp">
              <span>◎</span> Dashboard refreshes automatically on each login
            </div>
          </main>
        </div>
      )}
    </>
  )
}