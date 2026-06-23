-- ============================================================
-- ClubHaus: groups, waitlist, progress log, leads migration
-- Run in Supabase SQL editor
-- ============================================================

-- 1. course_groups extra columns (idempotent)
ALTER TABLE course_groups
  ADD COLUMN IF NOT EXISTS price_cents        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS schedule_days      text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS schedule_time      text,
  ADD COLUMN IF NOT EXISTS session_duration_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS color              text    NOT NULL DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS chat_channel_id    uuid REFERENCES chat_channels(id) ON DELETE SET NULL;

-- 2. group_id on memberships
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES course_groups(id) ON DELETE SET NULL;

-- 3. group_id on time_slots
ALTER TABLE time_slots
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES course_groups(id) ON DELETE SET NULL;

-- 4. Waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     uuid NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position    integer NOT NULL,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slot_id, user_id)
);
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Club members can manage own waitlist" ON waitlist
  USING (user_id = auth.uid());

-- 5. Progress log table
CREATE TABLE IF NOT EXISTS progress_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note        text NOT NULL,
  skill_level integer CHECK (skill_level BETWEEN 1 AND 5),
  milestone   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE progress_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Staff can manage progress logs" ON progress_log
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.club_id = progress_log.club_id
        AND m.role IN ('club_owner','trainer')
    )
  );
CREATE POLICY IF NOT EXISTS "Students/parents can view own progress" ON progress_log
  FOR SELECT USING (student_id = auth.uid());

-- 6. Leads table (trial pipeline)
CREATE TABLE IF NOT EXISTS leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         text,
  phone         text,
  sport         text,
  notes         text,
  status        text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','trial','converted','lost')),
  assigned_to   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trial_date    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Staff can manage leads" ON leads
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.club_id = leads.club_id
        AND m.role IN ('club_owner','trainer')
    )
  );

-- 7. Billing payments table (for revenue dashboard)
CREATE TABLE IF NOT EXISTS payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  group_id      uuid REFERENCES course_groups(id) ON DELETE SET NULL,
  amount_cents  integer NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  due_date      date,
  paid_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Staff can manage payments" ON payments
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.club_id = payments.club_id
        AND m.role IN ('club_owner','trainer')
    )
  );
CREATE POLICY IF NOT EXISTS "Members can view own payments" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.id = payments.membership_id
        AND m.user_id = auth.uid()
    )
  );
