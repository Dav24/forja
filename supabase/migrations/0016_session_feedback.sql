-- supabase/migrations/0016_session_feedback.sql
-- Feedback adaptativo de plan: captura post-sesión + historial de ajustes.
-- Ver docs/superpowers/specs/2026-07-20-feedback-adaptativo-plan-design.md

CREATE TABLE session_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number       INT NOT NULL,
  log_date         DATE NOT NULL,
  difficulty_rating TEXT NOT NULL CHECK (difficulty_rating IN ('muy_facil','facil','justo','dificil','muy_dificil')),
  problem_tags     TEXT[] NOT NULL DEFAULT '{}',
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX session_feedback_identity_idx
  ON session_feedback(user_id, workout_plan_id, day_number, log_date);

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_feedback_owner_select" ON session_feedback
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "session_feedback_owner_insert" ON session_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE exercise_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number       INT NOT NULL,
  exercise_order   INT NOT NULL,
  log_date         DATE NOT NULL,
  flag             TEXT NOT NULL CHECK (flag IN ('facil','dificil')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX exercise_feedback_identity_idx
  ON exercise_feedback(user_id, workout_plan_id, day_number, exercise_order, log_date);

ALTER TABLE exercise_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercise_feedback_owner_select" ON exercise_feedback
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "exercise_feedback_owner_insert" ON exercise_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE plan_adjustments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number       INT NOT NULL,
  exercise_order   INT,
  source           TEXT NOT NULL CHECK (source IN ('deterministic','ai')),
  reason_tag       TEXT NOT NULL,
  before_snapshot  JSONB NOT NULL,
  after_snapshot   JSONB NOT NULL,
  applied_by       TEXT NOT NULL CHECK (applied_by IN ('auto','user_approved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX plan_adjustments_plan_idx ON plan_adjustments(workout_plan_id, created_at);

ALTER TABLE plan_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_adjustments_owner_select" ON plan_adjustments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Sin policy de INSERT para `authenticated`: solo la EF (service role,
-- bypassea RLS) escribe aquí.

ALTER TABLE profiles ADD COLUMN auto_adjust_enabled BOOLEAN NOT NULL DEFAULT false;
