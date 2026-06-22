CREATE TABLE public.course_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  session_duration_minutes INTEGER NOT NULL DEFAULT 60,
  schedule_days TEXT[] NOT NULL DEFAULT '{}',
  schedule_time TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  chat_channel_id UUID REFERENCES public.chat_channels(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_groups TO authenticated;
GRANT ALL ON public.course_groups TO service_role;

ALTER TABLE public.course_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can view groups" ON public.course_groups
  FOR SELECT TO authenticated
  USING (public.is_club_member(auth.uid(), club_id));

CREATE POLICY "Club staff can manage groups" ON public.course_groups
  FOR ALL TO authenticated
  USING (public.is_club_staff(auth.uid(), club_id))
  WITH CHECK (public.is_club_staff(auth.uid(), club_id));

CREATE TRIGGER course_groups_touch_updated_at
  BEFORE UPDATE ON public.course_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX course_groups_club_id_idx ON public.course_groups(club_id);

-- Add group_id to memberships for group assignment
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.course_groups(id) ON DELETE SET NULL;
