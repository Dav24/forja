# Pulido: restyle de auth/onboarding + vista de entrenamiento + integridad de registro — Design Spec

**Fecha:** 2026-07-15
**Estado:** Aprobado en brainstorming
**Contexto:** Mini-proyecto de pulido post-Fase D, pre-Fase E del rediseño "Forja Atlética" (ver `redesign_claude_design.md`). Dos hilos independientes en código, agrupados en una sola spec/plan/SDD siguiendo el mismo patrón usado en Fases B/C/D.

## 1. Objetivo y alcance

- **Dentro:**
  1. Restyle de `app/(auth)/` (login, registro, recuperar contraseña, 5 pasos de onboarding) para usar el sistema de diseño ya construido en Fases A-D: `useTheme()`, tipografía de `constants/typography.ts`, íconos `Ionicons` — quitando todos los emojis.
  2. Reestructura de la vista de detalle de entrenamiento: la lista de 7 días pasa a ser un overview con tipografía elevada; tocar un día navega a una pantalla nueva dedicada con el día en grande (fiel a la spec v7 original y al prototipo).
  3. Integridad de datos en `exercise_logs`: confirmación antes de guardar en un día que no es hoy; sobreescritura (no duplicado) al re-guardar el mismo ejercicio/día dentro del mismo día calendario, preservando el historial de semanas anteriores.
- **Fuera:** cualquier cambio a `app/(app)/settings/training.tsx` (consume las mismas constantes `GOALS`/`MODES`/`MODALITIES` con emojis, pero está fuera del alcance que pidió el usuario — queda como inconsistencia conocida y diferida, ver §6); rediseño del `ExerciseSheet` en sí (Fase C, sin cambios salvo la nueva prop `isToday`); Fase E (compartir).

## 2. Hilo 1 — Restyle de `app/(auth)/`

### 2.1 Archivos afectados

`login.tsx`, `register.tsx`, `forgot-password.tsx`, `onboarding/_layout.tsx`, `onboarding/step-1-goals.tsx`, `onboarding/step-2-modality.tsx`, `onboarding/step-3-body.tsx`, `onboarding/step-4-level.tsx`, `onboarding/step-5-athletic.tsx`.

### 2.2 Reemplazo de emojis por íconos

`constants/goals.ts` (`GOALS`, `MODES`) y `constants/modalities.ts` (`MODALITIES`) ganan un campo nuevo `iconName` (nombre de `Ionicons`), **sin tocar el campo `icon` (emoji) existente** — ese campo se queda intacto porque `app/(app)/settings/training.tsx` lo sigue consumiendo (fuera de alcance, ver §1). Los 5 pasos de onboarding migran de `{item.icon}` (texto emoji) a `<Ionicons name={item.iconName} size={...} color={...} />`, usando `colors.primary`/`colors.text` según el estado seleccionado (mismo patrón de color condicional que ya usan hoy con el emoji).

Los checkmarks de selección (`✓` como texto plano, ya usados en los 4 pasos existentes) se reemplazan por `<Ionicons name="checkmark" size={14} color={colors.background} />` dentro del mismo círculo relleno que ya envuelve el check hoy — solo cambia el símbolo interior, no el contenedor.

El `📬` de `register.tsx` (pantalla "revisa tu correo") se reemplaza por `<Ionicons name="mail-outline" size={...} color={colors.primary} />`.

`forgot-password.tsx` además migra sus `TextInput`/`TouchableOpacity` crudos a `components/ui/Input`/`components/ui/Button` (los mismos componentes que ya usan `login.tsx`/`register.tsx`), por consistencia — hoy es el único de los tres que no los usa.

### 2.3 Tipografía

Los títulos de pantalla (`text-3xl font-bold` genérico de Tailwind) pasan a `fontFamily: 'BebasNeue-Regular'` con el tamaño de `typography.sizes.screenTitle` (34) o `display` (40) según la pantalla — mismo criterio que ya usan los títulos de `app/(app)/*` (p. ej. `workout/[id].tsx` usa Bebas 30 para el título del plan). Los subtítulos/preguntas pasan de `font-semibold text-base` a `SpaceGrotesk-SemiBold`/`Inter-Medium` según sean encabezados de sección o texto de acompañamiento — replicando el patrón ya usado en `app/(app)/settings/training.tsx` (`SectionTitle` con `SpaceGrotesk-Bold`).

