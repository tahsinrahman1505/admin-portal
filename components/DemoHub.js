'use client'

import Link from 'next/link'

const WEBSITE = 'https://www.tahsinai.com'
// Video link is TBD (marketing to supply). Falls back to the website demo page
// so the card never dead-ends. Swap DEMO_VIDEO_URL when the reel is ready.
const DEMO_VIDEO_URL = `${WEBSITE}/demo`

// Judges can message the LIVE production bot themselves — "Maya", the assistant for
// the Marina Smile Dental demo clinic, on WhatsApp Cloud API (+971 50 370 9820).
const WA_TRY = `https://wa.me/971503709820?text=${encodeURIComponent(
  "Hi! 👋 I'd like to try the Tahsin AI dental assistant.",
)}`

function SmileyMark({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="46" height="46" rx="11" fill="url(#hubGrad)" />
      <circle cx="16.5" cy="18.5" r="4" fill="white" />
      <circle cx="29.5" cy="18.5" r="4" fill="#00e5b0" />
      <path d="M11 28 Q23 39 35 28" stroke="white" strokeWidth="3.6" strokeLinecap="round" fill="none" />
      <defs>
        <linearGradient id="hubGrad" x1="23" y1="0" x2="23" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1a6348" />
          <stop offset="100%" stopColor="#083020" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const CARDS = [
  {
    href: '/dashboard',
    internal: true,
    eyebrow: 'Clinic dashboard',
    title: 'Explore the clinic dashboard',
    desc: 'The web portal a clinic owner uses — conversations inbox, leads, bookings, analytics, and the AI knowledge base. Seeded with a live-looking Abu Dhabi dental clinic.',
    cta: 'Open the dashboard',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    ),
  },
  {
    href: '/mobile',
    internal: true,
    eyebrow: 'Mobile app',
    title: 'Try the mobile app',
    desc: 'The clinic-owner companion app — live inbox, human takeover of any AI conversation, and push alerts. Shown here in an in-browser phone frame, no install needed.',
    cta: 'Open the mobile view',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    ),
  },
  {
    href: DEMO_VIDEO_URL,
    internal: false,
    eyebrow: 'Product walkthrough',
    title: 'Watch the demo',
    desc: 'A 2-minute walkthrough of a real patient conversation — booking on WhatsApp in Arabic and English, 24/7, answered in seconds.',
    cta: 'Watch the walkthrough',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
    ),
  },
]

function Card({ card }) {
  const inner = (
    <div className="group relative h-full flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition-all duration-200 hover:border-[#00e5b0]/30 hover:bg-white/[0.04]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00e5b0]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#00e5b0]/10 text-[#00e5b0]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6">{card.icon}</svg>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#00e5b0]/70">{card.eyebrow}</p>
      <h3 className="mt-1 text-[1.15rem] font-bold text-white">{card.title}</h3>
      <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-white/50">{card.desc}</p>
      <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#00e5b0]">
        {card.cta}
        <span className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden>→</span>
      </span>
    </div>
  )
  return card.internal
    ? <Link href={card.href} className="block h-full">{inner}</Link>
    : <a href={card.href} target="_blank" rel="noopener noreferrer" className="block h-full">{inner}</a>
}

export default function DemoHub() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#00e5b0]/[0.06] blur-[130px]" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-14">
        {/* header */}
        <header className="flex items-center gap-3">
          <SmileyMark />
          <div>
            <p className="text-[1.15rem] font-extrabold tracking-tight text-white">
              Tahsin<span className="text-[#00e5b0]">.</span>ai
            </p>
            <p className="text-[12px] text-white/40">Patient Operations OS for UAE clinics</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#00e5b0]/20 bg-[#00e5b0]/[0.07] px-3 py-1.5 text-[11.5px] font-medium text-[#00e5b0]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00e5b0]" /> Live demo
          </span>
        </header>

        {/* hero */}
        <div className="mt-16 max-w-2xl">
          <h1 className="text-[2.4rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[3rem]">
            See Tahsin.ai run a clinic —<br />
            <span className="text-[#00e5b0]">end to end.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/55">
            This is a hands-on demo for the AIMED × Burjeel judges. Explore the clinic dashboard,
            open the mobile app, and — best of all — message the live AI yourself on WhatsApp.
          </p>
        </div>

        {/* Primary CTA: try the LIVE production bot on WhatsApp */}
        <a
          href={WA_TRY}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-10 flex flex-col gap-4 rounded-2xl border border-[#25D366]/30 bg-gradient-to-br from-[#25D366]/[0.12] to-[#00e5b0]/[0.05] p-6 transition-all duration-200 hover:border-[#25D366]/50 sm:flex-row sm:items-center"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#25D366]">Try it live · no seed data</p>
            <h3 className="mt-0.5 text-[1.15rem] font-bold text-white">Message the real AI on WhatsApp, right now</h3>
            <p className="mt-1 text-[13.5px] leading-relaxed text-white/55">
              Chat with <span className="text-white/80">Maya</span> — the live production assistant for our demo clinic
              (Marina Smile Dental, Abu Dhabi). Ask about services and prices, or book an appointment, in English or Arabic.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#25D366] px-5 py-3 text-[14px] font-bold text-[#062b16] transition-transform duration-200 group-hover:translate-x-0.5 sm:self-center">
            Open WhatsApp
            <span aria-hidden>→</span>
          </span>
        </a>

        {/* cards */}
        <div className="mt-12 grid flex-1 grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => <Card key={c.title} card={c} />)}
        </div>

        {/* honesty footer */}
        <footer className="mt-14 border-t border-white/[0.06] pt-6">
          <p className="text-[12px] leading-relaxed text-white/35">
            This is a <span className="text-white/55">seeded demonstration environment</span> — the clinic,
            patients, and conversations are realistic sample data, not real people. The live production system
            runs on WhatsApp, Instagram &amp; Messenger with real clinics.{' '}
            <a href={WEBSITE} target="_blank" rel="noopener noreferrer" className="text-[#00e5b0]/70 hover:text-[#00e5b0]">
              tahsinai.com →
            </a>
          </p>
        </footer>
      </div>
    </main>
  )
}
