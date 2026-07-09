# Traducción de planes al vuelo con caché — Design Spec

**Fecha:** 2026-07-09
**Estado:** Aprobado en brainstorming
**Contexto:** Extensión del Paso 14 (i18n, ver `2026-07-08-i18n-design.md`).

## 1. Problema

El contenido generado por IA (planes de entrenamiento y alimentación) se guarda crudo en la DB en el idioma en que se generó. La UI se traduce con `t()`, pero ese contenido no — así que un plan generado en español, visto con la app en inglés, se ve mezclado (interfaz EN + contenido ES). El spec de i18n §5.2 decidió NO retraducir (para no gastar IA); el usuario ahora quiere que los planes SÍ sigan el idioma, **preservando el mismo plan** (mismos ejercicios/comidas, solo traducido), no regenerándolo.

## 2. Decisión (elegida por el usuario)

Traducir el contenido del plan al vuelo y **cachear por idioma**: se traduce UNA sola vez por idioma y se guarda; cambiar de idioma (o agregar más idiomas) solo reusa la versión guardada. Nunca se re-traduce un idioma ya cacheado. El plan sigue siendo el mismo plan (traducción, no regeneración).

## 3. Alcance

- **Dentro:** planes de entrenamiento (`workout_plans`) y alimentación (`meal_plans`); traducción bajo demanda al abrir un plan en un idioma sin caché; persistencia del caché; idiomas es/en (extensible).
- **Fuera:** re-traducción tras editar/regenerar un plan (un plan nuevo trae su propio idioma origen); traducción masiva del historial (solo al abrir); gating extra para meal plans (mantienen el premium existente); web de pagos; monedas/precios.

## 4. Almacenamiento (migración `0010`)

Agregar a **ambas** tablas `workout_plans` y `meal_plans`:

- `source_language TEXT` — idioma en que se generó el plan (`'es' | 'en'`). **Backfill de filas existentes → `'es'`** (todos los planes pre-i18n se generaron en español). `NOT NULL DEFAULT 'es'` para simplificar.
- `translations JSONB NOT NULL DEFAULT '{}'` — caché: mapa `{ "<lang>": <contenido traducido> }`. Para `workout_plans` el objeto guarda `{ title, description, schedule }`; para `meal_plans` guarda `{ title, meals }` (y cualquier campo textual; los numéricos NO se guardan aquí porque no cambian). Se lee de aquí cuando el idioma activo ≠ `source_language`.

Las EFs de generación (`generate-plan`, `generate-meal-plan`) ya resuelven el idioma del usuario (Paso 14, T12): en el INSERT del plan deben escribir `source_language` con ese idioma resuelto (`'es' | 'en'`).

RLS: las nuevas columnas heredan las políticas existentes de cada tabla (el usuario solo ve/edita sus propios planes). El UPDATE de `translations` lo hace la EF con service role.

## 5. Edge Function `translate-plan` (Deno, TDD)

**Ruta:** `POST /functions/v1/translate-plan` (JWT requerido).

**Input:** `{ plan_type: 'workout' | 'meal', plan_id: string, target_language: 'es' | 'en' }`.

**Salida:** `{ content: <contenido en target_language> }` (el objeto de contenido listo para render) o error 4xx/5xx.

**Lógica (con parte pura testeable, patrón `delete-account/logic.ts`):**
1. Valida JWT; carga el plan por `plan_id` verificando `user_id === auth.uid` (si no, 404/403).
2. **Corto-circuito sin IA:** si `target_language === source_language` → devuelve el contenido original. Si `translations[target_language]` ya existe → lo devuelve. (Ninguna llamada a Claude.)
3. Si no hay caché: construye el prompt de traducción y llama a **Claude Haiku** (`claude-haiku-4-5-20251001`; la traducción es barata y suficiente). Instrucción: traducir SOLO los VALORES de lenguaje natural, preservando la estructura JSON exacta, todas las CLAVES, y todos los números/macros/ids sin cambio.
   - **Campos a traducir — workout:** `title`, `description`, `weekly_schedule_summary`, `progression_notes`, y por cada día `day_name`, `focus`, y por cada ejercicio `name`, `muscle_group`, `technique_notes`. NO tocar: `duration_weeks`, `day_number`, `is_rest`, `estimated_duration_minutes`, `order`, `sets`, `reps`, `rest_seconds`.
   - **Campos a traducir — meal:** `title`, `description`, y por cada día `day_name`, y por cada comida `meal_type`, `time_suggestion`, `name`, `ingredients[]`. NO tocar: `daily_calories`, `macros.*`, `total_calories`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `day_number`.
