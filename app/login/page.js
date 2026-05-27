'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

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
    <div className="min-h-screen bg-[#080808] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-[#00e5b0]/[0.055] blur-[140px]" />
      </div>

      <div
        className="relative z-10 w-full max-w-[400px] bg-white/[0.03] border border-white/[0.08] rounded-2xl p-10 backdrop-blur-sm"
        style={{ animation: 'fadeUp 0.5s ease both' }}
      >
        <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-9">
          <div className="w-8 h-8 rounded-lg bg-[#00e5b0]/10 border border-[#00e5b0]/25 flex items-center justify-center shrink-0">
            <span className="text-[#00e5b0] text-[13px] font-extrabold">T</span>
          </div>
          <span className="text-white font-extrabold text-[17px] tracking-tight">
            Tahsin<span className="text-[#00e5b0]">.</span>ai
          </span>
        </div>

        <h1 className="text-[1.7rem] font-extrabold text-white tracking-tight leading-tight mb-1.5">
          Welcome back
        </h1>
        <p className="text-white/35 text-[13.5px] mb-8">Sign in to your clinic dashboard</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 outline-none focus:border-[#00e5b0]/50 focus:bg-[#00e5b0]/[0.04] transition-all duration-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.1em] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-[14px] text-white placeholder-white/20 outline-none focus:border-[#00e5b0]/50 focus:bg-[#00e5b0]/[0.04] transition-all duration-200"
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
            className="w-full mt-2 bg-[#00e5b0] text-[#080808] font-bold py-3.5 rounded-xl text-[14px] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all duration-150"
          >
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>
      </div>
    </div>
  )
}