## 3. Hilo 2 — Vista de entrenamiento

### 3.1 Reestructura de rutas

`app/(app)/plans/workout/[id].tsx` (archivo) se convierte en `app/(app)/plans/workout/[id]/index.tsx` (carpeta) — mismo contenido de query/lógica, misma URL resuelta (`/plans/workout/:id`, confirmado que ningún caller (`app/(app)/plans/index.tsx`, `app/(app)/index.tsx`, `hooks/useWorkoutPlan.ts`) necesita cambios porque todos navegan por string interpolado, no por referencia de archivo). Se agrega `app/(app)/plans/workout/[id]/day/[dayNumber].tsx` como ruta nueva.

### 3.2 Pantalla de overview (`[id]/index.tsx`)

Se mantiene la lista de 7 días, pero dejan de expandirse in-place: `onPress` de cada día pasa de `setExpandedDay(...)` a `router.push(`/(app)/plans/workout/${id}/day/${day.day_number}`)`. Se elimina el estado `expandedDay`, el bloque JSX de ejercicios expandidos (líneas 275-340 del archivo actual), y el ícono chevron up/down (ya no hay expansión). El header de cada día (`dayLabel`, hoy `BebasNeue-Regular` 19px) sube a 22px (`typography.sizes.h2`) para dar más presencia a la fila, ya que ahora es el único contenido visible de la card (sin acordeón debajo).

`ExerciseSheet`/`activeExercise`/`exerciseSheetRef` se eliminan de esta pantalla — se mueven a la pantalla de detalle (§3.3), que es donde ahora se tocan ejercicios.

### 3.3 Pantalla de detalle (`[id]/day/[dayNumber].tsx`)

Nueva pantalla. Lee `id`/`dayNumber` de `useLocalSearchParams`, reutiliza la query `['workout_plan', id]` (mismo `queryFn` que la pantalla de overview — cache tibia, sin round-trip nuevo a Supabase en el caso común de navegar desde el overview) para obtener `plan`/`schedule`, localiza el día con `schedule.find(d => d.day_number === Number(dayNumber))`.

Estructura:
- Header con back button (igual patrón que el resto de pantallas push).
- Número de día en grande: `fontFamily: 'BebasNeue-Regular'`, `fontSize: typography.sizes.display` (40) — el "número gigante" de la spec v7 original.
- Focus del día como statement debajo, `SpaceGrotesk-Bold`, `typography.sizes.h1` (28).
- Chips de metadata (número de ejercicios, minutos estimados) — mismo componente/estilo que ya existe en el header de cada día del overview.
- Lista de ejercicios del día, cada fila envuelta en `<StaggerIn index={i}>` (mismo componente que ya usa el resto del rediseño para entradas escalonadas) — mismo contenido de fila que existe hoy (número de orden, nombre, chips de sets×reps/descanso, ícono play, técnica), sin cambios de contenido, solo el wrapper de animación nuevo.
- Al tocar una fila: abre `ExerciseSheet` (mismo componente de Fase C), que se monta en esta pantalla con una prop nueva `isToday` (ver §3.4).

`isToday` para esta pantalla se calcula una vez con la misma lógica que existía en el overview (`day.day_number === 7 ? 0 : day.day_number` comparado contra `new Date().getDay()`), ya que `day_number` usa 1=Lunes...7=Domingo mientras `Date.getDay()` usa 0=Domingo...6=Sábado.

### 3.4 `ExerciseSheet` — confirmación en día no-actual

`ExerciseSheetProps` gana `isToday: boolean` (requerido, pasado desde la pantalla de detalle). Dentro de `handleSave`, si `!isToday`, se muestra `Alert.alert` con dos botones (`Cancelar` / `Confirmar`) **antes** de llamar `logSets(...)` — el guardado solo procede si el usuario toca `Confirmar`. Si `isToday` es `true`, el flujo de guardado es idéntico al actual (sin alert). Esto no bloquea ABRIR la ficha ni ver el video/técnica de un día no-actual, solo el acto de persistir series.

## 4. Integridad de datos — migración `0013`

