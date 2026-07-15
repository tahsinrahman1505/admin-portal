/**
 * Demo seed data — powers the zero-login judge demo (demo.tahsinai.com).
 *
 * Gated entirely behind NEXT_PUBLIC_DEMO_MODE. This module is only ever imported
 * by lib/supabase.js (the mock client) and the /api/rag demo short-circuit, both
 * of which no-op unless demo mode is on. NOTHING here is real: fictional clinic,
 * fictional patients, fictional UAE numbers (all +971-5X-XXX-XXXX placeholders).
 * No production Supabase, no real PII. Showcase only.
 *
 * Timestamps are computed relative to load time so the data always reads "fresh."
 */

const HOUR = 3600 * 1000
const DAY = 24 * HOUR
const ago = (ms) => new Date(Date.now() - ms).toISOString()

// ── Identity (fictional) ─────────────────────────────────────────────────────
export const DEMO_CLIENT_ROW_ID = 'demo-client-0001'
export const DEMO_BOT_CLIENT_ID = 'demo_clinic'
export const DEMO_USER = {
  id: 'demo-user-0001',
  email: 'demo@tahsinai.com',
  user_metadata: { name: 'Demo Clinic Owner' },
  app_metadata: { provider: 'demo' },
  aud: 'authenticated',
  role: 'authenticated',
}
export const DEMO_SESSION = {
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor((Date.now() + 3600 * 1000) / 1000),
  user: DEMO_USER,
}

const CLINIC_NAME = 'Marina Smile Dental — Abu Dhabi'

