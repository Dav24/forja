# Perfil de salud: lesiones y condiciones médicas/alimenticias

## Origen

`docs/notas.txt` recoge feedback de usuarios reales que probaron la app en su fase actual de desarrollo. De los 16 puntos, este diseño cubre los que forman el cluster de "seguridad médica/nutricional":

- #4 — Opciones para lesiones musculares o generales.
- #6 — Qué necesitan las personas con bypass gástrico.
- #7 — Verificar contraindicaciones antes de armar la dieta.
- #8 — Enfermedades y condiciones (diabetes, etc.).
- #14 — Ejercicios de rehabilitación o para lesionados.

Fuera de este diseño (con hilo propio o resuelto):
- #5 (límites/microtransacciones) — resuelto, ver `credit_packs_feature`.
- #10 (detectar si algo le hace daño al usuario) — se deja al motor de feedback post-sesión (`adaptive_plan_feedback_feature`), que ya tiene un override de seguridad para "dolor". No se duplica aquí.
- #13 (ranking de entrenamiento) — brainstorming propio en curso, ver `adaptive_plan_feedback_feature`.
- #15 (animaciones de ejercicios) — resuelto con catálogo MoveKit.
- Contexto del chat sobre el plan activo (hallazgo nuevo, no estaba en las notas: hoy Vulcano no sabe qué toca hoy en el plan de entrenamiento ni en la dieta) — **diferido a un hilo futuro propio**, es un subsistema independiente (lectura de `workout_plans`/`meal_plans` activos + cálculo de "qué día es hoy").

## Hallazgos de exploración de código (confirmados)

- `food_preferences` (migración `0012_nutrition_preferences.sql`) ya existe: `user_id`, `item` (texto libre), `kind` (`allergy`|`dislike`), consumida hoy por `generate-meal-plan`. Vive en `app/(app)/settings/food-preferences.tsx`, con patrón de chips CRUD.
- `generate-plan/index.ts` ya tiene un parámetro `injuries` en el prompt (línea ~148), pero está **muerto**: siempre llega `''` porque ningún cliente lo envía nunca.
- No existe ninguna tabla ni columna para condiciones médicas, bypass gástrico, ni severidad de lesión. Confirmado con grep exhaustivo sobre todas las migraciones.
- `exercise_catalog` (migración `0011_exercise_catalog.sql`) tiene columnas `primary_muscle` y `movement_pattern` que hoy **no se piden** en el `select` de `generate-plan` (solo se pide `slug, name_es, name_en, equipment`) — se pueden aprovechar para un filtro determinista sin inventar taxonomía nueva.
- `generate-plan` arma el catálogo completo de ejercicios como texto (`catalogBlock`) y se lo pasa a Claude para que elija slugs — es decir, **filtrar el catálogo antes de construir el prompt bloquea físicamente** que Claude elija un ejercicio excluido.
- `chat/index.ts` construye un `userContextBlock` desde `goals`/`profiles`/plan activo — hoy no lee `food_preferences` ni `injuries`, así que Vulcano no tiene visibilidad de alergias ni lesiones en absoluto.
- Editar Ajustes → Mi entrenamiento (objetivo, nivel, disciplina) hoy **no** dispara regeneración automática de ningún plan — solo invalida queries de caché (`queryClient.invalidateQueries`). Este es el patrón base que se respeta para usuarios free.
- El blueprint tiene una regla no negociable: el coach de IA nunca debe dar diagnósticos médicos, siempre derivar a un profesional (`pertraineer-blueprint.md:457,1366,1381`). Este diseño debe respetarla en los tres puntos de contacto (chat, generate-plan, generate-meal-plan).

## Modelo de datos

Dos tablas nuevas, con RLS estándar (usuario solo lee/escribe sus propias filas, mismo patrón que `food_preferences`):

```sql
create table injuries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  body_area text not null check (body_area in (
    'rodilla','hombro','espalda_baja','cadera','tobillo','muñeca','cuello','otro'
  )),
  severity text not null check (severity in ('leve_moderada','severa_estructural')),
  notes text,
  created_at timestamptz not null default now()
);

create table medical_conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  condition text not null check (condition in (
    'diabetes','hipertension','bypass_gastrico','embarazo','enfermedad_renal','otro'
  )),
  notes text,
  created_at timestamptz not null default now()
);
```

`food_preferences` no cambia de esquema — solo cambia dónde vive en la UI (ver más abajo).

**Por qué dos tablas y no una:** `injuries` necesita el campo `severity`, que activa el filtro determinista en `generate-plan`. `medical_conditions` no lo necesita — siempre es solo-prompt (no existe un catálogo fijo de comidas que filtrar mecánicamente, a diferencia de ejercicios). Compartir una tabla forzaría un campo `severity` sin sentido en la mitad de las filas.

`notes` en ambas tablas se sanea igual que `modality_goal_notes` (`.slice(0,200).replace(/[^\w\s,áéíóúñü.]/gi,'')`) antes de entrar a cualquier prompt.

Dos flags nuevos en `profiles` para controlar el aviso único a usuarios free (ver sección de comportamiento free/premium):
- `seen_health_profile_hint_workout boolean not null default false`
- `seen_health_profile_hint_meal boolean not null default false`

## Onboarding

Nuevo paso opcional `app/(auth)/onboarding/step-6-health.tsx`, mismo molde que `step-5-athletic.tsx`: botón "Omitir" visible, no bloquea `finishOnboarding()`.

