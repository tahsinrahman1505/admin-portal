# Session Notes — 2026-05-15

## Live URL
> **Vercel:** https://admin-portal-xi-two.vercel.app/login

---

## What We Built Today

### 1. Leads Page — `app/(portal)/leads/page.js`
A full lead management table connected to Supabase.

- Fetches all leads from the `leads` table, ordered newest first
- Displays: Name, Phone, Service Interest, Budget, Date, Status
- **Status dropdown** with optimistic UI update (auto-reverts on error)
- **Color-coded status badges:** New (blue), Called (amber), Booked (green), Dead (gray/faded)
- **Export CSV** button — downloads a dated `.csv` of all leads
- Fully dark-themed to match the portal layout

### 2. Settings Page — `app/(portal)/settings/page.js`
A config panel that reads/writes to the `client_configs` Supabase table.

- Fields: Business name, Bot opening greeting, System prompt
- **3 feature toggles:** Booking, Lead qualification, Review collection
- Upsert save with "✓ Saved" confirmation
- Dark-themed inputs (`bg-white/5`, `border-white/10`, `text-white`)
- Warning banner on system prompt field (amber, dark style)

---

## Files Changed

| File | Action |
|------|--------|
| `app/(portal)/leads/page.js` | Created |
| `app/(portal)/settings/page.js` | Created |
| `.env.local` | Copied from project root into worktree |

---

## Supabase Tables Used

| Table | Purpose |
|-------|---------|
| `leads` | Read all leads, update status |
| `client_configs` | Read + upsert bot config by `client_id` |

---

## Environment Variables Required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_CLIENT_ID        # defaults to 'default' if not set
```

---

## Dev Server
- Running on **http://localhost:3001** (port 3000 was occupied)
- `.next` cache was cleared and server restarted fresh

---

## Next Steps
- [ ] Build `app/(portal)/bookings/page.js`
- [ ] Connect Settings page to n8n / AI automation webhook
- [ ] Set `NEXT_PUBLIC_CLIENT_ID` in `.env.local` for multi-tenant support
- [ ] Consider real-time Supabase subscriptions on the leads table
