# Rediseño Fase D: Nutrición — swap de comida, disgustos persistidos, onboarding trayectoria/suplementos — Design Spec

**Fecha:** 2026-07-14
**Estado:** Aprobado en brainstorming
**Contexto:** Cuarta de 5 fases del rediseño congelado (spec v7 `2026-07-12-redesign-premium-design.md` §6.4, canvas v5/v6). Dos hilos independientes en código, agrupados en una sola spec/plan/SDD siguiendo el mismo patrón de Fases B y C (varias piezas por fase).

## 1. Objetivo y alcance

- **Dentro:**
  1. Persistir alergias y disgustos alimenticios (tabla `food_preferences`), reemplazando el formulario transitorio de alergias.
  2. Swap de una comida individual con preview antes de confirmar, límite semanal por tier.
  3. Onboarding paso 5 (opcional): trayectoria competitiva + suplementación declarada, alimentando `generate-plan` y `generate-meal-plan`.
- **Fuera:** compartir (Fase E), fotos de comida (pospuesto post-lanzamiento, v7 §pricing), edición de `diet_type`/`food_availability` persistidos (siguen siendo inputs transitorios del formulario de generación completa — el swap no los necesita, ver §3), cualquier forma de que la IA recomiende o dosifique sustancias (límite de seguridad explícito, ver §5).

## 2. Alergias y disgustos persistidos

**Hallazgo de la exploración de código:** hoy las alergias NO se persisten en ninguna tabla — son un campo transitorio de `app/(app)/plans/meal/index.tsx` que el usuario re-teclea cada vez que regenera el plan (`generate-meal-plan/index.ts:183` las sanitiza pero nunca las guarda). Esta fase corrige eso y agrega disgustos con la misma mecánica.

### 2.1 Tabla `food_preferences` (migración `0012`)

```sql
create table food_preferences (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references profiles(id) on delete cascade,
  item       text not null,
  kind       text not null check (kind in ('allergy', 'dislike')),
  created_at timestamptz not null default now(),
  unique (user_id, kind, item)
);

create index idx_food_preferences_user on food_preferences(user_id);

alter table food_preferences enable row level security;

create policy "users_select_own_food_preferences" on food_preferences
  for select using (auth.uid() = user_id);
create policy "users_insert_own_food_preferences" on food_preferences
  for insert with check (auth.uid() = user_id);
create policy "users_delete_own_food_preferences" on food_preferences
  for delete using (auth.uid() = user_id);
```

Sin política de `update`: para editar un item se borra y se vuelve a insertar (una fila por item, igual de simple que `body_data`). `unique(user_id, kind, item)` evita duplicados exactos sin necesitar lógica de deduplicación en el cliente — un insert duplicado simplemente falla con conflicto y el cliente lo ignora silenciosamente (ya existe, no es error visible al usuario).

### 2.2 UI de gestión

Nueva sección en Ajustes de cuenta: dos grupos de chips ("Alergias", "Disgustos"), cada uno con input de texto + botón agregar, y cada chip con una × para borrar. Reemplaza el formulario de alergias que hoy vive en `meal/index.tsx` (líneas 80-93 del archivo actual) — ese formulario se elimina de la pantalla de plan alimenticio.

Hook nuevo `hooks/useFoodPreferences.ts`:
- `useFoodPreferences()`: `useQuery` sobre `food_preferences` del usuario, separa en `{ allergies: string[], dislikes: string[] }`.
- `useAddFoodPreference()`: `useMutation` insert, invalida `['food_preferences']`.
- `useRemoveFoodPreference()`: `useMutation` delete por `id`, invalida `['food_preferences']`.

### 2.3 Consumo en `generate-meal-plan`

`generate-meal-plan/index.ts` deja de leer `allergies` del body de la request. En su lugar, hace un `select` a `food_preferences` del usuario (paralelo a las otras lecturas de perfil, línea ~187-194 actual) y arma dos listas para el prompt:

```
- Alergias/intolerancias (NUNCA sugerir): ${allergyItems.join(', ') || 'ninguna'}
- Disgustos declarados (evitar si es posible, no es un riesgo de seguridad): ${dislikeItems.join(', ') || 'ninguno'}
```

El body de la request a `generate-meal-plan` pierde el campo `allergies` (ya no lo envía el cliente); `diet_type`/`food_availability` se mantienen como están hoy (siguen siendo transitorios, fuera de alcance).