- Se agrega `'step-6-health'` al array `STEPS` en `_layout.tsx` (la barra de progreso se recalcula sola).
- Requiere bump manual de `total: 6` en los `t('layout.stepOf', { current, total: 5 })` de los 5 steps existentes (son literales por archivo, no se derivan del array).
- Contenido: chips de zona de lesión (`body_area`) + chip de severidad + campo de notas libres (reutiliza `Chip`, `GroupCard`, `FieldLabel` del patrón de `goal_branches_feature`); debajo, chips de condición médica (`condition`) + notas libres. Ambos bloques opcionales de forma independiente.
- Strings nuevas en `locales/{es,en}/onboarding.json`.

## Ajustes

La fila actual "Alimentación" en `groupAccount` (`app/(app)/settings/index.tsx`) se **reemplaza** por una nueva fila (nombre de trabajo: "Lesiones y limitaciones alimenticias" — se afina la copy exacta al implementar) que navega a una pantalla intermedia con dos botones:

1. **"Lesiones y problemas musculares"** → pantalla de edición de `injuries` (chips de zona + severidad + notas, mismo patrón CRUD que `food-preferences.tsx` hoy).
2. **"Alergias y limitaciones alimenticias/médicas"** → pantalla que **fusiona** el contenido actual de `food-preferences.tsx` (alergias/dislikes) con la edición de `medical_conditions` (chips + notas). La pantalla standalone actual de "Alimentación" desaparece del menú principal; su contenido se mueve aquí.

**Guardia de cambios sin guardar:** en ambas pantallas de edición, si el usuario intenta salir (back) con cambios sin confirmar, se muestra un `Alert` — "¿Quieres descartar los cambios?" — con opción de descartar (vuelve al hub) o seguir editando.

## Comportamiento free vs. premium

**Free:** guardar cambios en cualquiera de las dos pantallas **no regenera nada automáticamente** — mismo patrón que hoy con objetivo/nivel/disciplina (solo invalida caché). La primera vez que el usuario genera cada tipo de plan, se muestra un aviso único no bloqueante:

- Primera generación de plan de entrenamiento: *"Plan creado. Podrás modificar tus lesiones en Ajustes para tu próximo plan de entrenamiento."*
- Primera generación de plan alimenticio: *"Plan creado. Podrás modificar tu perfil médico en Ajustes para tu próximo plan alimenticio."*

Controlado por `profiles.seen_health_profile_hint_workout` / `..._meal` — una vez mostrado, no se repite.

**Premium:** al guardar/confirmar cambios en cualquiera de las dos pantallas, se dispara automáticamente la regeneración del plan correspondiente:

- Cambios en "Lesiones" → regenera `generate-plan`.
- Cambios en "Alergias y limitaciones" → regenera `generate-meal-plan`.

Se muestra una animación de espera ("trabajando en tu plan de entrenamiento/alimenticio...") y al terminar, confirmación ("¡Tu plan se actualizó!"). Sin costo de crédito: premium ya genera planes ilimitados (`PREMIUM_LIMITS`), esto no es una llamada extra fuera de ese cupo.

## Consumo en las Edge Functions

**`generate-plan`:** antes de construir `catalogBlock`, se lee `injuries` del usuario.
- Si existe alguna fila con `severity='severa_estructural'`: se amplía el `select` de `exercise_catalog` para incluir `primary_muscle`/`movement_pattern`, y se filtran del catálogo (antes de armar el prompt) los ejercicios que cargan la zona afectada — ej. rodilla severa excluye ejercicios con `primary_muscle` de cuádriceps/isquiotibiales/glúteo y `movement_pattern` squat/lunge/jump. Claude no puede elegir lo que no está en la lista que recibe.
- Si solo hay `severity='leve_moderada'`: no se filtra el catálogo; se agrega una línea de instrucción al prompt, mismo tono que alergias hoy ("prioriza bajo impacto en [zona], evita [movimientos] pesados o de alto impacto").
- El parámetro `injuries` legacy (hoy siempre `''`) se reemplaza por esta lectura real de la tabla nueva.

**`generate-meal-plan`:** se agrega lectura de `medical_conditions` junto al `food_preferences` existente, inyectadas al prompt con el mismo framing de seguridad que alergias ("NUNCA sugerir/considerar alimentos o enfoques contraindicados para esta condición"). No se restringe `diet_type` en la UI — no existe un catálogo fijo de comidas que filtrar mecánicamente como en ejercicios, y restringir opciones daría la impresión de que el sistema "diagnostica" qué dieta es válida.

**`chat`:** se agrega `injuries` + `medical_conditions` al `userContextBlock` (hoy solo lee goals/profiles/plan activo).

**Guardrail transversal (las 3 EFs):** el system prompt de cada una debe enmarcar esta información siempre como contexto a respetar, nunca como algo a evaluar o diagnosticar. El chat ya tiene la línea explícita "nunca dar diagnósticos, tratamientos o prescripciones — siempre derivar al médico" (línea ~110); las tres EFs deben mantener ese framing de forma consistente.

## Fuera de alcance (diferido explícitamente)

- Contexto del chat sobre el contenido del plan activo del día ("qué toca hoy") — hilo futuro propio.
- Punto #10 de las notas (detectar si algo daña al usuario durante el entrenamiento) — cubierto por el override de "dolor" en `adaptive_plan_feedback_feature`.
- Restricción mecánica de `diet_type` por condición médica — se decide explícitamente no construirla (ver sección de EFs).
- Taxonomía de ejercicios "adaptados"/de bajo impacto para discapacidades permanentes (ej. catálogo específico para silla de ruedas) — el filtro determinista de este diseño excluye del catálogo existente, no genera contenido nuevo adaptado. Si el catálogo resultante queda muy limitado para un caso severo, eso es aceptado — es preferible a generar algo inseguro.
