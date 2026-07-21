# Feedback adaptativo de plan — Design Spec

**Fecha:** 2026-07-20
**Estado:** Aprobado en brainstorming
**Contexto:** Nota 13 de las "notas de Sergio" (`docs/notas.txt`) decía solo "ranking de entrenamiento" — nombre engañoso, aclarado por el usuario en brainstorming: NO es un leaderboard ni gamificación. Es un sistema de feedback subjetivo post-sesión (estilo RPE, privado, sin compartir a otros usuarios) para que Vulcano haga el plan de entrenamiento adaptativo de verdad, en vez de una elección estática (`TrainingMode` `flexible`/`strict` en `constants/goals.ts`, hoy fijada una sola vez en onboarding). Verificado en exploración de código: no existe ningún mecanismo de feedback subjetivo hoy (`exercise_logs` solo guarda carga objetiva), pero sí existe infraestructura muerta pensada para esto — `workout_plans.modifications_count` y `FREE_LIMITS.WORKOUT_PLAN_MODIFICATIONS_PER_MONTH=3` (`lib/limits.ts`) nunca fueron conectados a nada. Esta spec los revive. Diseño completo acordado en brainstorming, memoria de sesión en `adaptive_plan_feedback_feature.md`.

## 1. Objetivo y alcance

- **Dentro:**
  1. Captura de feedback post-sesión (obligatoria: escala de dificultad + chips de problema; opcional: comentario libre + flags por ejercicio), disparada por un botón "Finalizar entrenamiento" bloqueado hasta registrar todos los ejercicios del día.
  2. Motor de decisión server-side: gate de necesidad (¿el avance real está comprometido?) → split determinista/IA → aplicación del ajuste, ligado al historial del plan activo (nunca empieza de cero).
  3. Diferenciación free/premium: free siempre pide aprobación y tiene tope de 3 ajustes/plan (reusa `modifications_count`), premium puede optar por auto-ajuste silencioso.
  4. Integración con el ledger de créditos ([[credit_packs_feature]]) para ajustes free más allá del tope.
  5. Dos `PayloadKind` nuevos en `send-notifications` para avisar de sugerencias/ajustes aplicados.
  6. Guardrails de seguridad: nunca diagnosticar, camino de dolor siempre con aprobación manual sin excepción de tier, incluso con auto-ajuste activo.
- **Fuera (hilos propios, diferidos explícitamente por el usuario):**
  - Mecanismo real de sustitución de ejercicio (`swap-exercise`: EF, preview IA, límites, UI) — el camino de dolor de esta spec solo llega hasta "marca que requiere sustitución" y deja el gancho listo; el swap en sí y también la nota 16 (alternativas por equipo no disponible) se diseñan después, como un solo proyecto que cubre ambos disparadores.
  - Fotos de progreso diarias (cámara, sección Progreso) — mencionadas de pasada durante el brainstorming, sin relación mecánica con este motor más allá de compartir la regla "ausencia no dispara nada, solo recordatorio".
  - Regeneración completa de plan nueva (`generate-plan`) — sigue intacta, sin cambios; este motor solo hace ajustes incrementales sobre el plan activo.

## 2. Datos — Migración `0016`

