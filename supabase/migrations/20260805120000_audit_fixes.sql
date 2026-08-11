-- ============================================================
-- Security and data-integrity fixes
--
-- NOTE: as with every migration in this repo, committed files are
-- not applied automatically. Run this in the Supabase SQL editor
-- (Lovable Cloud → Database) after pulling this commit.
-- ============================================================

-- ── 1. pay_invoice(): serialise concurrent payment attempts ──
-- Before: the invoice row was read without a lock, so two requests
-- firing at once (double-clicked "Pay now", a retry, two tabs) could
-- both observe status <> 'paid' and both run the UPDATE. Harmless
-- while checkout is simulated; a double charge once a real provider
-- is wired into this function.
-- After: SELECT ... FOR UPDATE holds a row lock for the rest of the
-- transaction, so the second caller blocks and then sees 'paid'.
-- This mirrors the locking already used by set_session_rsvp().
CREATE OR REPLACE FUNCTION public.pay_invoice(_payment_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.payment_status;
BEGIN
  SELECT status INTO v_status FROM public.payments
  WHERE id = _payment_id AND member_id = auth.uid()
  FOR UPDATE;
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

-- ── 2. Unguessable team codes ────────────────────────────────
-- Before: random() is a non-cryptographic PRNG, and 6 characters from
-- a 31-symbol alphabet is only ~29.7 bits. Because join_club_by_code()
-- is unauthenticated-adjacent (any signed-in user may call it with any
-- code) and unthrottled, codes were brute-forceable — and a successful
-- guess grants membership, which exposes the roster, schedule and chat
-- of a club whose members are frequently minors.
-- After: gen_random_bytes() (pgcrypto CSPRNG) over 8 characters ≈ 39.6
-- bits, and a uniqueness retry loop.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_team_code() RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  chars  TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT;
  bytes  BYTEA;
  i      INT;
  tries  INT := 0;
BEGIN
  LOOP
    result := '';
    bytes  := extensions.gen_random_bytes(8);
    FOR i IN 0..7 LOOP
      result := result || substr(chars, (get_byte(bytes, i) % length(chars)) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.team_code = result);
    tries := tries + 1;
    IF tries > 20 THEN
      RAISE EXCEPTION 'Could not allocate a unique team code';
    END IF;
  END LOOP;
  RETURN result;
END; $$;

-- SECURITY DEFINER also repairs a second, quieter defect. The collision check
-- in set_team_code() runs as the inserting user, and since the tenant-isolation
-- migration that user can only SELECT clubs they already belong to — so the
-- trigger's "EXIT WHEN NOT EXISTS" saw an empty table and always exited on the
-- first iteration. Collisions were left to the UNIQUE constraint, surfacing as
-- a raw database error during club creation. The loop above runs with the
-- function owner's privileges and therefore actually sees every club.
REVOKE ALL ON FUNCTION public.generate_team_code() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_team_code() TO authenticated, service_role;

-- ── 3. Rate-limit team-code guessing ─────────────────────────
-- A correct-by-construction code is only half the fix: without a
-- throttle an attacker can still grind the keyspace.
CREATE TABLE IF NOT EXISTS public.join_attempts (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS join_attempts_user_time_idx
  ON public.join_attempts (user_id, attempted_at DESC);
ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions and service_role touch this.
GRANT ALL ON public.join_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.join_club_by_code(
  _code TEXT, _role public.app_role, _group_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, name TEXT, sport TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club public.clubs%ROWTYPE; v_recent INT;
BEGIN
  IF auth.uid() IS NULL OR _role NOT IN ('student'::public.app_role, 'parent'::public.app_role) THEN
    RAISE EXCEPTION 'Invalid membership role';
  END IF;

  SELECT count(*) INTO v_recent FROM public.join_attempts
  WHERE user_id = auth.uid() AND attempted_at > now() - interval '1 hour';
  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'Too many join attempts — please try again later';
  END IF;
  INSERT INTO public.join_attempts (user_id) VALUES (auth.uid());

  SELECT * INTO v_club FROM public.clubs c
  WHERE c.team_code = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid team code'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.club_id = v_club.id AND m.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are already a member of this club';
  END IF;

  IF _group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_groups g WHERE g.id = _group_id AND g.club_id = v_club.id
  ) THEN RAISE EXCEPTION 'Group does not belong to this club'; END IF;

  INSERT INTO public.memberships (club_id, user_id, role, group_id)
  VALUES (v_club.id, auth.uid(), _role, _group_id);
  RETURN QUERY SELECT v_club.id, v_club.name, v_club.sport;
END; $$;
REVOKE ALL ON FUNCTION public.join_club_by_code(TEXT, public.app_role, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_club_by_code(TEXT, public.app_role, UUID) TO authenticated;

-- ── 4. leads.source ──────────────────────────────────────────
-- submitEmbedLead() has always written a `source` column that the
-- schema never defined, so public embed enquiries failed outright.
-- The column is genuinely useful (manual vs embed provenance), so
-- add it rather than dropping the field.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS leads_club_created_idx
  ON public.leads (club_id, created_at DESC);

-- ── 5. Club-level tax settings ───────────────────────────────
-- 20260703120000 added clubs.tax_country / tax_rate_bps, but the
-- Revenue page kept its settings in localStorage, so each staff member
-- saw a different tax rate. Nothing to add here — the columns already
-- exist — but staff need permission to read them, which the existing
-- "clubs readable by members" policy covers, and only the owner can
-- write, per "clubs update by owner".
