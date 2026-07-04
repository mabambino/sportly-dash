-- Security and integrity fixes for memberships, joining, RSVPs and notifications.

DROP POLICY IF EXISTS "memberships insert self or by owner" ON public.memberships;
DROP POLICY IF EXISTS "memberships update self or owner" ON public.memberships;
CREATE POLICY "memberships insert by owner" ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()));
CREATE POLICY "memberships update by owner" ON public.memberships
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.join_club_by_code(
  _code TEXT, _role public.app_role, _group_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, name TEXT, sport TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_club public.clubs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR _role NOT IN ('student'::public.app_role, 'parent'::public.app_role) THEN
    RAISE EXCEPTION 'Invalid membership role';
  END IF;
  SELECT * INTO v_club FROM public.clubs c
  WHERE c.team_code = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid team code'; END IF;
  IF _group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.course_groups g WHERE g.id = _group_id AND g.club_id = v_club.id
  ) THEN RAISE EXCEPTION 'Group does not belong to this club'; END IF;
  INSERT INTO public.memberships (club_id, user_id, role, group_id)
  VALUES (v_club.id, auth.uid(), _role, _group_id);
  RETURN QUERY SELECT v_club.id, v_club.name, v_club.sport;
END; $$;
REVOKE ALL ON FUNCTION public.join_club_by_code(TEXT, public.app_role, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_club_by_code(TEXT, public.app_role, UUID) TO authenticated;

DROP POLICY IF EXISTS "rsvps insert self" ON public.rsvps;
CREATE POLICY "rsvps insert self in own club" ON public.rsvps
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.time_slots s
    WHERE s.id = slot_id AND public.is_club_member(auth.uid(), s.club_id)
  ));

-- Locking the session serializes capacity checks for concurrent reservations.
CREATE OR REPLACE FUNCTION public.set_session_rsvp(_slot_id UUID, _going BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_capacity INTEGER; v_count INTEGER;
BEGIN
  SELECT s.capacity INTO v_capacity FROM public.time_slots s
  WHERE s.id = _slot_id AND public.is_club_member(auth.uid(), s.club_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF NOT _going THEN
    DELETE FROM public.rsvps WHERE slot_id = _slot_id AND user_id = auth.uid();
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.rsvps WHERE slot_id = _slot_id AND user_id = auth.uid()) THEN RETURN; END IF;
  SELECT count(*) INTO v_count FROM public.rsvps WHERE slot_id = _slot_id AND status = 'going';
  IF v_capacity IS NOT NULL AND v_count >= v_capacity THEN RAISE EXCEPTION 'This session is full'; END IF;
  INSERT INTO public.rsvps (slot_id, user_id, status) VALUES (_slot_id, auth.uid(), 'going');
END; $$;
REVOKE ALL ON FUNCTION public.set_session_rsvp(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_session_rsvp(UUID, BOOLEAN) TO authenticated;

DROP POLICY IF EXISTS "notif insert authenticated" ON public.notifications;
CREATE POLICY "notif insert self" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Definitions moved out of the formerly out-of-order 20240623 migration.
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist TO authenticated;
GRANT ALL ON public.waitlist TO service_role;
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Club members can manage own waitlist" ON public.waitlist;
CREATE POLICY "Club members can manage own waitlist" ON public.waitlist
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.progress_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  skill_level INTEGER CHECK (skill_level BETWEEN 1 AND 5),
  milestone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_log TO authenticated;
GRANT ALL ON public.progress_log TO service_role;
ALTER TABLE public.progress_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can manage progress logs" ON public.progress_log;
DROP POLICY IF EXISTS "Students/parents can view own progress" ON public.progress_log;
CREATE POLICY "Staff can manage progress logs" ON public.progress_log
  FOR ALL TO authenticated USING (public.is_club_staff(auth.uid(), club_id))
  WITH CHECK (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "Students can view own progress" ON public.progress_log
  FOR SELECT TO authenticated USING (student_id = auth.uid());