```sql
-- Feedback adaptativo de plan: captura post-sesión + historial de ajustes

CREATE TABLE session_feedback (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number       INT NOT NULL,
  log_date         DATE NOT NULL,
  difficulty_rating TEXT NOT NULL CHECK (difficulty_rating IN ('muy_facil','facil','justo','dificil','muy_dificil')),
  problem_tags     TEXT[] NOT NULL DEFAULT '{}',
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX session_feedback_identity_idx
  ON session_feedback(user_id, workout_plan_id, day_number, log_date);

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_feedback_owner_select" ON session_feedback
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "session_feedback_owner_insert" ON session_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Sin UPDATE/DELETE: una sesión reporta una vez (el índice único ya lo
-- fuerza), es un registro histórico inmutable, igual que exercise_logs
-- antes de necesitar upsert por reintentos de carga/reps.

CREATE TABLE exercise_feedback (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number       INT NOT NULL,
  exercise_order   INT NOT NULL,
  log_date         DATE NOT NULL,
  flag             TEXT NOT NULL CHECK (flag IN ('facil','dificil')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX exercise_feedback_identity_idx
  ON exercise_feedback(user_id, workout_plan_id, day_number, exercise_order, log_date);

ALTER TABLE exercise_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercise_feedback_owner_select" ON exercise_feedback
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "exercise_feedback_owner_insert" ON exercise_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE plan_adjustments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number       INT NOT NULL,
  exercise_order   INT,                      -- null = ajuste no ligado a un ejercicio puntual
  source           TEXT NOT NULL CHECK (source IN ('deterministic','ai')),
  reason_tag       TEXT NOT NULL,            -- 'progresion_facil'|'progresion_dificil'|'molestia_bajar_carga'|'molestia_pausar'|'molestia_requiere_sustitucion'
  before_snapshot  JSONB NOT NULL,
  after_snapshot   JSONB NOT NULL,
  applied_by       TEXT NOT NULL CHECK (applied_by IN ('auto','user_approved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX plan_adjustments_plan_idx ON plan_adjustments(workout_plan_id, created_at);

ALTER TABLE plan_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plan_adjustments_owner_select" ON plan_adjustments
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Sin policy de INSERT para `authenticated`: solo la EF (service role,
-- bypassea RLS) escribe aquí — mismo criterio que exercise-media bucket.
-- El usuario nunca inserta su propio "ajuste aplicado" directo.

ALTER TABLE profiles ADD COLUMN auto_adjust_enabled BOOLEAN NOT NULL DEFAULT false;
```

No hace falta ninguna RPC nueva de créditos — `consume_credit`/`get_credit_balance` ya existen (`0015_credit_ledger.sql`) y aceptan un `p_action` de texto libre; se reusan tal cual con `p_action := 'plan_adjustment'`.

`modifications_count` (`workout_plans`, hoy muerto) se incrementa en cada ajuste aplicado. No necesita lógica de reseteo mensual explícita: al ser una columna del plan activo (no una fila por mes), se resetea solo cuando se genera un plan nuevo — que para free ya está limitado a 1/mes (`WORKOUT_PLANS_PER_MONTH`), así que en la práctica "3 ajustes/mes" y "3 ajustes por plan activo" coinciden para free. Premium no chequea este contador para bloquear, solo lo incrementa para historial/analítica.

## 3. Captura en la UI

### 3.1 Botón "Finalizar entrenamiento"

En `app/(app)/plans/workout/[id]/day/[dayNumber].tsx`, al final del `ScrollView` (tras el `.map` de `day.exercises`, línea ~192), nuevo botón fijo — oculto si `day.is_rest`. Habilitado solo cuando existe al menos una fila en `exercise_logs` por cada `exercise_order` de `day.exercises` para `log_date = hoy` — nueva query `useQuery(['exercise_logs_today', plan.id, day.day_number])` que trae `exercise_order` distinct y compara `Set` contra `day.exercises.map(e => e.order)`. Mientras falten, el botón se muestra deshabilitado con contador ("3/5 ejercicios registrados"). Confirmado en código: `ExerciseSheet.tsx:115` persiste `exerciseOrder: exercise.order` (el campo puesto por el LLM, no el índice del array) — esta comparación hereda el mismo riesgo ya aceptado en Fase C de que `order` no está garantizado único entre ejercicios del mismo día; si dos ejercicios comparten `order`, el contador podría marcar "completo" habiendo registrado solo uno de los dos. No se corrige aquí (mismo criterio de riesgo aceptado que el resto del código que ya depende de `order`).

### 3.2 `SessionFeedbackSheet` (componente nuevo)

