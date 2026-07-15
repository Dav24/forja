-- Pulido: integridad de exercise_logs — sobreescribir en vez de duplicar,
-- sin destruir el historial de progresión entre semanas (day_number 1-7 se
-- repite cada semana; log_date es la fecha calendario real que desambigua
-- "el Martes de esta semana" de "el Martes de la semana pasada").

-- Deduplicar filas preexistentes ANTES de crear el índice único: como hasta
-- ahora no existía ningún constraint que lo impidiera, es posible que ya
-- haya duplicados de pruebas anteriores (Fase C). Se conserva solo la fila
-- con recorded_at más reciente por grupo — el resto se descarta.
delete from exercise_logs a using exercise_logs b
where a.user_id = b.user_id
  and a.workout_plan_id = b.workout_plan_id
  and a.day_number = b.day_number
  and a.exercise_order = b.exercise_order
  and a.set_number = b.set_number
  and a.recorded_at::date = b.recorded_at::date
  and a.recorded_at < b.recorded_at;

alter table exercise_logs add column log_date date not null default current_date;

-- Backfill: log_date = la fecha real en que se registró cada fila existente
-- (no la fecha de hoy) — evita que todo el historial preexistente colisione
-- bajo un mismo log_date al momento de correr esta migración.
update exercise_logs set log_date = recorded_at::date;

create unique index exercise_logs_identity_idx
  on exercise_logs(user_id, workout_plan_id, day_number, exercise_order, set_number, log_date);

-- Sin esta política, la rama "DO UPDATE" de un upsert falla bajo RLS: solo
-- había select/insert (migración 0011).
create policy "exercise_logs_owner_update" on exercise_logs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
