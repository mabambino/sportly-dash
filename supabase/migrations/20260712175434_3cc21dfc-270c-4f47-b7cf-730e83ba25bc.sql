
-- 1. Private schema for security-definer helpers so they aren't exposed via PostgREST
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_club_staff(_user_id uuid, _club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.club_id = _club_id AND m.role IN ('club_owner','trainer'));
$$;

CREATE OR REPLACE FUNCTION private.is_club_member(_user_id uuid, _club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.club_id = _club_id);
$$;

CREATE OR REPLACE FUNCTION private.shares_club_with(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m1
    JOIN public.memberships m2 ON m1.club_id = m2.club_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  );
$$;

REVOKE ALL ON FUNCTION private.is_club_staff(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_club_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.shares_club_with(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_club_staff(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_club_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_club_with(uuid, uuid) TO authenticated;

-- 2. Fix mutable search_path on existing public functions
CREATE OR REPLACE FUNCTION public.generate_team_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; result TEXT := ''; i INT;
BEGIN
  FOR i IN 1..6 LOOP result := result || substr(chars, floor(random()*length(chars))::int + 1, 1); END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.set_team_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.team_code IS NULL OR NEW.team_code = '' THEN
    LOOP
      NEW.team_code := public.generate_team_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE team_code = NEW.team_code);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 3. Drop public versions of the helpers (CASCADE removes dependent policies which we recreate below)
DROP FUNCTION IF EXISTS public.is_club_staff(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_club_member(uuid, uuid) CASCADE;

-- 4. Drop policies that need tightening (some may already be dropped by the CASCADE above)
DROP POLICY IF EXISTS "profiles read all authenticated" ON public.profiles;
DROP POLICY IF EXISTS "clubs readable by authenticated" ON public.clubs;
DROP POLICY IF EXISTS "memberships readable by authenticated" ON public.memberships;
DROP POLICY IF EXISTS "memberships insert self or by owner" ON public.memberships;
DROP POLICY IF EXISTS "memberships update self or owner" ON public.memberships;
DROP POLICY IF EXISTS "memberships delete self or owner" ON public.memberships;
DROP POLICY IF EXISTS "notif insert authenticated" ON public.notifications;
DROP POLICY IF EXISTS "pay insert staff or self" ON public.payments;
DROP POLICY IF EXISTS "pay update staff or self" ON public.payments;
DROP POLICY IF EXISTS "pay read self or staff" ON public.payments;

-- 5. Recreate tightened policies

-- profiles: yourself or users you share a club with
CREATE POLICY "profiles read own or shared club" ON public.profiles
FOR SELECT TO authenticated
USING (auth.uid() = id OR private.shares_club_with(auth.uid(), id));

-- clubs: members or the owner
CREATE POLICY "clubs read by members" ON public.clubs
FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR private.is_club_member(auth.uid(), id));

-- memberships: co-members only
CREATE POLICY "memberships read by co-members" ON public.memberships
FOR SELECT TO authenticated
USING (private.is_club_member(auth.uid(), club_id));

-- memberships insert: self as student/parent only, or club owner
CREATE POLICY "memberships insert self or owner" ON public.memberships
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND role IN ('student','parent'))
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = memberships.club_id AND c.owner_id = auth.uid())
);

-- memberships update: only the club owner (prevents self role escalation)
CREATE POLICY "memberships update by owner" ON public.memberships
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = memberships.club_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = memberships.club_id AND c.owner_id = auth.uid()));

-- memberships delete: self or owner
CREATE POLICY "memberships delete self or owner" ON public.memberships
FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = memberships.club_id AND c.owner_id = auth.uid())
);

-- notifications insert: only for yourself, or by staff for a member of their club
CREATE POLICY "notif insert self or staff" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = notifications.user_id
      AND private.is_club_staff(auth.uid(), m.club_id)
  )
);

-- payments read: self or staff
CREATE POLICY "pay read self or staff" ON public.payments
FOR SELECT TO authenticated
USING (auth.uid() = member_id OR private.is_club_staff(auth.uid(), club_id));