Se abre al tocar el botón, mismo patrón de `Sheet` que `ExerciseSheet`/`UpgradeSheet`:
- Escala de dificultad, 5 `Chip` (muy fácil…muy difícil) — selección única, obligatoria para habilitar "Enviar".
- Chips de problema, multi-select (ninguno/dolor/no completé/otro) — debe quedar al menos uno marcado (default `ninguno` preseleccionado).
- `Input` de comentario, opcional, multiline, máx. 300 caracteres (mismo saneo que `modality_goal_notes`: `trim().slice(0,300)`).
- Lista colapsada de los ejercicios del día, cada uno con un toggle fácil/difícil chico — opcional, no bloquea envío.

Al enviar: `useSubmitSessionFeedback()` (nuevo, en `hooks/useSessionFeedback.ts`) llama a la EF `submit-session-feedback`, cierra el sheet de inmediato (optimista — no espera la respuesta del motor de decisión), y solo si la respuesta trae una sugerencia pendiente de aprobación (free o premium sin auto-modo) se muestra un segundo `Alert`/sheet corto con la sugerencia y botones Aceptar/Ignorar.

## 4. Motor de decisión (`submit-session-feedback`, nueva EF)

Estructura de archivos igual que `swap-meal`/`generate-plan`: `index.ts` (handler delgado) + `engine.ts` (funciones puras: gate + determinista) + `engine.test.ts` + `classify.ts` (llamada a Haiku, sin tests pesados, solo de contrato) + `credits.ts` (gate de créditos, mismo shape que `generate-plan/credits.ts`).

**Las ausencias no requieren manejo especial en el motor:** como `session_feedback` solo tiene filas de sesiones realmente reportadas, "últimas N sesiones" es literalmente `SELECT ... ORDER BY log_date DESC LIMIT N` sobre esa tabla — un día sin reporte simplemente no genera fila, no rompe ni cuenta en la ventana. El aviso de inactividad (`missed_workout_premium`/`missed_workout_free`, ya existen en `send-notifications/texts.ts`) sigue su lógica actual basada en `last_activity`, sin cambios en esta spec — el pedido del usuario de "que la ausencia no altere el plan" queda satisfecho por diseño, no requiere código extra de exclusión.

### 4.1 Gate de necesidad

Corre por cada ejercicio (o a nivel sesión si no hay flag específico) cuando el patrón se sostiene `N=3` sesiones consecutivas con la misma dirección (constante ajustable, `NECESSITY_PATTERN_WINDOW = 3` en `engine.ts`). Dirección = agrupar `difficulty_rating`/flag en familia "fácil" (`muy_facil`,`facil`), familia "difícil" (`dificil`,`muy_dificil`), o **neutral** (`justo`) — una sesión `justo` rompe la racha y reinicia el conteo de las 3, no cuenta para ninguna de las dos familias.

- **Excepción sin gate:** cualquier `problem_tags` con `dolor` en la sesión más reciente salta directo a §4.2, sin esperar 3 sesiones ni chequear avance.
- **Metas con número** (`goals.target_weight_kg`/`target_date`, de [[goal_branches_feature]]): se calcula el ritmo necesario igual que `lib/weightGoalSafety.ts` (`rateKgPerWeek` esperado) contra el ritmo real medido en `body_data` de las últimas `NECESSITY_PATTERN_WINDOW` semanas. Si el ritmo real ≥ `NECESSITY_PACE_THRESHOLD` (constante ajustable, default `0.7` = 70% del ritmo necesario) → **en ritmo, no se toca el plan**, sin importar la dirección del feedback.
- **Metas sin número estructurado:** proxy con `exercise_logs` — si el usuario ya viene subiendo su propia carga registrada en ese ejercicio en las últimas sesiones sin ayuda del sistema → en ritmo, se ignora un patrón "fácil" (ya se está autoprogresando). Un patrón "difícil" sostenido con carga estancada sí pasa el gate (umbral más permisivo en esta rama por ser un proxy, no una medición directa — documentado como heurística a afinar con datos reales post-lanzamiento).
- Si el gate determina "en ritmo" → se guarda el feedback para historial, no se genera ninguna fila en `plan_adjustments`, fin del pipeline.
- Si "rezagado" → dirección del ajuste según el feedback: `fácil` sostenido = subir intensidad; `difícil` sostenido = bajar rigor (para proteger adherencia, no solo "aguantar").

