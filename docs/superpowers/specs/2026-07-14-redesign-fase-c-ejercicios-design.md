# Rediseño Fase C: Fichas de ejercicio + registro de carga — Design Spec

**Fecha:** 2026-07-14
**Estado:** Aprobado en brainstorming
**Contexto:** Tercera de 5 fases del rediseño congelado (spec v7 `2026-07-12-redesign-premium-design.md` §6.4). Fuente de animación **YA COMPRADA Y VERIFICADA**: MoveKit Full Library Pack ($789 MXN, licencia comercial perpetua sin límite de proyectos, confirmada por escrito en `movekit.com/licensing` — permite explícitamente "commercial products that generate revenue" y "mobile and web applications"; solo prohíbe revender el archivo crudo como paquete competidor o compartir los links de descarga públicamente, ninguna de las dos aplica a nuestro uso). Assets descargados en `assets-import/exercise-media/` (gitignorado, 878MB: 206 videos MP4, 206 posters WebP, `metadata.json`/`metadata.csv`).

## 1. Objetivo y alcance

Que tocar un ejercicio muestre su técnica animada real y permita registrar la carga por serie, alimentando una gráfica de progresión — cerrando el círculo que las Fases A/B dejaron con la figura placeholder.

- **Dentro:** import del catálogo MoveKit a Supabase Storage + tabla `exercise_catalog`; `generate-plan` seleccionando ejercicios del catálogo cuando exista match; ficha de ejercicio con video real + técnica + registro; tabla `exercise_logs`; sparkline de progresión.
- **Fuera:** swap/dislikes de comidas (Fase D), compartir (Fase E), onboarding de trayectoria competitiva/suplementación (fase 2 del prototipo, spec de implementación aparte), traducción del catálogo a otros idiomas más allá de es/en, `generate-meal-plan` (no aplica).
- **Fuente de datos verificada de MoveKit:** 206 ejercicios, campos `slug` (único, = nombre de archivo sin extensión), `name`, `primaryMuscles[]`, `secondaryMuscles[]`, `equipment[]` (Bodyweight 39, Band 12, Barbell 31, Cable Machine 25, Dumbbell 56, Kettlebell 23, Machine 20), `movementPattern[]` (Push/Pull/Squat/Hinge/Lunge/Isolation/Core/Mobility/Stretch/Plyometric/Carry/Rotation/Hip Abduction), `difficulty` (beginner/intermediate/advanced), `durationSeconds`, `instructions[]` (pasos, inglés). **No cubre cardio puro, ciclismo, natación ni deportes de balón** — esperado y aceptado (spec v7 §6.4); esos ejercicios se generan sin `exercise_slug` y la ficha se degrada a solo-texto.

## 2. Calibración (respuestas del usuario)

- **Selección IA:** catálogo COMPLETO siempre en el prompt de `generate-plan` (no filtrado por modalidad) — decisión explícita para no perder usuarios de "cardio + pesas" o calistenia mixta: el match es **por ejercicio individual**, no por modalidad del plan. Un plan de "funcional" puede tener 3 ejercicios con match (kettlebell, banda, core bodyweight) y 2 sin match (sprints) en el mismo día — ambos casos conviven.

## 3. Catálogo (`exercise_catalog`, migración `0011`)

Tabla nueva, poblada UNA vez por script de importación (no se re-genera en cada request):

```
slug            text primary key        -- = nombre de archivo MoveKit, p.ej. 'band-high-face-pull'
name_en         text not null
name_es         text not null           -- traducido UNA vez al importar (Haiku, mismo patrón que translate-plan)
primary_muscle  text not null           -- primaryMuscles[0] del JSON (simplificado a 1 campo, suficiente para filtrar/mostrar)
equipment       text not null           -- equipment[0] del JSON ('Bodyweight'|'Band'|'Barbell'|'Cable Machine'|'Dumbbell'|'Kettlebell'|'Machine')
movement_pattern text not null          -- movementPattern[0] del JSON
difficulty      text not null           -- 'beginner'|'intermediate'|'advanced'
instructions_es text[] not null         -- instructions[] traducido UNA vez al importar
video_url       text not null           -- Supabase Storage público, bucket exercise-media
poster_url      text not null           -- idem
created_at      timestamptz not null default now()
```

RLS: lectura pública para `authenticated` (es catálogo compartido, no dato de usuario) — sin políticas de escritura de cliente, solo el script de import (service role) escribe.

Bucket `storage.buckets` nuevo `exercise-media` (público, `public: true`), mismo patrón que `avatars` (migración `0008_avatars_bucket.sql`): política de lectura pública, sin política de escritura de usuario (solo service role sube).

## 4. Script de importación (una sola corrida, no Edge Function)

Script Node/Deno local (`scripts/import-exercise-catalog.mjs` o similar) que: lee `assets-import/exercise-media/full-library-metadata/metadata.json`, para cada entrada sube su MP4+WebP al bucket `exercise-media` (usando la service role key), traduce `name`+`instructions` a español con UNA llamada a Haiku por ejercicio (206 llamadas totales, costo bajo, corrida única — reutiliza el patrón de prompt de `translate-plan` pero para texto plano, no JSON estructurado), e inserta la fila en `exercise_catalog`. Idempotente: `ON CONFLICT (slug) DO UPDATE` para poder re-correr si se interrumpe.

## 5. `generate-plan`: selección de catálogo

