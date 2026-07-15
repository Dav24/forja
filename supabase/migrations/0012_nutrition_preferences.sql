-- Fase D del rediseño: alergias/disgustos persistidos, swap de comida,
-- onboarding de trayectoria competitiva + suplementación.

create table food_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  item       text not null,
  kind       text not null check (kind in ('allergy', 'dislike')),
  created_at timestamptz not null default now(),
  unique (user_id, kind, item)
);

create index food_preferences_user_idx on food_preferences(user_id);

alter table food_preferences enable row level security;

create policy "food_preferences_owner_select" on food_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "food_preferences_owner_insert" on food_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "food_preferences_owner_delete" on food_preferences
  for delete to authenticated using (user_id = auth.uid());

-- meal_swaps: auditoría + base del límite semanal. Sin política de
-- insert/update/delete para el cliente — solo la EF swap-meal (service role) escribe.
create table meal_swaps (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  meal_plan_id  uuid not null references meal_plans(id) on delete cascade,
  day_number    int not null,
  meal_index    int not null,
  old_meal_name text not null,
  new_meal_name text not null,
  created_at    timestamptz not null default now()
);

create index meal_swaps_user_date_idx on meal_swaps(user_id, created_at desc);

alter table meal_swaps enable row level security;

create policy "meal_swaps_owner_select" on meal_swaps
  for select to authenticated using (user_id = auth.uid());

-- Onboarding: trayectoria competitiva + suplementación (paso 5, opcional).
alter table goals add column athletic_background text;
alter table goals add constraint goals_athletic_background_check check (
  athletic_background is null or athletic_background in ('none', 'amateur', 'high_performance', 'bodybuilding')
);

alter table profiles add column supplements text[] not null default '{}';
alter table profiles add column supplements_other text;