// ── Threads (conversations table = per-turn message log) ─────────────────────
// Each thread → several conversation rows (role user/assistant), one channel.
const THREADS = [
  {
    sid: 'demo_clinic::971501234871', phone: '+971 50 123 4871', channel: 'whatsapp',
    lead_status: 'Converted', hoursAgo: 2,
    turns: [
      ['user', 'Hi, do you have any appointment tomorrow for teeth cleaning?'],
      ['assistant', 'Hello! 😊 Yes, we have openings tomorrow for a scaling & polishing session. We have 11:00 AM or 4:30 PM available. Which suits you better?'],
      ['user', '4:30 works'],
      ['assistant', 'Perfect. May I have your name to confirm the 4:30 PM slot with Dr. Leila?'],
      ['user', 'Omar Haddad'],
      ['assistant', 'Thank you, Omar! ✅ You\'re booked for teeth cleaning tomorrow at 4:30 PM with Dr. Leila Mansour. We\'ll send a reminder the morning of. See you then!'],
    ],
  },
  {
    sid: 'demo_clinic::971562318890', phone: '+971 56 231 8890', channel: 'whatsapp',
    lead_status: 'New', hoursAgo: 5,
    turns: [
      ['user', 'السلام عليكم، كم سعر تبييض الأسنان؟'],
      ['assistant', 'وعليكم السلام! 🦷 تبييض الأسنان بالليزر لدينا يبدأ من 1,200 درهم للجلسة الواحدة. تشمل فحص مجاني قبل الجلسة. هل تحب أحجز لك موعد استشارة؟'],
      ['user', 'نعم من فضلك'],
      ['assistant', 'ممتاز! متوفر لدينا الخميس الساعة 12 ظهراً أو السبت الساعة 5 مساءً. أي وقت يناسبك؟'],
    ],
  },
  {
    sid: 'demo_clinic::instagram_5521', phone: 'ig:layla.aesthetics', channel: 'instagram',
    lead_status: 'Called', hoursAgo: 8,
    turns: [
      ['user', 'saw your reel on veneers, how much for full set?'],
      ['assistant', 'Thanks for reaching out! ✨ Emax veneers are AED 1,800 per tooth, and we offer package pricing for a full smile makeover (8–10 veneers). Would you like a free consultation with photos so we can give you an exact quote?'],
      ['user', 'yes lets do it'],
      ['assistant', 'Wonderful! Could I get your name and preferred day? We have consultation slots this week.'],
      ['user', 'Fatima, maybe thursday'],
      ['assistant', 'Great, Fatima! Thursday works — 1:00 PM or 6:00 PM? I\'ll pencil you in with Dr. Karim, our cosmetic specialist.'],
    ],
  },
  {
    sid: 'demo_clinic::971558842013', phone: '+971 55 884 2013', channel: 'whatsapp',
    lead_status: 'New', hoursAgo: 20,
    turns: [
      ['user', 'my son has a toothache and cant sleep, can we come now?'],
      ['assistant', 'I\'m so sorry to hear that — a child in pain is always urgent. 🚨 We keep emergency slots open. Can you come to our Marina branch within the next hour? Please share your son\'s age and name so we can prepare.'],
      ['user', 'hes 7, name is Yousef, we can come in 30 min'],
      ['assistant', 'Understood. Dr. Leila will see Yousef as an emergency at your arrival — just tell reception you messaged ahead. In the meantime, a cold compress on the cheek can ease the pain. See you shortly. 💙'],
    ],
  },
  {
    sid: 'demo_clinic::messenger_3390', phone: 'fb:ahmed.k', channel: 'messenger',
    lead_status: 'Lost', hoursAgo: 34,
    turns: [
      ['user', 'do you take Daman insurance?'],
      ['assistant', 'Yes! We\'re empanelled with Daman (Enhanced & Thiqa) as well as Nextcare and AXA. Routine check-ups and cleanings are typically covered. Would you like me to check your specific plan and book you in?'],
      ['user', 'ok let me check with my wife and get back'],
      ['assistant', 'Of course, take your time! 😊 We\'re here whenever you\'re ready. Would you like me to hold a tentative slot this weekend just in case?'],
    ],
  },
  {
    sid: 'demo_clinic::971503392201', phone: '+971 50 339 2201', channel: 'whatsapp',
    lead_status: 'Converted', hoursAgo: 48,
    turns: [
      ['user', 'I need to reschedule my Saturday appointment'],
      ['assistant', 'No problem at all! I see your appointment with Dr. Karim on Saturday at 3:00 PM. What day/time would work better for you?'],
      ['user', 'monday same time?'],
      ['assistant', 'Monday at 3:00 PM is available. ✅ I\'ve moved your appointment — your Saturday slot is released and you\'re now confirmed for Monday 3:00 PM. Anything else I can help with?'],
      ['user', 'perfect thank you'],
      ['assistant', 'You\'re most welcome! See you Monday. 🦷✨'],
    ],
  },
  {
    sid: 'demo_clinic::971545567712', phone: '+971 54 556 7712', channel: 'whatsapp',
    lead_status: 'New', hoursAgo: 55, handoff: true,
    turns: [
      ['user', 'Do you do Invisalign? And how long does treatment take?'],
      ['assistant', 'Yes, we\'re a certified Invisalign provider! 😁 Treatment typically takes 6–18 months depending on your case. We start with a 3D scan (free during your consult) so you can preview your final smile. Shall I book you a consultation?'],
      ['user', 'Before that — can I speak to someone about the payment plans?'],
    ],
  },
  {
    sid: 'demo_clinic::instagram_7742', phone: 'ig:noor_j', channel: 'instagram',
    lead_status: 'Called', hoursAgo: 72,
    turns: [
      ['user', 'hello, are you open on fridays?'],
      ['assistant', 'Hi Noor! 🌙 Yes, we\'re open Fridays from 2:00 PM to 9:00 PM. Would you like to book something? We have availability this Friday.'],
      ['user', 'just a checkup'],
      ['assistant', 'A routine check-up it is! Friday at 2:30 PM or 7:00 PM — which do you prefer? And may I have your name to confirm?'],
    ],
  },
]

function buildConversations() {
  const rows = []
  let id = 1000
  for (const t of THREADS) {
    const base = t.hoursAgo * HOUR
    t.turns.forEach((turn, i) => {
      rows.push({
        id: id++,
        client_id: DEMO_CLIENT_ROW_ID,
        session_id: t.sid,
        phone_number: t.phone,
        channel: t.channel,
        role: turn[0],
        content: turn[1],
        lead_status: t.lead_status,
        // Mark a handed-off thread so the demo showcases the human-reply + AI-suggest flow.
        session_status: t.handoff ? 'Handed Off' : 'Handled by Bot',
        created_at: ago(base - i * 4 * 60 * 1000), // 4 min between turns
      })
    })
  }
  return rows
}

