-- Traducción de planes al vuelo con caché por idioma (spec 2026-07-09-plan-translation).
-- source_language: idioma en que la IA generó el plan. El default 'es' hace el
-- backfill de todas las filas pre-i18n (todas se generaron en español).
-- translations: caché { "<lang>": <contenido traducido> }; lo escribe la EF
-- translate-plan con service role, nunca el cliente.

alter table workout_plans add column source_language text not null default 'es';
alter table workout_plans add constraint workout_plans_source_language_check
  check (source_language in ('es', 'en'));
alter table workout_plans add column translations jsonb not null default '{}';

alter table meal_plans add column source_language text not null default 'es';
alter table meal_plans add constraint meal_plans_source_language_check
  check (source_language in ('es', 'en'));
alter table meal_plans add column translations jsonb not null default '{}';
