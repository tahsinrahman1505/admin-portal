'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import AuroraBackground from '../../components/AuroraBackground'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid credentials. Please try again.')
      setLoading(false)
    } else {
      // Store the actual Supabase access token (a cryptographically signed JWT)
      // in the session cookie so Edge middleware can verify it is a real token —
      // not a forgeable static string like "1". The token expires in 1h and is
      // refreshed automatically via onAuthStateChange in layout.js.
      const accessToken = data.session?.access_token || ''
      document.cookie = `sb-portal-session=${accessToken}; path=/; max-age=3600; SameSite=Lax; Secure`
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <AuroraBackground />

      <div
        className="glass-strong sheen relative z-10 w-full max-w-[410px] rounded-[var(--r-lg)] p-10"
        style={{ animation: 'fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(24px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }`}</style>

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-9">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'linear-gradient(135deg, rgba(0,229,176,0.24), rgba(124,92,255,0.2))', border: '1px solid rgba(0,229,176,0.32)', boxShadow: '0 0 24px rgba(0,229,176,0.22)' }}>
            <span className="text-[#00e5b0] text-[14px] font-extrabold">T</span>
          </div>
          <span className="text-[var(--ink-1)] font-extrabold text-[17px] tracking-tight">
            Tahsin<span className="text-[#00e5b0]">.</span>ai
          </span>
        </div>

        <h1 className="text-[1.85rem] font-extrabold text-[var(--ink-1)] tracking-tight leading-tight mb-1.5"
            style={{ textWrap: 'balance' }}>
          Welcome back
        </h1>
        <p className="text-[var(--ink-2)] text-[13.5px] mb-8">Sign in to your clinic dashboard</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-3)] uppercase tracking-[0.12em] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-3 text-[14px] text-[var(--ink-1)] placeholder-[var(--ink-4)] outline-none focus:border-[#00e5b0]/50 focus:bg-[#00e5b0]/[0.05] transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[var(--ink-3)] uppercase tracking-[0.12em] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-white/[0.05] border border-white/[0.09] rounded-xl px-4 py-3 text-[14px] text-[var(--ink-1)] placeholder-[var(--ink-4)] outline-none focus:border-[#00e5b0]/50 focus:bg-[#00e5b0]/[0.05] transition-all duration-200"
            />
          </div>

          {error && (
            <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3 text-[13px] text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="group relative w-full mt-2 overflow-hidden text-[#04110d] font-bold py-3.5 rounded-xl text-[14px] active:scale-[0.98] disabled:opacity-50 transition-all duration-200"
            style={{ background: 'linear-gradient(135deg, #00e5b0, #22d3ee)', boxShadow: '0 8px 30px rgba(0,229,176,0.28)' }}
          >
            <span className="relative z-10">{loading ? 'Signing in…' : 'Sign in →'}</span>
            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #22d3ee, #7c5cff)' }} />
          </button>
        </form>
      </div>
    </div>
  )
}