El prompt de `buildPlanPrompt` recibe un bloque nuevo con los 206 ejercicios en formato compacto (`slug|name_es|equipment`, ~3-4k tokens) y esta instrucción:

> "Tienes disponible un catálogo de ejercicios con animación real (lista abajo). **Para cada ejercicio del plan, revisa primero si existe una coincidencia real en el catálogo** (mismo movimiento, aunque el nombre no sea idéntico) — si existe, usa exactamente ese `slug` en el campo `exercise_slug` y usa su nombre. Si el ejercicio es específico de cardio, running, ciclismo, natación o deporte de balón y NO tiene equivalente en el catálogo, escríbelo libremente y deja `exercise_slug` en null. Nunca fuerces un match falso."

Cada exercise del JSON de salida gana el campo `exercise_slug: string | null` (además de los campos actuales `order, name, muscle_group, sets, reps, rest_seconds, technique_notes`). El JSON Schema del prompt (FORMATO JSON REQUERIDO) se actualiza para incluirlo. Sin cambios en `generate-meal-plan`.

## 6. Ficha de ejercicio (cliente)

Ya prototipada en v7 (`docs/superpowers/prototypes/forja-atletica.html`, sheet de ejercicio) — esta fase reemplaza el placeholder de figura por datos reales:

- **Con `exercise_slug`:** fetch de la fila de `exercise_catalog` por slug; video MP4 en loop (componente de video de Expo, no GIF — mejor relación calidad/peso) con el `poster_url` como imagen mientras carga; `instructions_es` como lista de claves de técnica (reemplaza las claves fijas del prototipo).
- **Sin `exercise_slug`:** misma ficha sin la sección de video; solo `technique_notes` que ya escribe la IA (si los trae) y el registro de carga si aplica.
- **Registro de carga adaptativo** (ya prototipado: steppers ±2.5/±1 + valor tecleable con snap): tipo de registro derivado de `equipment` del catálogo — `'Bodyweight'` → reps + lastre opcional; cualquier otro equipment → kg + reps; `movement_pattern` en `('Mobility','Stretch')` → sin registro. Para ejercicios SIN `exercise_slug` (cardio/deporte sin match), tampoco hay registro estructurado en esta fase (quedan como texto informativo).

## 7. `exercise_logs` (migración `0011`, misma que el catálogo)

```
id                    uuid primary key default gen_random_uuid()
user_id               uuid not null references auth.users(id) on delete cascade
workout_plan_id       uuid not null references workout_plans(id) on delete cascade
day_number            int not null
exercise_order        int not null      -- coincide con "order" del JSON de schedule
exercise_slug         text null         -- FK lógica a exercise_catalog.slug (no FK real: catálogo puede crecer/cambiar); null si el ejercicio no tiene match
set_number            int not null
kg                    numeric null
reps                  int null
bodyweight_lastre_kg  numeric null
recorded_at           timestamptz not null default now()
```

RLS: usuario solo ve/escribe sus propias filas (`user_id = auth.uid()`), patrón estándar del proyecto.

**Por qué no hay FK relacional al ejercicio:** `workout_plans.schedule` vive en JSONB (decisión ya tomada en pasos anteriores del proyecto) — no existe una tabla de "ejercicios del plan" con PK propia. El registro referencia por la tupla `(workout_plan_id, day_number, exercise_order)`, exactamente como el cliente ya localiza el ejercicio dentro del JSON hoy.

**Sparkline de progresión:** consulta `exercise_logs` filtrando por `exercise_slug` (no por `workout_plan_id`) a través del tiempo — así la gráfica tiene sentido histórico aunque el usuario regenere el plan y el mismo ejercicio aparezca en un plan nuevo con otro `workout_plan_id`. Para ejercicios sin slug, no hay sparkline (consistente con "sin registro estructurado").

## 8. Verificación

- `tsc --noEmit` + `check-i18n` limpios; tests Deno existentes intactos.
- Script de import corrido una vez contra Supabase local: 206 filas en `exercise_catalog`, 412 archivos en el bucket `exercise-media`, verificable por conteo.
- `generate-plan` real: un plan generado debe traer AL MENOS un `exercise_slug` no nulo si el perfil es de gym/fuerza/calistenia (verificación E2E con curl, como en fases anteriores).
- E2E humano (Expo Go): abrir un ejercicio con match → video real reproduciéndose en loop; abrir uno sin match (si el plan es de running/fútbol) → ficha sin video, con fallback correcto; registrar 3 series de un ejercicio de barra → steppers correctos, unidad kg; registrar uno de bodyweight → unidad reps+lastre; sparkline aparece tras 2+ registros históricos del mismo slug.

## 9. Riesgos conocidos

- **Costo de importación:** 206 llamadas a Haiku (traducción) + 412 subidas a Storage — corrida única, de minutos, costo de céntimos. Sin riesgo recurrente.
- **Prompt de `generate-plan` crece ~3-4k tokens** por el catálogo — costo incremental pequeño con Sonnet, aceptado (mismo criterio que llevó a ExerciseDB con catálogo completo en vez de filtrado).
- **Falsos negativos de match:** la IA puede no encontrar match para un ejercicio que sí existe en el catálogo con nombre distinto — degradación aceptable (queda como texto sin animación, no rompe nada). No hay falsos positivos forzados porque el prompt lo prohíbe explícitamente.
- **Video vs GIF:** decisión de usar MP4 en loop nativo (mejor calidad/peso que convertir a GIF); requiere confirmar en implementación qué componente de video usa el proyecto (o instalar uno, vía `npx expo install`).
