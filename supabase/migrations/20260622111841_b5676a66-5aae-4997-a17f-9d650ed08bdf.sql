-- Extend the course_groups table created by 20260618200000_add_course_groups.
-- The previous version attempted to create the same table a second time,
-- causing every fresh migration chain to fail.
ALTER TABLE public.course_groups
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS course_groups_club_id_idx
  ON public.course_groups(club_id);

DROP TRIGGER IF EXISTS course_groups_touch_updated_at ON public.course_groups;
CREATE TRIGGER course_groups_touch_updated_at
  BEFORE UPDATE ON public.course_groups
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.course_groups(id) ON DELETE SET NULL;