// ── Leads ────────────────────────────────────────────────────────────────────
const LEAD_NAMES = [
  ['Omar Haddad', 'Teeth cleaning', 'AED 300', 'Converted', 2],
  ['Fatima Al Zaabi', 'Veneers (full set)', 'AED 16,000', 'Called', 8],
  ['Yousef (child)', 'Emergency — toothache', 'AED 450', 'New', 20],
  ['Ahmed Karimi', 'Check-up (Daman)', 'AED 0 (insured)', 'Dead', 34],
  ['Layla Mansoori', 'Invisalign', 'AED 18,500', 'New', 55],
  ['Noor Jassim', 'Routine check-up', 'AED 250', 'Called', 72],
  ['Sara Al Marri', 'Teeth whitening', 'AED 1,200', 'Converted', 26],
  ['Khalid Rashed', 'Implant consultation', 'AED 6,500', 'New', 30],
  ['Mariam Saeed', 'Root canal', 'AED 2,200', 'Called', 44],
  ['Hassan Ali', 'Braces (metal)', 'AED 9,000', 'Converted', 60],
  ['Aisha Obaid', 'Scaling & polishing', 'AED 350', 'Converted', 12],
  ['Rashid Nuaimi', 'Wisdom tooth extraction', 'AED 1,800', 'New', 6],
  ['Huda Balushi', 'Veneers (2 teeth)', 'AED 3,600', 'Called', 90],
  ['Tariq Salem', 'Emergency — broken tooth', 'AED 900', 'Converted', 4],
  ['Nadia Farouk', 'Kids dentistry', 'AED 400', 'New', 15],
  ['Sultan Darwish', 'Gum treatment', 'AED 1,500', 'Dead', 120],
  ['Reem Al Hashimi', 'Smile makeover', 'AED 22,000', 'Called', 50],
  ['Faisal Omar', 'Teeth cleaning', 'AED 300', 'Converted', 38],
  ['Salma Idris', 'Whitening + check-up', 'AED 1,450', 'New', 9],
  ['Majid Kamal', 'Implant (single)', 'AED 7,000', 'Called', 100],
  ['Dana Suleiman', 'Invisalign', 'AED 18,500', 'New', 3],
  ['Yasir Ahmad', 'Crown', 'AED 2,800', 'Converted', 66],
  ['Lina Habib', 'Consultation', 'AED 200', 'Dead', 140],
  ['Adel Mubarak', 'Veneers (full set)', 'AED 15,000', 'New', 1],
]
function buildLeads() {
  return LEAD_NAMES.map((l, i) => ({
    id: `lead-${i + 1}`,
    client_id: DEMO_CLIENT_ROW_ID,
    name: l[0],
    phone: `+971 5${(i % 6) + 2} ${100 + i} ${4000 + i * 7}`,
    service_interest: l[1],
    budget: l[2],
    status: l[3],
    created_at: ago(l[4] * HOUR),
  }))
}