4. Valida que el JSON traducido conserve la MISMA forma (mismas claves/longitudes de arrays) que el original; si Claude devuelve algo mal formado → error (no se cachea basura).
5. `UPDATE ... SET translations = translations || jsonb_build_object(target_language, <traducido>)` (merge, no sobrescribe otros idiomas). Devuelve el contenido.

**TDD (Deno, `logic.test.ts`):** la parte pura es `buildTranslatePayload`/`mergeTranslation` y la decisión de corto-circuito. Tests: (a) target === source → devuelve original sin marcar llamada IA; (b) target ya cacheado → devuelve caché sin IA; (c) target nuevo → marca llamada IA y hace merge preservando idiomas previos; (d) validación de forma rechaza JSON con distinto número de días/ejercicios; (e) los campos numéricos del original se preservan en el merge.

**Env:** `ANTHROPIC_API_KEY` (ya en `supabase/functions/.env`).

## 6. Cliente: hook `useLocalizedPlan`

`useLocalizedPlan(plan, planType)` → `{ content, isTranslating, error }`.

- `content`: el objeto de contenido a renderizar (título, schedule/meals…).
- Lógica: sea `lang = i18n.language`. Si `lang === plan.source_language` → `content = <campos originales del plan>`. Si `plan.translations[lang]` existe → `content = plan.translations[lang]`. Si no → dispara la mutación a `translate-plan` (`isTranslating = true`), y al resolver invalida la query del plan (`['workout_plan'...]` / `['meal_plan'...]`) para releer con `translations[lang]` ya persistido.
- Mientras `isTranslating`, la pantalla muestra el spinner de carga (§7). Fallback: si `error`, `content` = original + aviso.

Las pantallas de **detalle** `app/(app)/plans/workout/[id].tsx` y `app/(app)/plans/meal/index.tsx` leen el `content` de este hook (y SÍ disparan la traducción al abrir). La UI (`t()`) no cambia.

**El hub `app/(app)/plans/index.tsx` NO dispara traducción** (para no lanzar N llamadas solo por listar): usa un modo pasivo del hook (`useLocalizedPlan(plan, type, { trigger: false })`) que muestra `translations[lang]` si ya está cacheado, o el título original si no — nunca llama a la EF. La traducción se dispara solo al abrir el detalle.

## 7. UX de carga y errores

- **Carga:** primera vez en un idioma sin caché → spinner con copy i18n (`plans:translating` es "Traduciendo tu plan…" / en "Translating your plan…"). Cacheado → instantáneo. Volver al idioma original → instantáneo (nunca se traduce).
- **Error:** si `translate-plan` falla → render del contenido ORIGINAL como fallback + banner discreto (`plans:translateError` "No se pudo traducir, mostrando el original" / "Couldn't translate, showing the original"). No romper la pantalla; permitir reintento (re-open / botón).

## 8. Verificación

- `npx tsc --noEmit` + `npm run check-i18n` limpios (nuevas claves `plans:translating`/`plans:translateError` con paridad).
- Tests Deno de `translate-plan` PASS (suite completa verde).
- **E2E humano (Expo Go):** (1) plan viejo (ES) + app en EN → al abrir, spinner y luego contenido en inglés; (2) reabrir → instantáneo (cacheado); (3) volver a ES → instantáneo, contenido español original; (4) números/macros idénticos entre idiomas; (5) generar plan nuevo en EN → `source_language='en'`, sin traducción al verlo en EN; (6) forzar fallo de la EF → banner de fallback, no crash.

## 9. Riesgos conocidos

- **Traducción incorrecta de un término técnico** (ej. nombre de ejercicio): Haiku es suficiente para esto, pero el prompt debe fijar el glosario de marca (Vulcano/Forja intactos) y pedir términos de fitness naturales en el idioma destino.
- **Deriva de forma del JSON:** mitigado por la validación de forma en §5.4 (rechazar si cambia el número de días/ejercicios/comidas).
- **Costo:** una llamada Haiku por (plan, idioma) la primera vez; cacheado después. Aceptable.
- **`meal_plans.meals` shape:** confirmar la forma exacta del JSONB (`days[].meals[]`) al implementar; el mapeo de campos de §5 asume el schema de `generate-meal-plan`.
