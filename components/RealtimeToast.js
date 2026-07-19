'use client'
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'

let _toastCounter = 0
function uniqueId() { return `toast_${Date.now()}_${++_toastCounter}` }

function maskPhone(phone) {
  if (!phone) return 'Unknown'
  const s = phone.replace(/\D/g, '')
  return '+' + s.slice(0, 3) + ' ***' + s.slice(-3)
}

export default function RealtimeToast() {
  const [toasts, setToasts] = useState([])
  const clientIdRef = useRef(null)
  // Track which session IDs have already fired a toast recently to avoid snapshot floods
  const recentRef = useRef(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('clients').select('id').eq('user_id', user.id).single()
      if (data) clientIdRef.current = data.id
    })

    const channel = supabase
      .channel('realtime-conversations-toast')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
      }, (payload) => {
        const row = payload.new
        if (clientIdRef.current && row.client_id !== clientIdRef.current) return
        if (row.role !== 'customer') return

        // Debounce: only one toast per session per 8 seconds (prevents snapshot floods)
        const sid = row.session_id
        if (recentRef.current.has(sid)) return
        recentRef.current.add(sid)
        setTimeout(() => recentRef.current.delete(sid), 8000)

        const id = uniqueId()
        setToasts(prev => [...prev.slice(-2), { id, phone: row.phone_number || 'Unknown', message: row.message || '' }])
        setTimeout(() => dismiss(id), 6000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  function dismiss(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2.5 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-start gap-3 bg-[var(--surface-raised)]/95 backdrop-blur-xl border border-[#00e5b0]/20 rounded-2xl px-4 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-[300px]"
          >
            {/* Icon */}
            <div className="relative shrink-0 mt-0.5">
              <span className="absolute inset-0 rounded-full bg-[#00e5b0] animate-ping opacity-30" />
              <div className="relative w-8 h-8 rounded-full bg-[#00e5b0]/10 border border-[#00e5b0]/25 flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#00e5b0]">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
            </div>
            {/* Text */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p className="text-[11px] font-semibold text-[#00e5b0] uppercase tracking-wider">New Message</p>
                <button
                  onClick={() => dismiss(toast.id)}
                  className="text-white/30 hover:text-white/70 transition-colors shrink-0 -mr-1"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-[12.5px] font-medium text-white leading-snug">{maskPhone(toast.phone)}</p>
              <p className="text-[11.5px] text-white/40 mt-0.5 truncate max-w-[200px]">{toast.message}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
