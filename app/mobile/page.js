'use client'

import Link from 'next/link'
import MobileApp from '@/components/MobileApp'

// The clinic-owner companion app (products/mobile), reproduced as a web mobile
// experience for the zero-login judge demo — same screens & design system, seed
// data only, no backend. Rendered inside a phone frame.
export default function MobilePreview() {
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
          <h1 className="text-[1.6rem] font-extrabold tracking-tight text-white">The clinic in your pocket</h1>
          <p className="mt-2 max-w-md text-[13.5px] text-white/50">
            The real companion app — tap through Home, Inbox, Calendar and Patients. Open any conversation and use one-tap human takeover. No install, seeded data.
          </p>
        </div>

        {/* phone frame */}
        <div className="mt-8 mb-10">
          <div className="relative rounded-[2.6rem] border-[11px] border-[#161616] bg-[#161616] shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
            <div className="absolute left-1/2 top-2.5 z-10 h-5 w-28 -translate-x-1/2 rounded-full bg-[#161616]" />
            <div className="overflow-hidden rounded-[1.95rem] bg-black" style={{ width: 384, height: 812 }}>
              <MobileApp />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