## 3. Swap de comida individual

### 3.1 Identidad de la comida a reemplazar

`meal_plans.meals` es un JSONB que contiene el objeto completo generado por la IA: `{ title, description, daily_calories, macros, days: [{ day_number, day_name, total_calories, meals: [...] }] }` (confirmado leyendo `generate-meal-plan/index.ts:289-296`: la columna `meals` guarda `planData` completo, no solo un array de comidas — el nombre de columna es confuso pero así está en producción, no se renombra en esta fase).

El swap identifica la comida por **`day_number` + `meal_index`** (índice posicional dentro de `days[i].meals[]`), no por `meal_type` (string). Mismo principio aplicado en Fase C con `exerciseIndex`: un campo de texto que la IA genera (aunque esté restringido a 5 valores fijos por el prompt) no es una identidad tan confiable como la posición estructural del array, que siempre existe y es única.

### 3.2 Edge Function `swap-meal` — dos acciones

Un solo archivo `supabase/functions/swap-meal/index.ts`, request `{ action: 'preview' | 'accept', meal_plan_id, day_number, meal_index, attempt_number, candidate? }`.

**`action: 'preview'`:**
1. JWT + RLS: lee `meal_plans` del usuario, verifica `is_active = true` y ownership.
2. Rechaza si `attempt_number > 3` (defensa adicional server-side — el límite real de UX vive en el cliente, esto es solo control de costo de IA barato de implementar; `attempt_number` empieza en 1 en el primer preview de una sesión de swap y el cliente lo incrementa en cada "Otra opción").
3. Localiza el día con `days.findIndex(d => d.day_number === day_number)` — **no** `days[day_number - 1]`: `day_number` es, igual que `meal_index` vs. el descartado `meal_type`, un campo que la IA genera; asumir que su valor coincide con la posición del array repetiría el mismo error que Fase D evita en la identidad de la comida. Dentro del día encontrado, indexa la comida con `meals[meal_index]` (ese sí es posición real de array, pasada por el cliente, no generada por la IA). 404 si el día no existe o `meal_index` está fuera de rango.
4. Lee `food_preferences` del usuario (mismo patrón que §2.3).
5. Arma prompt a Sonnet: la comida actual (para que la IA no proponga algo casi idéntico), las otras 4 comidas del mismo día (contexto de estilo/variedad del plan — evita necesitar persistir `diet_type` para el swap), alergias/disgustos, y el objetivo explícito: **calorías del reemplazo dentro de ±10% de la comida original**, mismo `meal_type`.
6. Devuelve el candidato `{ meal_type, time_suggestion, name, calories, protein_g, carbs_g, fat_g, ingredients }`. **No escribe en DB, no cuenta contra el límite semanal.**

**`action: 'accept'`:**
1. JWT + RLS: mismas verificaciones de ownership que preview.
2. Valida la forma de `candidate` con un validador de campos obligatorios y tipos (mismo espíritu que `translate-plan/logic.ts` — objetos con claves y tipos esperados, rechaza si falta algo o los tipos no cuadran):
   - `meal_type`: string no vacío.
   - `time_suggestion`: string no vacío.
   - `name`: string no vacío.
   - `calories`, `protein_g`, `carbs_g`, `fat_g`: número, `>= 0` (`calories` además `> 0`).
   - `ingredients`: array con al menos 1 elemento, cada uno string no vacío.

   Cualquier campo ausente, de tipo incorrecto, o fuera de estos rangos → `400 { error: 'invalid_candidate' }`, sin tocar DB. No se vuelve a llamar a Sonnet: `candidate` es exactamente lo que `preview` devolvió y el cliente hace eco de vuelta, así que aceptar es instantáneo (sin costo de IA).
3. Verifica el límite semanal ANTES de escribir: cuenta filas de `meal_swaps` del usuario con `created_at >= now() - interval '7 days'`; si no es premium y el conteo ya es `>= 3`, responde `429 { error: 'meal_swap_limit_reached' }` sin tocar el plan.
4. Reemplaza `days[day_number - 1].meals[meal_index]` con `candidate` dentro del JSONB completo (fetch → merge en JS del lado del EF → un solo `update`), y en la MISMA query **resetea `translations` a `'{}'`** — es el fix al gap real encontrado al explorar el código: `translations` no tiene ningún trigger que la invalide cuando cambia `meals`, así que sin este reset un usuario viendo el plan en otro idioma seguiría viendo la comida vieja traducida desde caché indefinidamente.
5. Inserta una fila en `meal_swaps` (auditoría + base del conteo del límite).
6. Invalida el plan activo del lado del cliente al volver (mismo patrón de `onSuccess` que `useLogExerciseSets`).