### 4.2 Split determinista/IA (híbrido)

- **Sin comentario y sin `problem_tags` salvo `ninguno`** → `engine.ts` función pura: bump fijo (+2.5–5% peso o +1–2 reps) al ejercicio(s) señalado(s) por `exercise_feedback`, o de forma general a los ejercicios principales del día si el único dato es `difficulty_rating` de sesión sin flags por ejercicio.
- **Con comentario o `problem_tags` ≠ solo `ninguno`** → `classify.ts` llama a Claude Haiku con salida estructurada: clasifica `flojera`/`complicacion_real`/`posible_molestia` y sugiere una de `bajar_carga`/`pausar_ejercicio`/`requiere_sustitucion` (solo si `posible_molestia`) o simplemente "sin acción" (si es `flojera` sin fundamento real, cruzando adherencia a dieta/registro — el prompt incluye ese contexto). Guardrail explícito en el system prompt: nunca diagnostica, nunca nombra condiciones médicas, solo actúa sobre el plan.
- **Fail-safe si Haiku falla/timeout:** si la sesión llevaba `dolor`, cae a una sugerencia determinista mínima ("marcaste molestia en X, ¿bajamos la carga?") sin clasificación fina — una señal de seguridad nunca se pierde por error de red. Si no había `dolor`, se guarda el feedback sin sugerencia ese ciclo.
- **Reincidencia:** `dolor` 3+ sesiones seguidas en el mismo ejercicio (consultando `plan_adjustments` con `reason_tag LIKE 'molestia_%'` para ese `exercise_order`) escala la sugerencia a `molestia_requiere_sustitucion` aunque el intento anterior haya sido `bajar_carga`.
- **Prioridad con señales mixtas:** un flag de `exercise_feedback` manda sobre ese ejercicio puntual; `difficulty_rating` de sesión solo gobierna los ejercicios sin flag propio.

### 4.3 Free vs. Premium

- **Free:** siempre requiere aprobación. Antes de proponer, `credits.ts` checa `workout_plans.modifications_count < FREE_LIMITS.WORKOUT_PLAN_MODIFICATIONS_PER_MONTH` (3). Si ya se usaron los 3, la sugerencia se sigue devolviendo pero `applied_by='user_approved'` solo se logra si el cliente confirma Y se llama `consume_credit(user_id, 'plan_adjustment', null)` vía `serviceClient` (mismo patrón `REVOKE`/service-role de `generate-plan`) antes de aplicar; sin saldo, mismo flujo de `no_credits_remaining` que ya usa `useGeneratePlan` (`Alert` con CTA a `buildCreditPackURL`).
- **Premium, `auto_adjust_enabled=false` (default):** misma aprobación manual, sin tope de `modifications_count`. La primera vez que se devuelve una sugerencia a un usuario premium, el payload incluye `offerAutoAdjustToggle: true` para que el cliente muestre la explicación del toggle junto con la sugerencia.
- **Premium, `auto_adjust_enabled=true`:** se aplica de inmediato (`applied_by='auto'`), sin esperar respuesta del cliente, y se dispara la notificación `plan_adjusted` (§5).
- **Override de seguridad sin excepción:** cualquier desenlace `molestia_*` (§4.2) **nunca** usa `applied_by='auto'`, ni con el toggle activo — siempre vuelve como sugerencia pendiente de aprobación, sin importar tier ni configuración.

### 4.4 Aplicar el ajuste

Mutación in-place del `exercise_order` afectado dentro de `workout_plans.schedule` (JSONB) — mismo mecanismo que ya muta el JSON en otros puntos del código, vía `serviceClient` porque el usuario no tiene permiso de `UPDATE` directo sobre `schedule`. Se escribe la fila en `plan_adjustments` (`before_snapshot`/`after_snapshot` = el objeto del ejercicio antes/después), se incrementa `modifications_count`, y el conteo de "N sesiones sostenidas" para ese ejercicio se reinicia (la próxima ventana de 3 empieza limpia desde la sesión siguiente).

