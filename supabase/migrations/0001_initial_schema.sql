-- Extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Perfiles de usuario (extiende auth.users de Supabase)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  language      TEXT NOT NULL DEFAULT 'es-MX',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  expo_push_token TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos corporales históricos
CREATE TABLE body_data (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  weight_kg     DECIMAL(5,2),
  height_cm     DECIMAL(5,2),
  age           INTEGER,
  gender        TEXT CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  activity_level TEXT CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  body_fat_pct  DECIMAL(4,2),
  muscle_mass_kg DECIMAL(5,2),
  bone_density  DECIMAL(4,3),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_body_data_user_date ON body_data(user_id, recorded_at DESC);

-- Objetivos activos del usuario
CREATE TABLE goals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
    'weight_loss','muscle_gain','recomposition',
    'powerlifting','sport_specific','general_fitness'
  )),
  target_weight_kg DECIMAL(5,2),
  target_date   DATE,
  mode          TEXT NOT NULL DEFAULT 'flexible' CHECK (mode IN ('flexible','strict')),
  sport_type    TEXT,
  fitness_level TEXT NOT NULL CHECK (fitness_level IN (
    'casual','intermediate','intensive','advanced','elite'
  )),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goals_user_active ON goals(user_id, is_active);

-- Historial de conversaciones con el coach IA
CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content       TEXT NOT NULL,
  model_used    TEXT,
  tokens_used   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_date ON conversations(user_id, created_at DESC);

-- Contador de mensajes diarios (para límite Free)
CREATE TABLE daily_message_count (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date          DATE NOT NULL DEFAULT CURRENT_DATE,
  count         INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_msg_user_date ON daily_message_count(user_id, date);

-- Planes de entrenamiento
CREATE TABLE workout_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  schedule        JSONB NOT NULL DEFAULT '[]',
  generated_by    TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  modifications_count INTEGER NOT NULL DEFAULT 0,
  plan_month      DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_plans_user ON workout_plans(user_id, is_active, plan_month);

-- Planes alimenticios (Premium)
CREATE TABLE meal_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  daily_calories  INTEGER,
  macros          JSONB NOT NULL DEFAULT '{}',
  meals           JSONB NOT NULL DEFAULT '{}',
  generated_by    TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_plans_user ON meal_plans(user_id, is_active);

-- Suscripciones (sincronizado desde Stripe)
CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  plan                    TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active','canceled','past_due','trialing','incomplete')
  ),
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Notificaciones push
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
    'missed_workout','diet_alert','progress_update','goal_milestone','plan_ready'
  )),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read, sent_at DESC);

-- Jobs async (generación de planes)
CREATE TABLE async_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('generate_workout_plan','generate_meal_plan')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','processing','completed','failed')
  ),
  result        JSONB,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_async_jobs_user_status ON async_jobs(user_id, status, created_at DESC);

-- Row Level Security: cada usuario solo ve sus propios datos
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_message_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE async_jobs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "users_own_data" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "users_own_body_data" ON body_data
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_goals" ON goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_daily_count" ON daily_message_count
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_workout_plans" ON workout_plans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_meal_plans" ON meal_plans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_subscriptions" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_jobs" ON async_jobs
  FOR ALL USING (auth.uid() = user_id);

-- Trigger: crear perfil y suscripción free automáticamente al registrarse
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  INSERT INTO subscriptions (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