### 3.3 Tabla `meal_swaps` (parte de la migración `0012`)

```sql
create table meal_swaps (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references profiles(id) on delete cascade,
  meal_plan_id  uuid not null references meal_plans(id) on delete cascade,
  day_number    integer not null,
  meal_index    integer not null,
  old_meal_name text not null,
  new_meal_name text not null,
  created_at    timestamptz not null default now()
);

create index idx_meal_swaps_user_date on meal_swaps(user_id, created_at desc);

alter table meal_swaps enable row level security;

create policy "users_select_own_meal_swaps" on meal_swaps
  for select using (auth.uid() = user_id);
```

Sin políticas de insert/update/delete para el cliente: solo el EF (service role) escribe, igual que `exercise_catalog`. El conteo del límite semanal se hace server-side dentro del propio EF (paso 3.2.3), no expuesto como endpoint separado.

### 3.4 UI

Botón "Cambiar" (ícono swap) en cada tarjeta de `MealPlanCard`. Al tocar, abre un `Sheet` (mismo componente `components/ui/Sheet.tsx` usado en la ficha de ejercicio de Fase C) con estado de carga → candidato mostrado (nombre, kcal, macros, ingredientes) → tres botones: **Aceptar** (llama `accept`, cierra el sheet, refresca el plan), **Otra opción** (llama `preview` de nuevo con `attempt_number + 1`; deshabilitado y reemplazado por texto "elige una de las opciones anteriores" al llegar a 3 intentos), **Cancelar** (cierra sin persistir nada, sin costo). El botón "Cambiar" se oculta o muestra un badge de límite alcanzado si free y ya usó los 3 swaps de la semana (mismo patrón visual que `PaywallBanner`/límites existentes en `lib/limits.ts`, que gana dos constantes nuevas: `FREE_LIMITS.MEAL_SWAPS_PER_WEEK = 3` y `MEAL_SWAP_PREVIEW_ATTEMPTS_MAX = 3`).

## 4. Onboarding paso 5: trayectoria competitiva + suplementación

### 4.1 Columnas nuevas (parte de la migración `0012`)

```sql
alter table goals add column athletic_background text
  check (athletic_background is null or athletic_background in ('none', 'amateur', 'high_performance', 'bodybuilding'));

alter table profiles add column supplements text[] not null default '{}';
alter table profiles add column supplements_other text;
```

`supplements` guarda códigos de una lista fija: `creatine`, `protein`, `caffeine_preworkout`, `multivitamin`, `omega3`, `none`. `supplements_other` es texto libre corto (mismo saneo que alergias: `slice(0,200)` + regex de caracteres permitidos), solo se llena si el usuario marca "otro".

Ambas columnas son nullable/default vacío — usuarios existentes quedan con `athletic_background = null` y `supplements = '{}'`, ningún backfill.

### 4.2 Pantalla nueva `app/(auth)/onboarding/step-5-athletic.tsx`

Después del paso 4 actual (que ya escribe a Supabase — este paso 5 hace sus propios inserts al presionar "Finalizar", sin tocar la lógica de los 3 inserts existentes en el paso 4). Estructura:
- Chips de trayectoria competitiva (4 opciones, iconografía consistente con `GOALS`/`FITNESS_LEVELS` de `constants/goals.ts`).
- Chips multi-select de suplementación (6 opciones fijas + "otro" con input de texto corto que aparece al marcarlo).
- Botón "Omitir" visible siempre (este paso es explícitamente opcional) junto al de "Finalizar".
- Texto de seguridad visible bajo la sección de suplementos: *"Esto es solo contexto para tu coach — nunca te recomendaremos ni indicaremos dosis de sustancias."*

Al presionar Finalizar (o si el usuario no seleccionó nada y solo avanza): `update({ athletic_background, supplements, supplements_other }).eq('id', user.id)` — pero `athletic_background` vive en `goals`, no en `profiles`, así que es un `update` a la fila de `goals` recién insertada en el paso 4 (se necesita el `id` de esa fila, devuelto por el insert del paso 4 y pasado al store de onboarding para este paso). Al presionar "Omitir": navega directo sin ningún insert/update, dejando ambos campos en su default (null / `{}`).

