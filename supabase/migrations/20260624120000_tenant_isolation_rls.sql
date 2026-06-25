-- Tenant isolation hardening
-- Before: profiles / clubs / memberships were readable by ANY authenticated user
--         (policies used USING (true)), so a member of one club could read the
--         names, emails and memberships of every other club.
-- After:  reads are scoped to the user's own club(s). Joining a new club no longer
--         relies on reading the clubs table directly; it uses find_club_by_code().
--
-- Recursion-safe: all cross-table checks go through SECURITY DEFINER helpers, which
-- run with the function owner's privileges and therefore do not re-trigger RLS.

-- ── Helpers ────────────────────────────────────────────

-- Do two users share at least one club? (used by profiles SELECT)
CREATE OR REPLACE FUNCTION public.shares_club_with(_viewer UUID, _target UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships a
    JOIN public.memberships b ON a.club_id = b.club_id
    WHERE a.user_id = _viewer
      AND b.user_id = _target
  );
$$;

-- Resolve a club by its exact team code, without exposing the whole clubs table.
-- Returns at most one row and only the fields the join screen needs.
CREATE OR REPLACE FUNCTION public.find_club_by_code(_code TEXT)
RETURNS TABLE (id UUID, name TEXT, sport TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.sport
  FROM public.clubs c
  WHERE c.team_code = upper(trim(_code))
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.find_club_by_code(TEXT) TO authenticated;

-- ── PROFILES ──────────────────────────────────────────
-- Own profile, or profiles of people who share a club with you.
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;
CREATE POLICY "profiles read own or club-mates" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.shares_club_with(auth.uid(), id)
  );

-- ── MEMBERSHIPS ─────────────────────────────────────────
-- Your own membership rows, or any membership in a club you belong to.
DROP POLICY IF EXISTS "memberships readable by authenticated" ON public.memberships;
CREATE POLICY "memberships readable within club" ON public.memberships
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_club_member(auth.uid(), club_id)
  );

-- ── CLUBS ─────────────────────────────────────────────
-- Only clubs you own or belong to. Joining a new club uses find_club_by_code().
DROP POLICY IF EXISTS "clubs readable by authenticated" ON public.clubs;
CREATE POLICY "clubs readable by members" ON public.clubs
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_club_member(auth.uid(), id)
  );
