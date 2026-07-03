-- ============================================================
-- Syncletics improvements — 2026-07-03
-- Secure payment flow, flexible course schedules, revenue tax
-- settings, and idempotent creation of the leads table used by
-- the Leads / Pipeline pages.
--
-- NOTE: committed migration files are not applied automatically.
-- Run this file in the Supabase SQL editor (Lovable Cloud →
-- Database) after pulling this commit. The app degrades
-- gracefully until then.
-- ============================================================

-- ── 1. Payments: members can no longer edit payment rows ─────
-- Before: policy "pay update staff or self" let any member update
-- their own payment row (e.g. mark their invoice paid from the
-- browser console). After: direct updates are staff-only and
-- members pay through the pay_invoice() RPC below.
DROP POLICY IF EXISTS "pay update staff or self" ON public.payments;
DROP POLICY IF EXISTS "pay update staff only" ON public.payments;
CREATE POLICY "pay update staff only" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_club_staff(auth.uid(), club_id));

-- Simulated checkout: validates that the caller owns the invoice
-- and that it isn't already paid. When a real payment provider
-- (e.g. Stripe) is integrated, its webhook — running with the
-- service role — should replace the body of this function.
CREATE OR REPLACE FUNCTION public.pay_invoice(_payment_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.payment_status;
BEGIN
  SELECT status INTO v_status FROM public.payments
  WHERE id = _payment_id AND member_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or not yours';
  END IF;
  IF v_status = 'paid' THEN
    RAISE EXCEPTION 'Invoice already paid';
  END IF;
  UPDATE public.payments
  SET status = 'paid', paid_at = now()
  WHERE id = _payment_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.pay_invoice(UUID) TO authenticated;

-- ── 2. Courses: flexible per-day schedule ────────────────────
-- Each entry: { "day": "Mon", "time": "17:00", "duration": 60 }.
-- The legacy schedule_days / schedule_time / session_duration_minutes
-- columns are still written for backwards compatibility.
ALTER TABLE public.course_groups
  ADD COLUMN IF NOT EXISTS schedule_slots JSONB NOT NULL DEFAULT '[]';

-- ── 3. Clubs: tax settings for the Revenue page ──────────────
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS tax_country TEXT,
  ADD COLUMN IF NOT EXISTS tax_rate_bps INTEGER NOT NULL DEFAULT 0;

-- ── 4. Leads table (used by the Leads / Pipeline pages) ───────
-- The earlier hand-written migration (20240623_groups_features.sql)
-- used CREATE POLICY IF NOT EXISTS, which Postgres does not
-- support, so it may never have been applied cleanly. This block
-- is fully idempotent.
CREATE TABLE IF NOT EXISTS public.leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  sport         TEXT,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','trial','converted','lost')),
  assigned_to   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  trial_date    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads staff manage" ON public.leads;
CREATE POLICY "leads staff manage" ON public.leads
  FOR ALL TO authenticated
  USING (public.is_club_staff(auth.uid(), club_id))
  WITH CHECK (public.is_club_staff(auth.uid(), club_id));