-- payments insert: staff any status, self only 'pending'
CREATE POLICY "pay insert staff or self pending" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (
  private.is_club_staff(auth.uid(), club_id)
  OR (auth.uid() = member_id AND status = 'pending')
);

-- payments update: staff only
CREATE POLICY "pay update by staff" ON public.payments
FOR UPDATE TO authenticated
USING (private.is_club_staff(auth.uid(), club_id))
WITH CHECK (private.is_club_staff(auth.uid(), club_id));

-- 6. Recreate policies dropped by the helper CASCADE, now referencing private.*

-- rsvps
CREATE POLICY "rsvps read by members" ON public.rsvps
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = rsvps.slot_id AND private.is_club_member(auth.uid(), s.club_id)));

-- time_slots
CREATE POLICY "slots read by members" ON public.time_slots
FOR SELECT TO authenticated USING (private.is_club_member(auth.uid(), club_id));
CREATE POLICY "slots write by staff" ON public.time_slots
FOR INSERT TO authenticated WITH CHECK (private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "slots update by staff" ON public.time_slots
FOR UPDATE TO authenticated USING (private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "slots delete by staff" ON public.time_slots
FOR DELETE TO authenticated USING (private.is_club_staff(auth.uid(), club_id));

-- student_stats
CREATE POLICY "stats read self or staff" ON public.student_stats
FOR SELECT TO authenticated USING (auth.uid() = student_id OR private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "stats insert by staff" ON public.student_stats
FOR INSERT TO authenticated WITH CHECK (private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "stats update by staff" ON public.student_stats
FOR UPDATE TO authenticated USING (private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "stats delete by staff" ON public.student_stats
FOR DELETE TO authenticated USING (private.is_club_staff(auth.uid(), club_id));

-- attendance_records
CREATE POLICY "att read self or staff" ON public.attendance_records
FOR SELECT TO authenticated
USING (auth.uid() = student_id OR EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = attendance_records.slot_id AND private.is_club_staff(auth.uid(), s.club_id)));
CREATE POLICY "att insert by staff" ON public.attendance_records
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = attendance_records.slot_id AND private.is_club_staff(auth.uid(), s.club_id)));
CREATE POLICY "att update by staff" ON public.attendance_records
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = attendance_records.slot_id AND private.is_club_staff(auth.uid(), s.club_id)));

-- chat_channels
CREATE POLICY "ch read by members" ON public.chat_channels
FOR SELECT TO authenticated USING (private.is_club_member(auth.uid(), club_id));
CREATE POLICY "ch insert by staff" ON public.chat_channels
FOR INSERT TO authenticated WITH CHECK (private.is_club_staff(auth.uid(), club_id));

-- chat_messages
CREATE POLICY "msg read by members" ON public.chat_messages
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = chat_messages.channel_id AND private.is_club_member(auth.uid(), c.club_id)));
CREATE POLICY "msg insert by members" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = chat_messages.channel_id AND private.is_club_member(auth.uid(), c.club_id)));

-- announcements
CREATE POLICY "ann read by members" ON public.announcements
FOR SELECT TO authenticated USING (private.is_club_member(auth.uid(), club_id));
CREATE POLICY "ann write by staff" ON public.announcements
FOR INSERT TO authenticated WITH CHECK (private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "ann update by staff" ON public.announcements
FOR UPDATE TO authenticated USING (private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "ann delete by staff" ON public.announcements
FOR DELETE TO authenticated USING (private.is_club_staff(auth.uid(), club_id));

-- badges
CREATE POLICY "badges read self or staff" ON public.badges
FOR SELECT TO authenticated USING (auth.uid() = user_id OR private.is_club_staff(auth.uid(), club_id));
CREATE POLICY "badges insert by staff" ON public.badges
FOR INSERT TO authenticated WITH CHECK (private.is_club_staff(auth.uid(), club_id));

-- course_groups
CREATE POLICY "Club members can view groups" ON public.course_groups
FOR SELECT TO authenticated USING (private.is_club_member(auth.uid(), club_id));
CREATE POLICY "Club staff can manage groups" ON public.course_groups
FOR ALL TO authenticated
USING (private.is_club_staff(auth.uid(), club_id))
WITH CHECK (private.is_club_staff(auth.uid(), club_id));
