-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: notifications + push_subscriptions tables
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. notifications ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id  bigint       NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type       text         NOT NULL DEFAULT 'message',  -- handoff | lead | booking | message
  title      text         NOT NULL DEFAULT '',
  body       text         NOT NULL DEFAULT '',
  read       boolean      NOT NULL DEFAULT false,
  metadata   jsonb                 DEFAULT '{}',
  created_at timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_client_id_idx ON public.notifications (client_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ── 2. push_subscriptions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    bigint       NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  endpoint     text         NOT NULL UNIQUE,
  subscription text         NOT NULL,  -- full JSON from browser PushManager
  created_at   timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subs_select" ON public.push_subscriptions
  FOR SELECT USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "push_subs_insert" ON public.push_subscriptions
  FOR INSERT WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "push_subs_delete" ON public.push_subscriptions
  FOR DELETE USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Note: the push/send API route uses the service-role key so it can read all
-- push_subscriptions for a client without being bound by RLS.