## 5. Notificaciones

Dos `PayloadKind` nuevos en `supabase/functions/send-notifications/texts.ts` (mismo array `Record<PayloadKind, Record<'es'|'en', ...>>` ya existente, sufijo `_premium`/`_free` igual que `missed_workout_*`):

- `plan_adjustment_suggested_premium` / `plan_adjustment_suggested_free`: "Vulcano tiene una sugerencia para tu plan — revísala." Se dispara cuando `submit-session-feedback` genera una sugerencia pendiente de aprobación (el usuario pudo haber cerrado la sesión y salido de la app antes de que el motor terminara).
- `plan_adjusted_premium`: "Plan ajustado — Vulcano subió/bajó [ejercicio] según tu progreso." Solo aplica al caso premium auto-aplicado (§4.3); no existe variante free porque free nunca auto-aplica.

Ambos respetan el gating ya existente de `send-notifications` (`notif_updates`/`notif_reminders`, `isPremium`, `passesPrefs`) sin cambios en esa lógica — solo se agregan las entradas de texto y el disparo puntual desde `submit-session-feedback` (llamada directa al mismo mecanismo de push que ya usan las otras EFs, no una nueva ejecución del cron).

## 6. Errores y casos límite

- **Doble envío del mismo día:** bloqueado por el índice único de `session_feedback` — el segundo intento del cliente falla con conflicto, se trata como no-op (el sheet ya se cerró optimista en el primer envío).
- **Llamada a Haiku falla en un caso sin `dolor`:** se guarda el feedback, no se genera sugerencia ese ciclo — no bloquea ni reintenta, el próximo cierre de sesión vuelve a intentar el patrón completo.
- **Usuario sin plan activo cuando cierra un día "huérfano":** no debería ocurrir (el botón vive dentro de la vista de un `workout_plan_id` concreto ya cargado), pero si el plan se desactivó entre que se abrió la pantalla y se envió el feedback, la EF responde 404/`plan_not_found` y el cliente muestra el mismo `Alert` genérico que otros flujos.
- **Ejercicio ajustado ya no existe en el plan** (el usuario generó un plan nuevo entre sesiones): `plan_adjustments` queda como historial válido de un plan anterior, no se aplica nada — el gate de necesidad opera siempre sobre el `workout_plan_id` activo actual, un plan viejo no puede recibir ajustes.
- **`auto_adjust_enabled=true` pero el usuario baja de premium a free** (cancelación): el toggle queda en `true` en DB pero deja de tener efecto — `credits.ts` ya fuerza el camino free (aprobación + tope) para cualquier usuario no-premium sin importar el valor del toggle; se resetea a `false` solo si el usuario lo apaga manualmente o si Ajustes lo oculta para no-premium (decisión de UI, no bloqueante).

## 7. Fuera de alcance / diferido

- `swap-exercise` (mecanismo real de sustitución, cubre el desenlace `molestia_requiere_sustitucion` de esta spec Y la nota 16 de equipo no disponible) — hilo de brainstorming propio después.
- Fotos de progreso diarias — hilo de brainstorming propio después, sin relación mecánica con este motor.
- Ajuste del `TrainingMode` (`flexible`/`strict`) en sí — esta spec no lo modifica ni lo lee; es una posible extensión futura (que el patrón de feedback acumulado también sugiera cambiar ese modo), no incluida aquí.
- Afinar los umbrales (`NECESSITY_PATTERN_WINDOW=3`, `NECESSITY_PACE_THRESHOLD=0.7`, el bump 2.5–5%) con datos reales de uso — quedan como constantes documentadas, no como configuración de producto todavía.
- `types/database.types.ts` se regenera como parte de la migración, mismo patrón ya usado en el repo.
