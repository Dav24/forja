-- Perfil de salud: lesiones (con severidad, para filtro determinista de
-- ejercicios) y condiciones médicas/alimenticias (solo-prompt).
-- Ver docs/superpowers/specs/2026-07-20-perfil-de-salud-design.md

create table injuries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  body_area  text not null check (body_area in (
    'rodilla', 'hombro', 'espalda_baja', 'cadera', 'tobillo', 'muñeca', 'cuello', 'otro'
  )),
  severity   text not null check (severity in ('leve_moderada', 'severa_estructural')),
  notes      text,
  created_at timestamptz not null default now()
);

create index injuries_user_idx on injuries(user_id);

alter table injuries enable row level security;

create policy "injuries_owner_select" on injuries
  for select to authenticated using (user_id = auth.uid());
create policy "injuries_owner_insert" on injuries
  for insert to authenticated with check (user_id = auth.uid());
create policy "injuries_owner_delete" on injuries
  for delete to authenticated using (user_id = auth.uid());

create table medical_conditions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  condition  text not null check (condition in (
    'diabetes', 'hipertension', 'bypass_gastrico', 'embarazo', 'enfermedad_renal', 'otro'
  )),
  notes      text,
  created_at timestamptz not null default now()
);

create index medical_conditions_user_idx on medical_conditions(user_id);

alter table medical_conditions enable row level security;

create policy "medical_conditions_owner_select" on medical_conditions
  for select to authenticated using (user_id = auth.uid());
create policy "medical_conditions_owner_insert" on medical_conditions
  for insert to authenticated with check (user_id = auth.uid());
create policy "medical_conditions_owner_delete" on medical_conditions
  for delete to authenticated using (user_id = auth.uid());

-- Aviso único a usuarios free la primera vez que generan cada tipo de plan
-- ("podrás modificar esto en Ajustes para tu próximo plan").
alter table profiles add column seen_health_profile_hint_workout boolean not null default false;
alter table profiles add column seen_health_profile_hint_meal boolean not null default false;

-- Ninguna de las dos tablas persistía los parámetros de generación — hacen
-- falta para que la auto-regeneración premium (al editar el perfil de
-- salud) reutilice los últimos valores sin volver a preguntar nada.
alter table workout_plans add column days_per_week int;
alter table workout_plans add column minutes_per_session int;
alter table workout_plans add column equipment text;

alter table meal_plans add column diet_type text;
alter table meal_plans add column food_availability text;