// ── Bookings ─────────────────────────────────────────────────────────────────
const BOOKINGS = [
  ['Omar Haddad', 'Teeth cleaning', 'Dr. Leila Mansour', 'confirmed', -1],
  ['Sara Al Marri', 'Teeth whitening', 'Dr. Karim Fadel', 'confirmed', -1],
  ['Tariq Salem', 'Emergency repair', 'Dr. Leila Mansour', 'confirmed', 0],
  ['Aisha Obaid', 'Scaling & polishing', 'Dr. Leila Mansour', 'confirmed', 1],
  ['Hassan Ali', 'Braces adjustment', 'Dr. Karim Fadel', 'confirmed', 1],
  ['Faisal Omar', 'Teeth cleaning', 'Dr. Leila Mansour', 'confirmed', 2],
  ['Yasir Ahmad', 'Crown fitting', 'Dr. Karim Fadel', 'confirmed', 2],
  ['Fatima Al Zaabi', 'Veneers consult', 'Dr. Karim Fadel', 'pending', 3],
  ['Reem Al Hashimi', 'Smile makeover consult', 'Dr. Karim Fadel', 'pending', 4],
  ['Dana Suleiman', 'Invisalign scan', 'Dr. Sara Habib', 'pending', 4],
  ['Mariam Saeed', 'Root canal', 'Dr. Omar Nassar', 'confirmed', 5],
  ['Rashid Nuaimi', 'Wisdom tooth extraction', 'Dr. Omar Nassar', 'confirmed', 6],
  ['Khalid Rashed', 'Implant consultation', 'Dr. Omar Nassar', 'pending', 7],
  ['Ahmed Karimi', 'Check-up', 'Dr. Leila Mansour', 'cancelled', -2],
  ['Sultan Darwish', 'Gum treatment', 'Dr. Sara Habib', 'cancelled', -3],
  ['Adel Mubarak', 'Veneers consult', 'Dr. Karim Fadel', 'confirmed', 3],
]
function buildBookings() {
  return BOOKINGS.map((b, i) => {
    const dayOffset = b[4]
    const when = new Date(Date.now() + dayOffset * DAY)
    when.setHours(9 + (i % 8), (i % 2) * 30, 0, 0)
    return {
      id: `booking-${i + 1}`,
      client_id: DEMO_CLIENT_ROW_ID,
      patient_name: b[0],
      service: b[1],
      doctor: b[2],
      doctor_name: b[2],
      status: b[3],
      start_time: when.toISOString(),
      appointment_time: when.toISOString(),
      created_at: ago((BOOKINGS.length - i) * 6 * HOUR),
    }
  })
}

// ── Doctors ──────────────────────────────────────────────────────────────────
const DOCTORS = [
  ['doc-1', 'Dr. Leila Mansour', 'General & Preventive Dentistry'],
  ['doc-2', 'Dr. Karim Fadel', 'Cosmetic Dentistry & Veneers'],
  ['doc-3', 'Dr. Omar Nassar', 'Oral Surgery & Implants'],
  ['doc-4', 'Dr. Sara Habib', 'Orthodontics & Invisalign'],
]
function buildDoctors() {
  return DOCTORS.map(d => ({
    id: d[0], client_id: DEMO_BOT_CLIENT_ID, name: d[1], specialty: d[2], active: true,
  }))
}

// ── Reviews ──────────────────────────────────────────────────────────────────
function buildReviews() {
  const ratings = [5, 5, 5, 4, 5, 5, 4, 5, 5, 5, 4, 5, 5, 5, 4, 5, 5, 3, 5, 5, 4, 5]
  return ratings.map((r, i) => ({
    id: `review-${i + 1}`, client_id: DEMO_CLIENT_ROW_ID, rating: r,
    created_at: ago(i * 12 * HOUR),
  }))
}

// ── Knowledge documents ──────────────────────────────────────────────────────
const KB_DOCS = [
  'Services & Pricing (2026)', 'Clinic Hours & Location', 'Insurance & Payment Plans',
  'Teeth Whitening FAQ', 'Invisalign Process Guide', 'Veneers & Smile Makeover',
  'Emergency Dental Care Policy', 'Kids Dentistry Guide', 'Post-Treatment Care Instructions',
]
function buildKnowledge() {
  return KB_DOCS.map((t, i) => ({
    id: `kb-${i + 1}`, client_id: DEMO_CLIENT_ROW_ID, title: t,
    filename: t.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.txt',
    chunk_count: 4 + (i % 6), created_at: ago((i + 1) * DAY),
  }))
}

// ── Notifications ────────────────────────────────────────────────────────────
function buildNotifications() {
  const items = [
    ['New booking', 'Omar Haddad booked Teeth cleaning for tomorrow 4:30 PM', 2],
    ['Human handoff requested', 'A patient on WhatsApp asked to speak to staff', 5],
    ['New lead', 'Fatima Al Zaabi — Veneers (full set), est. AED 16,000', 8],
    ['Emergency', 'Parent messaged about child toothache — bot flagged urgent', 20],
    ['Booking rescheduled', 'Patient moved Saturday appt → Monday 3:00 PM', 48],
    ['Review received', 'New 5★ review from a WhatsApp patient', 30],
  ]
  return items.map((n, i) => ({
    id: `notif-${i + 1}`, client_id: DEMO_CLIENT_ROW_ID, title: n[0], body: n[1],
    read: i > 2, created_at: ago(n[2] * HOUR),
  }))
}