### 4.3 Edición posterior en Ajustes

Sección nueva en Ajustes de cuenta (misma pantalla que §2.2) con los mismos controles que el paso 5, pre-poblados si ya existen valores. Sin modal ni banner forzado para usuarios existentes — puramente opt-in.

### 4.4 Consumo en los generadores

**`generate-plan`** (workout): lee `goals.athletic_background` (ya hace `select` sobre `goals` para `type`/`fitness_level`, se agrega la columna al mismo select) y `profiles.supplements`/`supplements_other`. Si `athletic_background` no es null, agrega al prompt:
```
- Trayectoria competitiva declarada: ${athleticBackgroundLabel} — ajusta el volumen/periodización si es relevante (p.ej. fisicoculturismo puede justificar mayor volumen de aislamiento).
```
Si `supplements` no está vacío:
```
- Suplementación declarada (SOLO contexto, ver regla de seguridad): ${supplementLabels.join(', ')}${supplements_other ? ', ' + supplements_other : ''}
```
Guardrail literal agregado a ambos prompts (`generate-plan` y `generate-meal-plan`), inmediatamente después de mencionar suplementos:
```
REGLA DE SEGURIDAD: el dato de suplementación es únicamente contexto (p.ej. no dupliques una recomendación de proteína si el usuario ya toma un shake). Bajo NINGUNA circunstancia recomiendes, apruebes, sugieras dosis, o valides el uso de sustancias o suplementos — ni en el plan generado ni en ninguna respuesta futura del chat sobre este tema.
```

**`generate-meal-plan`**: mismo patrón, agrega `athletic_background` (afecta timing/cantidad de comidas) y `supplements` (afecta macros objetivo, p.ej. ya cubre proteína con shake) al prompt existente, con el mismo guardrail literal.

Si ambos campos son null/vacíos, esa sección del prompt se omite por completo (no se manda "ninguno" ni texto vacío) — comportamiento idéntico al de un usuario que nunca completó el paso 5.

## 5. Errores y casos límite

- **Swap con plan inactivo o de otro usuario:** RLS ya lo bloquea (`is_active` + ownership), el EF responde 404 antes de llegar a Sonnet.
- **`accept` sin `preview` previo (candidato inventado por el cliente):** el validador de forma rechaza cualquier objeto que no tenga exactamente los campos esperados con los tipos esperados — no previene que un cliente modificado invente un candidato con forma válida pero contenido arbitrario, pero eso es equivalente en riesgo a cualquier otro dato de usuario que ya se persiste sin verificación de contenido (ingredientes/nombre de comida no son ejecutables, solo texto mostrado al propio usuario dueño del plan) — aceptado, mismo nivel de confianza que el resto de la app.
- **Traducción cacheada de un plan que tuvo un swap:** cubierto por el reset de `translations` en `accept` (§3.2.4) — la próxima vez que el usuario vea el plan en otro idioma, dispara una traducción nueva completa (mismo costo que la primera traducción de un plan nuevo).
- **Race entre dos swaps simultáneos del mismo plan:** last-write-wins (el segundo `update` sobrescribe con su propia copia recién leída de `meals`) — mismo nivel de protección de concurrencia que el resto de la app (ninguna feature existente usa locking optimista), aceptado como riesgo de bajo impacto (un usuario no suele hacer dos swaps a la vez desde dos dispositivos).
- **Usuario alcanza el límite de 3 intentos de preview sin aceptar ninguno:** puede Cancelar sin costo y volver a abrir el swap desde cero (nuevo conteo de intentos, sesión de swap nueva) — no cuenta contra el límite semanal (ese solo se descuenta en `accept`).

## 6. Fuera de alcance / diferido

- Rediseño del formulario de generación completa de plan (`meal/index.tsx` sigue generando el plan de 7 días de una sola vez, sin cambios en ese flujo más allá de dejar de mandar `allergies` en el body).
- Cualquier chat/conversación sobre dosis de suplementos — el guardrail de §4.4 cubre los prompts de generación; si en el futuro el chat necesita el mismo guardrail explícito, es una fase aparte (`chat/index.ts` ya tiene su propio system prompt, no tocado aquí).
- Traducción de los nuevos campos de swap — `meal_swaps.old_meal_name`/`new_meal_name` son solo auditoría interna, nunca se muestran al usuario.
