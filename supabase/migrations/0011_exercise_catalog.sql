-- Fase C del rediseño: catálogo de ejercicios (MoveKit) + registro de carga.
-- exercise_catalog se puebla UNA vez por script de import (service role);
-- lectura pública porque es contenido compartido, no dato de usuario.
create table exercise_catalog (
  slug text primary key,
  name_en text not null,
  name_es text not null,
  primary_muscle text not null,
  equipment text not null,
  movement_pattern text not null,
  difficulty text not null,
  instructions_es text[] not null,
  video_url text not null,
  poster_url text not null,
  created_at timestamptz not null default now()
);

alter table exercise_catalog enable row level security;

create policy "exercise_catalog_public_read" on exercise_catalog
  for select to authenticated using (true);

-- exercise_logs: registro por serie. Sin FK relacional al ejercicio dentro
-- del plan porque workout_plans.schedule vive en JSONB — se referencia por
-- posición (day_number, exercise_order), igual que ya hace el cliente hoy.
create table exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_plan_id uuid not null references workout_plans(id) on delete cascade,
  day_number int not null,
  exercise_order int not null,
  exercise_slug text null references exercise_catalog(slug) on delete set null,
  set_number int not null,
  kg numeric null,
  reps int null,
  bodyweight_lastre_kg numeric null,
  recorded_at timestamptz not null default now()
);

alter table exercise_logs enable row level security;

create policy "exercise_logs_owner_select" on exercise_logs
  for select to authenticated using (user_id = auth.uid());

create policy "exercise_logs_owner_insert" on exercise_logs
  for insert to authenticated with check (user_id = auth.uid());

create index exercise_logs_slug_idx on exercise_logs(exercise_slug, recorded_at);
create index exercise_logs_plan_idx on exercise_logs(workout_plan_id, day_number, exercise_order);

-- Bucket público (mismo patrón que 0008_avatars_bucket.sql): lectura pública,
-- solo el script de import (service role) escribe.
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do nothing;

create policy "exercise_media_public_read" on storage.objects
  for select using (bucket_id = 'exercise-media');
