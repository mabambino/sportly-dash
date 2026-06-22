ALTER TABLE public.time_slots
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.course_groups(id) ON DELETE SET NULL;