
CREATE TYPE public.app_role AS ENUM ('club_owner', 'trainer', 'student', 'parent');
CREATE TYPE public.plan_tier AS ENUM ('free', 'pro');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE public.payment_status AS ENUM ('paid', 'overdue', 'pending');
CREATE TYPE public.rsvp_status AS ENUM ('going', 'maybe', 'declined');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  is_parent BOOLEAN NOT NULL DEFAULT FALSE,
  parent_of UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'general',
  team_code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan plan_tier NOT NULL DEFAULT 'free',
  monthly_fee_cents INTEGER NOT NULL DEFAULT 5000,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clubs readable by authenticated" ON public.clubs FOR SELECT TO authenticated USING (true);
CREATE POLICY "clubs insert own" ON public.clubs FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "clubs update by owner" ON public.clubs FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "clubs delete by owner" ON public.clubs FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memberships readable by authenticated" ON public.memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "memberships insert self or by owner" ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()));
CREATE POLICY "memberships update self or owner" ON public.memberships FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()));
CREATE POLICY "memberships delete self or owner" ON public.memberships FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.is_club_staff(_user_id UUID, _club_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.club_id = _club_id AND m.role IN ('club_owner','trainer'));
$$;

CREATE OR REPLACE FUNCTION public.is_club_member(_user_id UUID, _club_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.club_id = _club_id);
$$;

CREATE OR REPLACE FUNCTION public.generate_team_code() RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; result TEXT := ''; i INT;
BEGIN
  FOR i IN 1..6 LOOP result := result || substr(chars, floor(random()*length(chars))::int + 1, 1); END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_team_code() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.team_code IS NULL OR NEW.team_code = '' THEN
    LOOP
      NEW.team_code := public.generate_team_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clubs WHERE team_code = NEW.team_code);
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_set_team_code BEFORE INSERT ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.set_team_code();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_clubs_updated BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.time_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  capacity INTEGER NOT NULL DEFAULT 20,
  trainer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_slots TO authenticated;
GRANT ALL ON public.time_slots TO service_role;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots read by members" ON public.time_slots FOR SELECT TO authenticated USING (public.is_club_member(auth.uid(), club_id));
CREATE POLICY "slots write by staff" ON public.time_slots FOR INSERT TO authenticated WITH CHECK (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "slots update by staff" ON public.time_slots FOR UPDATE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "slots delete by staff" ON public.time_slots FOR DELETE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));

CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status rsvp_status NOT NULL DEFAULT 'going',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rsvps TO authenticated;
GRANT ALL ON public.rsvps TO service_role;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsvps read by members" ON public.rsvps FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = slot_id AND public.is_club_member(auth.uid(), s.club_id))
);
CREATE POLICY "rsvps insert self" ON public.rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsvps update self" ON public.rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rsvps delete self" ON public.rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.time_slots(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID REFERENCES auth.users(id),
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "att read self or staff" ON public.attendance_records FOR SELECT TO authenticated USING (
  auth.uid() = student_id OR EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = slot_id AND public.is_club_staff(auth.uid(), s.club_id))
);
CREATE POLICY "att insert by staff" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = slot_id AND public.is_club_staff(auth.uid(), s.club_id))
);
CREATE POLICY "att update by staff" ON public.attendance_records FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.time_slots s WHERE s.id = slot_id AND public.is_club_staff(auth.uid(), s.club_id))
);

CREATE TABLE public.student_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  value NUMERIC NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_stats TO authenticated;
GRANT ALL ON public.student_stats TO service_role;
ALTER TABLE public.student_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats read self or staff" ON public.student_stats FOR SELECT TO authenticated USING (
  auth.uid() = student_id OR public.is_club_staff(auth.uid(), club_id)
);
CREATE POLICY "stats insert by staff" ON public.student_stats FOR INSERT TO authenticated WITH CHECK (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "stats update by staff" ON public.student_stats FOR UPDATE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "stats delete by staff" ON public.student_stats FOR DELETE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));

CREATE TABLE public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_broadcast BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channels TO authenticated;
GRANT ALL ON public.chat_channels TO service_role;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ch read by members" ON public.chat_channels FOR SELECT TO authenticated USING (public.is_club_member(auth.uid(), club_id));
CREATE POLICY "ch insert by staff" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (public.is_club_staff(auth.uid(), club_id));

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg read by members" ON public.chat_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id AND public.is_club_member(auth.uid(), c.club_id))
);
CREATE POLICY "msg insert by members" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id AND public.is_club_member(auth.uid(), c.club_id))
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status payment_status NOT NULL DEFAULT 'pending',
  period_month DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(club_id, member_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay read self or staff" ON public.payments FOR SELECT TO authenticated USING (
  auth.uid() = member_id OR public.is_club_staff(auth.uid(), club_id)
);
CREATE POLICY "pay insert staff or self" ON public.payments FOR INSERT TO authenticated WITH CHECK (
  public.is_club_staff(auth.uid(), club_id) OR auth.uid() = member_id
);
CREATE POLICY "pay update staff or self" ON public.payments FOR UPDATE TO authenticated USING (
  public.is_club_staff(auth.uid(), club_id) OR auth.uid() = member_id
);

CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann read by members" ON public.announcements FOR SELECT TO authenticated USING (public.is_club_member(auth.uid(), club_id));
CREATE POLICY "ann write by staff" ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "ann update by staff" ON public.announcements FOR UPDATE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "ann delete by staff" ON public.announcements FOR DELETE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif read self" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif insert authenticated" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif update self" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif delete self" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges read self or staff" ON public.badges FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR public.is_club_staff(auth.uid(), club_id)
);
CREATE POLICY "badges insert by staff" ON public.badges FOR INSERT TO authenticated WITH CHECK (public.is_club_staff(auth.uid(), club_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
