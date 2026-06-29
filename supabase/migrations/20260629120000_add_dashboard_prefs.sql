-- Per-user dashboard layout preferences (card order + column layout).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_prefs JSONB;