### 4.1 Columna nueva y unicidad

```sql
alter table exercise_logs add column log_date date not null default current_date;

create unique index exercise_logs_identity_idx
  on exercise_logs(user_id, workout_plan_id, day_number, exercise_order, set_number, log_date);
```

`log_date` es la fecha calendario REAL en la que se registra la serie (calculada en el cliente con la hora local del usuario, no `recorded_at` que es solo el timestamp técnico de inserción/actualización). El `default current_date` es solo una red de seguridad server-side — el cliente SIEMPRE lo manda explícito.

**Por qué esto resuelve el problema sin romper el historial:** la identidad de "mismo registro" pasa a ser `(usuario, plan, día-de-la-semana, ejercicio, serie, fecha-calendario-real)`. Guardar el Martes de esta semana y luego el Martes de la semana que sigue son `log_date` distintos → filas distintas → el historial de progresión (que ordena por `recorded_at` a través del tiempo) se preserva íntegro. Solo colisiona (y por tanto sobreescribe) si literalmente el mismo día calendario se vuelve a guardar el mismo ejercicio/día/serie — exactamente el caso de "abrí la ficha dos veces por error" o "corregí un dato mal tecleado", que es el único caso que se quiere sobreescribir.

### 4.2 Cliente: `insert` → `upsert`

`hooks/useExerciseLogs.ts`, `useLogExerciseSets`: `LogSetsInput` gana `logDate: string` (formato `YYYY-MM-DD`, calculado en `ExerciseSheet` con fecha local — `getFullYear`/`getMonth`/`getDate`, NO `toISOString().slice(0,10)`, que usa UTC y puede desfasarse cerca de medianoche). Cada fila del `insert` gana `log_date: input.logDate` y `recorded_at: new Date().toISOString()` explícito (Postgres no re-evalúa `default now()` en un `UPDATE`, así que sin este valor explícito una sobreescritura dejaría el `recorded_at` viejo del primer guardado, rompiendo el orden que usa la sparkline de progresión).

La llamada pasa de `.insert(rows)` a `.upsert(rows, { onConflict: 'user_id,workout_plan_id,day_number,exercise_order,set_number,log_date' })`.

## 5. Errores y casos límite

- **Datos de prueba preexistentes con duplicados reales**: como hoy no existe ningún constraint de unicidad en `exercise_logs`, es posible (aunque no confirmado) que ya existan filas duplicadas de pruebas anteriores (Fase C) que violarían el índice único nuevo al crearlo. El plan de implementación debe verificar esto con una query de conteo de duplicados ANTES de crear el índice, y si existen, resolverlos (conservar la fila con `recorded_at` más reciente, borrar las demás) como parte del mismo paso de migración — no silenciosamente, documentado en el reporte de esa tarea.
- **`isToday` con plan de una modalidad sin 7 días activos** (p. ej. planes con días de descanso): no cambia nada — `isToday` solo depende de `day_number` vs el día de la semana real, es independiente de si ese día es de descanso o no (los días de descanso no tienen ejercicios que loggear, así que el caso no aplica en la práctica).
- **Confirmación de día no-actual + candidato con valores default prellenados**: el `Stepper` de `ExerciseSheet` ya prellena con el último valor de progresión conocido (o 20kg/10 reps si no hay historial) — el alert de confirmación no cambia ese prellenado, solo añade el paso de confirmación antes de persistir. Si el usuario confirma sin haber tocado los steppers, se guardan esos valores prellenados tal cual (comportamiento ya existente, no una regresión nueva).

## 6. Fuera de alcance / diferido

- `app/(app)/settings/training.tsx` sigue usando `GOALS`/`MODES`/`MODALITIES` con el campo `icon` (emoji) — queda como inconsistencia conocida, no se toca en este mini-proyecto porque el usuario no lo mencionó como problema.
- El campo `icon` (emoji) de las constantes no se elimina, aunque quede sin uso en los archivos de `(auth)/` tras este cambio — eliminarlo rompería `training.tsx`.
- Cualquier mecanismo para editar/corregir manualmente un registro de un día calendario PASADO (hoy solo se puede "sobreescribir" el mismo día calendario en que se guardó por primera vez) — fuera de alcance, no se pidió.
