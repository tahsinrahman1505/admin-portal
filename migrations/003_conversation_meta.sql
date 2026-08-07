-- ── 003 · Conversation triage: tags, priority, status, assignment ──────────
-- Powers the Phase 2 inbox restructure (see .team/engineering/plans/
-- admin-portal-restructure.md, "Phase 2 — Triage: tags, priority, status,
-- assignment"). Adds three new tables. Nothing existing is altered.
--
-- Run in the Supabase SQL editor, same as 001/002. Idempotent — every
-- statement uses IF NOT EXISTS so a partial or repeated run is safe.
--
-- Table order matters here: `staff` is created FIRST because
-- `conversation_meta.assignee_id` references it.

-- ── staff ────────────────────────────────────────────────────────────────────
-- Inbox staff — NOT `doctors` (clinicians with Google Calendars, a different
-- concept entirely; see the `doctors` table). This is deliberately assignment
-- LABELS, not real logins: user_id is nullable so a clinic can create "Sara" or
-- "Viktoriia" and assign conversations to her without a multi-user auth system.
-- Every account today still signs into the ONE clinic login (clients.user_id).
-- The nullable user_id column exists so real per-staff logins can be layered on
-- later without a migration, once that's actually wanted — this table doesn't
-- have to be re-shaped to support it.
create table if not exists public.staff (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,
  email      text,
  avatar_url text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.staff is
  'Inbox assignment labels for a clinic. user_id is nullable BY DESIGN — see the table comment in migrations/003_conversation_meta.sql. Not to be confused with `doctors` (clinicians with calendars).';

-- ── conversation_meta ────────────────────────────────────────────────────────
-- Portal-owned metadata about a conversation THREAD (not a message). Keyed by
-- session_id, which is '{bot_client_id}::{sender_id}' — the same key the bot's
-- `sessions` table uses, so a row here lines up 1:1 with a thread in the inbox.
--
-- Deliberately NOT columns on `sessions`: sessions is bot-owned runtime state
-- rewritten by rag_server.py on every turn (conversation_history, unknown_count,
-- dialect, ...). Writing portal fields there would mean the portal and the bot
-- race to update the same row, and would couple this feature's schema to the
-- bot's deploy cadence. A separate table the portal alone owns has neither
-- problem.
create table if not exists public.conversation_meta (
  session_id   text primary key,
  client_id    uuid not null references public.clients(id) on delete cascade,
  status       text not null default 'open'
                 check (status in ('open', 'pending', 'resolved')),
  priority     text
                 check (priority in ('urgent', 'high', 'medium', 'low')),
  assignee_id  uuid references public.staff(id) on delete set null,
  tags         text[] not null default '{}',
  resolved_at  timestamptz,
  updated_at   timestamptz not null default now()
);

comment on table public.conversation_meta is
  'Portal-owned triage state for an inbox thread (status/priority/assignee/tags). Keyed by session_id, the same key sessions/conversations use. One row per thread, created on first triage action, not on first message — see lib/inbox.js ensureMeta.';

-- ── client_tags ──────────────────────────────────────────────────────────────
-- Per-clinic tag catalogue, so tags are a controlled vocabulary (name + colour)
-- rather than free text that drifts into "vip"/"VIP"/"Vip" across a team.
create table if not exists public.client_tags (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  color      text not null default '#00e5b0',
  created_at timestamptz not null default now(),
  unique (client_id, name)
);

comment on table public.client_tags is
  'Per-clinic tag catalogue (name + colour). conversation_meta.tags stores tag NAMES, not foreign keys, so a clinic can free-type a new tag inline and it is added here on first use — see lib/inbox.js ensureTagExists.';

-- Indexes — status/assignee are the hot filter paths (the Mine/Open/Pending
-- segmented tabs), tags uses GIN for the array-containment queries the tag
-- filter runs (`tags @> ARRAY['vip']`).
create index if not exists staff_client_idx
  on public.staff (client_id);
create index if not exists conversation_meta_client_status_idx
  on public.conversation_meta (client_id, status);
create index if not exists conversation_meta_assignee_idx
  on public.conversation_meta (assignee_id);
create index if not exists conversation_meta_tags_gin_idx
  on public.conversation_meta using gin (tags);
create index if not exists client_tags_client_idx
  on public.client_tags (client_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Same pattern already in force on `conversations`/`leads`: a row is visible
-- only if its client_id belongs to a `clients` row owned by the logged-in user
-- (auth.uid()). The portal's browser client uses the anon key and talks to
-- these tables directly (same as it already does for conversations/sessions),
-- so RLS — not application code — is the enforcement boundary here. This is
-- the check that matters most: get it wrong and clinic A can read or edit
-- clinic B's patient triage data.

alter table public.staff              enable row level security;
alter table public.conversation_meta enable row level security;
alter table public.client_tags        enable row level security;

drop policy if exists staff_tenant_isolation on public.staff;
create policy staff_tenant_isolation on public.staff
  for all
  using (client_id in (select id from public.clients where user_id = auth.uid()))
  with check (client_id in (select id from public.clients where user_id = auth.uid()));

drop policy if exists conversation_meta_tenant_isolation on public.conversation_meta;
create policy conversation_meta_tenant_isolation on public.conversation_meta
  for all
  using (client_id in (select id from public.clients where user_id = auth.uid()))
  with check (client_id in (select id from public.clients where user_id = auth.uid()));

drop policy if exists client_tags_tenant_isolation on public.client_tags;
create policy client_tags_tenant_isolation on public.client_tags
  for all
  using (client_id in (select id from public.clients where user_id = auth.uid()))
  with check (client_id in (select id from public.clients where user_id = auth.uid()));