// ── Sessions (handoff queue) ─────────────────────────────────────────────────
function buildSessions() {
  return [
    { session_id: 'demo_clinic::971558842013', state: 'handoff', channel: 'whatsapp', client_id: DEMO_BOT_CLIENT_ID },
  ]
}

// ── Channel configs ──────────────────────────────────────────────────────────
function buildChannelConfigs() {
  return [
    { id: 'ch-1', client_id: DEMO_BOT_CLIENT_ID, channel: 'whatsapp', enabled: true, display_name: CLINIC_NAME },
    { id: 'ch-2', client_id: DEMO_BOT_CLIENT_ID, channel: 'instagram', enabled: true, display_name: '@marinasmile.ad' },
    { id: 'ch-3', client_id: DEMO_BOT_CLIENT_ID, channel: 'messenger', enabled: true, display_name: 'Marina Smile Dental' },
  ]
}

// ── Client + config ──────────────────────────────────────────────────────────
function buildClients() {
  return [{
    id: DEMO_CLIENT_ROW_ID,
    client_name: CLINIC_NAME,
    bot_client_id: DEMO_BOT_CLIENT_ID,
    user_id: DEMO_USER.id,
  }]
}
function buildClientConfigs() {
  return [{
    id: 'cfg-1',
    client_id: DEMO_BOT_CLIENT_ID,
    portal_client_id: DEMO_CLIENT_ROW_ID,
    business_name: CLINIC_NAME,
    greeting: 'Hello! 👋 Welcome to Marina Smile Dental. How can we help you smile today?',
    system_prompt: 'You are Sara, the friendly assistant for Marina Smile Dental in Abu Dhabi. Help patients book appointments, answer questions about services and pricing, and reply in the patient\'s own language (English or Arabic).',
    language: 'auto',
    booking_enabled: true,
    voice_notes_enabled: true,
    timezone: 'Asia/Dubai',
  }]
}

// ── Table registry ───────────────────────────────────────────────────────────
const TABLES = {
  clients: buildClients,
  client_configs: buildClientConfigs,
  conversations: buildConversations,
  leads: buildLeads,
  pending_bookings: buildBookings,
  doctors: buildDoctors,
  reviews: buildReviews,
  knowledge_documents: buildKnowledge,
  notifications: buildNotifications,
  sessions: buildSessions,
  channel_configs: buildChannelConfigs,
  messages: () => [],
  message_delivery: () => [],
  push_subscriptions: () => [],
}

let _cache = null
function all() {
  if (_cache) return _cache
  _cache = {}
  for (const [name, fn] of Object.entries(TABLES)) _cache[name] = fn()
  return _cache
}

export function tableData(name) {
  const data = all()
  return data[name] ? [...data[name]] : []
}

// ── RAG endpoint demo responses (for /api/rag/* short-circuit) ───────────────
export function ragDemoResponse(pathname) {
  if (pathname.includes('/health')) return { status: 'ok', demo: true }
  if (pathname.includes('/doctors')) return { doctors: buildDoctors() }
  if (pathname.includes('/bookings/risk')) {
    const b = buildBookings()
    const confirmed = b.filter(x => x.status === 'confirmed').length
    return { at_risk: 2, no_show_rate: 0.06, upcoming: confirmed, revenue_at_risk_aed: 1400 }
  }
  if (pathname.includes('/session/summary')) {
    return { summary: 'Patient asked about pricing and availability; bot offered slots and captured booking intent.' }
  }
  if (pathname.includes('/session/suggest')) {
    return { suggestion: 'Of course! We offer flexible interest-free payment plans for Invisalign, usually spread over 6–12 months. I can have our treatment coordinator call you today to walk through the options — what time works best for you?' }
  }
  if (pathname.includes('/session/send') || pathname.includes('/session/resume') || pathname.includes('/session/send-media')) {
    return { status: 'sent', demo: true }
  }
  if (pathname.includes('/ingest')) return { status: 'ok', chunks: 5, demo: true }
  return { demo: true }
}
