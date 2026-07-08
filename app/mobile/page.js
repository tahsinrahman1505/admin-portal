'use client'

import Link from 'next/link'
import { useState } from 'react'

// Phone-framed view of the clinic-owner companion app. In this showcase build we
// frame the live inbox (the app's core surface — conversations + human takeover)
// at phone width, so judges see the real screens with no install. Spec option (b).
const SCREENS = [
  { href: '/conversations', label: 'Inbox' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/bookings', label: 'Bookings' },
]

export default function MobilePreview() {
  const [screen, setScreen] = useState(SCREENS[0].href)

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#00e5b0]/[0.06] blur-[130px]" />

      <div className="relative mx-auto flex min-h-screen max-w-4xl flex-col items-center px-6 py-10">
        <div className="flex w-full items-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white/90 transition-colors">
            <span aria-hidden>←</span> Back to demo hub
          </Link>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#00e5b0]/20 bg-[#00e5b0]/[0.07] px-3 py-1.5 text-[11.5px] font-medium text-[#00e5b0]">
            Companion app
          </span>
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-[1.6rem] font-extrabold tracking-tight text-white">The clinic on your phone</h1>
          <p className="mt-2 max-w-md text-[13.5px] text-white/50">
            Live inbox, one-tap human takeover of any AI conversation, and push alerts when a patient needs you.
          </p>
        </div>

        {/* screen switcher */}
        <div className="mt-6 inline-flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {SCREENS.map((s) => (
            <button
              key={s.href}
              onClick={() => setScreen(s.href)}
              className={`rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-colors ${
                screen === s.href ? 'bg-[#00e5b0] text-[#062018]' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* phone frame */}
        <div className="mt-8 mb-10">
          <div className="relative rounded-[2.5rem] border-[10px] border-[#1a1a1a] bg-[#1a1a1a] shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <div className="absolute left-1/2 top-2.5 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-[#1a1a1a]" />
            <div className="overflow-hidden rounded-[1.9rem] bg-[#080808]" style={{ width: 380, height: 800 }}>
              <iframe
                key={screen}
                src={screen}
                title="Tahsin.ai companion app"
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
