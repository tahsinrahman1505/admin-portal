-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create channel_configs table
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.channel_configs (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Which clinic this config belongs to
  client_id       bigint        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- 'whatsapp' | 'instagram' | 'messenger'
  channel         text          NOT NULL CHECK (channel IN ('whatsapp', 'instagram', 'messenger')),

  -- Master on/off switch for this channel
  enabled         boolean       NOT NULL DEFAULT false,

  -- Per-channel welcome message
  greeting        text          DEFAULT '',

  -- Delay before the bot replies (seconds, stored as text for the select widget)
  reply_delay     text          NOT NULL DEFAULT '0',

  -- Feature flags
  lead_capture    boolean       NOT NULL DEFAULT true,
  booking_flow    boolean       NOT NULL DEFAULT true,
  handoff         boolean       NOT NULL DEFAULT true,

  -- Timestamps
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  -- One row per clinic per channel
  UNIQUE (client_id, channel)
);

-- ── Auto-update updated_at ────────────────────────────────────────────────────
-- Uses a table-specific function name to avoid any clash with existing triggers
CREATE OR REPLACE FUNCTION public.channel_configs_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS channel_configs_updated_at ON public.channel_configs;
CREATE TRIGGER channel_configs_updated_at
  BEFORE UPDATE ON public.channel_configs
  FOR EACH ROW EXECUTE FUNCTION public.channel_configs_set_updated_at();

-- ── Row-Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.channel_configs ENABLE ROW LEVEL SECURITY;

-- Clinic users can only read/write their own clinic's channel config.
-- Assumes the portal authenticates via Supabase Auth and the clients table
-- has a user_id column matching auth.uid().
CREATE POLICY "clinic_owner_select" ON public.channel_configs
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "clinic_owner_insert" ON public.channel_configs
  FOR INSERT WITH CHECK (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "clinic_owner_update" ON public.channel_configs
  FOR UPDATE USING (
    client_id IN (
      SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
  );

-- ── Seed: default WhatsApp-on row for every existing clinic ──────────────────
-- (safe to run multiple times — INSERT … ON CONFLICT DO NOTHING)
INSERT INTO public.channel_configs (client_id, channel, enabled, reply_delay)
SELECT id, 'whatsapp',  true,  '0' FROM public.clients
ON CONFLICT (client_id, channel) DO NOTHING;

INSERT INTO public.channel_configs (client_id, channel, enabled, reply_delay)
SELECT id, 'instagram', false, '0' FROM public.clients
ON CONFLICT (client_id, channel) DO NOTHING;

INSERT INTO public.channel_configs (client_id, channel, enabled, reply_delay)
SELECT id, 'messenger', false, '0' FROM public.clients
ON CONFLICT (client_id, channel) DO NOTHING;

-- ── Done ──────────────────────────────────────────────────────────────────────
-- After running, every clinic in the clients table will have 3 rows:
--   whatsapp  → enabled = true
--   instagram → enabled = false
--   messenger → enabled = false
-- The portal's Channel Control Panel reads/writes these rows via the
-- upsert on (client_id, channel).
