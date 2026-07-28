-- ── 002 · WhatsApp Embedded Signup columns ──────────────────────────────────
-- Supports the self-serve "Connect WhatsApp" flow (Meta Embedded Signup) in
-- app/api/meta/whatsapp/connect/route.js. Mirrors the google_refresh_token /
-- google_email precedent already on this table for the Calendar connect flow.
--
-- phone_number_id and whatsapp_token already exist and get POPULATED by this
-- flow instead of being hand-typed via Graph API Explorer; this migration only
-- adds the two fields the flow needs that don't exist yet: the WABA id (so we
-- can call /subscribed_apps and know which account we're managing) and a
-- connected-at timestamp (drives the Channels page's Connected/Not Connected
-- state and is useful for support/debugging).
--
-- Run in the Supabase SQL editor.

alter table public.client_configs
  add column if not exists whatsapp_business_account_id text,
  add column if not exists whatsapp_connected_at timestamptz;
