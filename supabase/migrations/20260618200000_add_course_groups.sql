-- course_groups: groups with their own pricing, schedule, and dedicated chat
CREATE TABLE public.course_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  session_duration_minutes INTEGER NOT NULL DEFAULT 60,
  schedule_days TEXT[] NOT NULL DEFAULT '{}',
  schedule_time TEXT NOT NULL DEFAULT '09:00',
  color TEXT NOT NULL DEFAULT '#6366f1',
  chat_channel_id UUID REFERENCES public.chat_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_groups TO authenticated;
GRANT ALL ON public.course_groups TO service_role;
ALTER TABLE public.course_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups read by members" ON public.course_groups FOR SELECT TO authenticated USING (public.is_club_member(auth.uid(), club_id));
CREATE POLICY "groups insert by staff" ON public.course_groups FOR INSERT TO authenticated WITH CHECK (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "groups update by staff" ON public.course_groups FOR UPDATE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "groups delete by staff" ON public.course_groups FOR DELETE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));

-- Link memberships to a course group
ALTER TABLE public.memberships ADD COLUMN group_id UUID REFERENCES public.course_groups(id) ON DELETE SET NULL;

-- Link time slots to a course group
ALTER TABLE public.time_slots ADD COLUMN group_id UUID REFERENCES public.course_groups(id) ON DELETE SET NULL;

-- Allow channel writes by staff (needed to auto-create group channels)
CREATE POLICY "ch update by staff" ON public.chat_channels FOR UPDATE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));
CREATE POLICY "ch delete by staff" ON public.chat_channels FOR DELETE TO authenticated USING (public.is_club_staff(auth.uid(), club_id));
