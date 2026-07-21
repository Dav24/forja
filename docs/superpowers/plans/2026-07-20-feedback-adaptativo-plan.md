# Feedback adaptativo de plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el motor de feedback subjetivo post-sesión (estilo RPE) que ajusta incrementalmente el plan de entrenamiento activo del usuario — gate de necesidad, split determinista/IA, y diferenciación free/premium — según la spec aprobada en `docs/superpowers/specs/2026-07-20-feedback-adaptativo-plan-design.md`.

**Architecture:** Nueva Edge Function `submit-session-feedback` recibe el cierre de sesión, corre un pipeline server-side (gate de necesidad → split determinista/IA → aplicación) y muta `workout_plans.schedule` in-place. 3 tablas nuevas (`session_feedback`, `exercise_feedback`, `plan_adjustments`) + 1 columna (`profiles.auto_adjust_enabled`). Cliente: botón "Finalizar entrenamiento" en la vista de día, bloqueado hasta registrar todos los ejercicios, abre un sheet de feedback.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno), React Native/Expo, TanStack Query, Claude Haiku (`claude-haiku-4-5-20251001`) vía `fetch` directo a `api.anthropic.com` (mismo patrón que `chat/index.ts`, sin SDK).

## Global Constraints

- Toda tabla nueva lleva RLS con policy de owner (`user_id = auth.uid()`) — sin excepciones, mismo patrón que `exercise_logs`/`credit_ledger`.
- `consume_credit`/`grant_credit` (RPCs existentes, `0015_credit_ledger.sql`) están REVOKEadas de `authenticated` — solo se llaman vía `serviceClient` (service role), nunca con el cliente autenticado del usuario.
- El camino de dolor/molestia (`posible_molestia`) **nunca** se auto-aplica, sin excepción de tier ni de `auto_adjust_enabled` — ver spec §4.3.
- Cada EF Deno duplica sus propios mapas/constantes en vez de importar entre carpetas de funciones — no hay carpeta `_shared`, no hay precedente de imports cruzados entre EFs en este repo. No introducir uno nuevo aquí.
- Strings de UI nuevos siempre en `locales/es/*.json` + `locales/en/*.json`, nunca hardcodeados — correr `check-i18n` antes de dar cualquier tarea de UI por terminada.
- `tsc --noEmit` limpio y `deno test` verde (dentro de cada carpeta de función) son gate de cada tarea, no solo de la revisión final.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `supabase/migrations/0016_session_feedback.sql` | Crear | 3 tablas + columna + RLS |
| `supabase/functions/submit-session-feedback/engine.ts` | Crear | Funciones puras: dirección, patrón sostenido, ajuste determinista, gate de necesidad |
| `supabase/functions/submit-session-feedback/engine.test.ts` | Crear | Tests Deno de `engine.ts` |
| `supabase/functions/submit-session-feedback/classify.ts` | Crear | Llamada a Haiku para clasificar comentario/problema |
| `supabase/functions/submit-session-feedback/credits.ts` | Crear | Gate de créditos para el 4to+ ajuste free |
| `supabase/functions/submit-session-feedback/credits.test.ts` | Crear | Tests Deno de `credits.ts` |
| `supabase/functions/submit-session-feedback/texts.ts` | Crear | Copy es/en de los 2 pushes nuevos (copia local, ver Global Constraints) |
| `supabase/functions/submit-session-feedback/index.ts` | Crear | Handler: auth, inserta feedback, corre el pipeline, aplica, notifica |
| `supabase/functions/send-notifications/texts.ts` | Modificar | Agrega los mismos 3 `PayloadKind` para consistencia del catálogo general |
| `supabase/functions/send-notifications/texts.test.ts` | Modificar | Cubre los 3 kinds nuevos |
| `hooks/useSessionFeedback.ts` | Crear | `useCanFinalizeSession`, `useSubmitSessionFeedback` |
| `components/plans/SessionFeedbackSheet.tsx` | Crear | UI del sheet de feedback |
| `app/(app)/plans/workout/[id]/day/[dayNumber].tsx` | Modificar | Botón "Finalizar entrenamiento" + integra el sheet |
| `app/(app)/settings/training.tsx` | Modificar | Toggle "Plan ajustado" (`auto_adjust_enabled`) |
| `locales/es/plans.json`, `locales/en/plans.json` | Modificar | Strings del botón/sheet |
| `locales/es/settings.json`, `locales/en/settings.json` | Modificar | Strings del toggle |
| `types/database.types.ts` | Regenerar | Tipos de las tablas nuevas |

---

### Task 1: Migración `0016` — tablas + columna

**Files:**
- Create: `supabase/migrations/0016_session_feedback.sql`
- Modify: `types/database.types.ts` (regenerado, no editado a mano)

**Interfaces:**
- Produces: tablas `session_feedback`, `exercise_feedback`, `plan_adjustments`; columna `profiles.auto_adjust_enabled BOOLEAN`.

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/0016_session_feedback.sql
-- Feedback adaptativo de plan: captura post-sesión + historial de ajustes.
-- Ver docs/superpowers/specs/2026-07-20-feedback-adaptativo-plan-design.md

CREATE TABLE session_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE exercise_feedback (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_plan_id  UUID NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
  day_number       INT NOT NULL,
  exercise_order   INT,
  source           TEXT NOT NULL CHECK (source IN ('deterministic','ai')),
  reason_tag       TEXT NOT NULL,
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
-- bypassea RLS) escribe aquí.

ALTER TABLE profiles ADD COLUMN auto_adjust_enabled BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Aplicar la migración localmente**

Run: `cd "forja" && supabase migration up`
Expected: output lista `0016_session_feedback.sql` como aplicada, sin errores.

- [ ] **Step 3: Regenerar tipos**

Run: `cd "forja" && supabase gen types typescript --local > types/database.types.ts`
Expected: el diff de `types/database.types.ts` agrega `session_feedback`, `exercise_feedback`, `plan_adjustments` y `auto_adjust_enabled` en `profiles`, sin tocar el resto de tablas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0016_session_feedback.sql types/database.types.ts
git commit -m "feat(db): tablas de feedback adaptativo de plan (session_feedback, exercise_feedback, plan_adjustments)"
```

---

### Task 2: `engine.ts` — dirección, patrón sostenido y ajuste determinista

**Files:**
- Create: `supabase/functions/submit-session-feedback/engine.ts`
- Test: `supabase/functions/submit-session-feedback/engine.test.ts`

**Interfaces:**
- Produces: `DifficultyRating`, `Direction`, `classifyDirection`, `NECESSITY_PATTERN_WINDOW`, `hasSustainedPattern`, `DeterministicAdjustmentResult`, `computeDeterministicAdjustment`, `WEIGHT_BUMP_PCT`, `REPS_BUMP` — consumidos por `index.ts` (Task 7) y por `engine.test.ts` (este task).

- [ ] **Step 1: Escribir los tests (fallando)**

```ts
// supabase/functions/submit-session-feedback/engine.test.ts
import { assertEquals } from 'jsr:@std/assert';
import {
  classifyDirection,
  hasSustainedPattern,
  computeDeterministicAdjustment,
} from './engine.ts';

Deno.test('classifyDirection agrupa muy_facil/facil como facil', () => {
  assertEquals(classifyDirection('muy_facil'), 'facil');
  assertEquals(classifyDirection('facil'), 'facil');
});

Deno.test('classifyDirection agrupa dificil/muy_dificil como dificil', () => {
  assertEquals(classifyDirection('dificil'), 'dificil');
  assertEquals(classifyDirection('muy_dificil'), 'dificil');
});

Deno.test('classifyDirection trata justo como neutral', () => {
  assertEquals(classifyDirection('justo'), 'neutral');
});

Deno.test('hasSustainedPattern requiere al menos 3 sesiones', () => {
  assertEquals(hasSustainedPattern(['facil', 'facil']), null);
});

Deno.test('hasSustainedPattern detecta 3 sesiones fáciles seguidas', () => {
  assertEquals(hasSustainedPattern(['facil', 'muy_facil', 'facil']), 'facil');
});

Deno.test('hasSustainedPattern se rompe si aparece justo', () => {
  assertEquals(hasSustainedPattern(['facil', 'justo', 'facil']), null);
});

Deno.test('hasSustainedPattern se rompe con direcciones mixtas', () => {
  assertEquals(hasSustainedPattern(['facil', 'dificil', 'facil']), null);
});

Deno.test('computeDeterministicAdjustment sube peso 5% en direccion facil', () => {
  const result = computeDeterministicAdjustment('facil', { weightKg: 20, reps: 10 });
  assertEquals(result, { field: 'weight_kg', before: 20, after: 21 });
});

Deno.test('computeDeterministicAdjustment baja peso 5% en direccion dificil', () => {
  const result = computeDeterministicAdjustment('dificil', { weightKg: 20, reps: 10 });
  assertEquals(result, { field: 'weight_kg', before: 20, after: 19 });
});

Deno.test('computeDeterministicAdjustment usa reps cuando no hay peso (bodyweight)', () => {
  const up = computeDeterministicAdjustment('facil', { weightKg: null, reps: 10 });
  assertEquals(up, { field: 'reps', before: 10, after: 11 });
  const down = computeDeterministicAdjustment('dificil', { weightKg: null, reps: 10 });
  assertEquals(down, { field: 'reps', before: 10, after: 9 });
});

Deno.test('computeDeterministicAdjustment no baja reps de 1', () => {
  const result = computeDeterministicAdjustment('dificil', { weightKg: null, reps: 1 });
  assertEquals(result, { field: 'reps', before: 1, after: 1 });
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno test engine.test.ts`
Expected: FAIL — `Module not found "./engine.ts"`.

- [ ] **Step 3: Implementar `engine.ts` (parte 1)**

```ts
// supabase/functions/submit-session-feedback/engine.ts
export type DifficultyRating = 'muy_facil' | 'facil' | 'justo' | 'dificil' | 'muy_dificil';
export type Direction = 'facil' | 'dificil' | 'neutral';

export function classifyDirection(rating: DifficultyRating): Direction {
  if (rating === 'muy_facil' || rating === 'facil') return 'facil';
  if (rating === 'dificil' || rating === 'muy_dificil') return 'dificil';
  return 'neutral';
}

export const NECESSITY_PATTERN_WINDOW = 3;

/** `ratings` viene ordenado más-reciente-primero. */
export function hasSustainedPattern(ratings: DifficultyRating[]): 'facil' | 'dificil' | null {
  if (ratings.length < NECESSITY_PATTERN_WINDOW) return null;
  const recent = ratings.slice(0, NECESSITY_PATTERN_WINDOW).map(classifyDirection);
  const first = recent[0];
  if (first === 'neutral') return null;
  return recent.every((d) => d === first) ? first : null;
}

export const WEIGHT_BUMP_PCT = 0.05;
export const REPS_BUMP = 1;

export interface DeterministicAdjustmentResult {
  field: 'weight_kg' | 'reps';
  before: number;
  after: number;
}

export function computeDeterministicAdjustment(
  direction: 'facil' | 'dificil',
  current: { weightKg: number | null; reps: number },
): DeterministicAdjustmentResult {
  if (current.weightKg != null && current.weightKg > 0) {
    const factor = direction === 'facil' ? 1 + WEIGHT_BUMP_PCT : 1 - WEIGHT_BUMP_PCT;
    const after = Math.round((current.weightKg * factor) / 0.25) * 0.25;
    return { field: 'weight_kg', before: current.weightKg, after: Math.max(0, after) };
  }
  const delta = direction === 'facil' ? REPS_BUMP : -REPS_BUMP;
  const after = Math.max(1, current.reps + delta);
  return { field: 'reps', before: current.reps, after };
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno test engine.test.ts`
Expected: PASS — 11 tests OK.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-session-feedback/engine.ts supabase/functions/submit-session-feedback/engine.test.ts
git commit -m "feat(submit-session-feedback): dirección, patrón sostenido y ajuste determinista"
```

---

### Task 3: `engine.ts` — gate de necesidad

**Files:**
- Modify: `supabase/functions/submit-session-feedback/engine.ts`
- Modify: `supabase/functions/submit-session-feedback/engine.test.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores (funciones independientes en el mismo archivo).
- Produces: `NECESSITY_PACE_THRESHOLD`, `NecessityGateInput`, `NecessityGateResult`, `checkNecessityGate`, `computeExpectedRateKgPerWeek` — consumidos por `index.ts` (Task 7).

- [ ] **Step 1: Agregar los tests (fallando)**

```ts
// añadir al final de supabase/functions/submit-session-feedback/engine.test.ts
import { checkNecessityGate, computeExpectedRateKgPerWeek } from './engine.ts';

Deno.test('computeExpectedRateKgPerWeek calcula ritmo semanal necesario', () => {
  // 80kg -> 74kg en 4 semanas = 1.5kg/semana
  const rate = computeExpectedRateKgPerWeek(80, 74, '2026-08-17', new Date('2026-07-20'));
  assertEquals(Math.round(rate * 100) / 100, 1.5);
});

Deno.test('checkNecessityGate: en ritmo (>=70%) no toca el plan', () => {
  const result = checkNecessityGate({
    hasNumericGoal: true,
    expectedRateKgPerWeek: 1,
    actualRateKgPerWeek: 0.8,
    direction: 'facil',
  });
  assertEquals(result, 'on_track');
});

Deno.test('checkNecessityGate: rezagado dispara ajuste', () => {
  const result = checkNecessityGate({
    hasNumericGoal: true,
    expectedRateKgPerWeek: 1,
    actualRateKgPerWeek: 0.3,
    direction: 'facil',
  });
  assertEquals(result, 'needs_adjustment');
});

Deno.test('checkNecessityGate: sin meta numerica, direccion facil con autoprogresion no toca el plan', () => {
  const result = checkNecessityGate({
    hasNumericGoal: false,
    ownProgressionRecent: true,
    direction: 'facil',
  });
  assertEquals(result, 'on_track');
});

Deno.test('checkNecessityGate: sin meta numerica, direccion dificil siempre pasa el gate', () => {
  const result = checkNecessityGate({
    hasNumericGoal: false,
    ownProgressionRecent: true,
    direction: 'dificil',
  });
  assertEquals(result, 'needs_adjustment');
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno test engine.test.ts`
Expected: FAIL — `checkNecessityGate is not exported`.

- [ ] **Step 3: Implementar el gate**

```ts
// añadir al final de supabase/functions/submit-session-feedback/engine.ts

export function computeExpectedRateKgPerWeek(
  currentWeightKg: number,
  targetWeightKg: number,
  targetDate: string,
  today: Date = new Date(),
): number {
  const target = new Date(targetDate);
  const daysUntil = Math.max(1, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
  const weeksUntil = Math.max(1, daysUntil / 7);
  return Math.abs(targetWeightKg - currentWeightKg) / weeksUntil;
}

export const NECESSITY_PACE_THRESHOLD = 0.7;

export interface NecessityGateInput {
  hasNumericGoal: boolean;
  expectedRateKgPerWeek?: number;
  actualRateKgPerWeek?: number;
  ownProgressionRecent?: boolean;
  direction: 'facil' | 'dificil';
}

export type NecessityGateResult = 'on_track' | 'needs_adjustment';

export function checkNecessityGate(input: NecessityGateInput): NecessityGateResult {
  if (input.hasNumericGoal) {
    const expected = input.expectedRateKgPerWeek ?? 0;
    const actual = input.actualRateKgPerWeek ?? 0;
    if (expected <= 0) return 'needs_adjustment';
    return actual / expected >= NECESSITY_PACE_THRESHOLD ? 'on_track' : 'needs_adjustment';
  }
  if (input.direction === 'facil' && input.ownProgressionRecent) return 'on_track';
  return 'needs_adjustment';
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno test engine.test.ts`
Expected: PASS — 16 tests OK (11 del Task 2 + 5 nuevos).

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-session-feedback/engine.ts supabase/functions/submit-session-feedback/engine.test.ts
git commit -m "feat(submit-session-feedback): gate de necesidad contra avance real"
```

---

### Task 4: `credits.ts` — gate de créditos para el 4to+ ajuste free

**Files:**
- Create: `supabase/functions/submit-session-feedback/credits.ts`
- Test: `supabase/functions/submit-session-feedback/credits.test.ts`

**Interfaces:**
- Produces: `ModificationCreditGateDecision`, `decideModificationCreditGate` — consumido por `index.ts` (Task 7).

- [ ] **Step 1: Escribir los tests (fallando)**

```ts
// supabase/functions/submit-session-feedback/credits.test.ts
import { assertEquals } from 'jsr:@std/assert';
import { decideModificationCreditGate } from './credits.ts';

Deno.test('premium siempre es unlimited', () => {
  const result = decideModificationCreditGate({
    isPremium: true, modificationsCount: 99, freeLimit: 3, creditBalance: 0,
  });
  assertEquals(result, 'unlimited');
});

Deno.test('free dentro del tope es within_quota', () => {
  const result = decideModificationCreditGate({
    isPremium: false, modificationsCount: 2, freeLimit: 3, creditBalance: 0,
  });
  assertEquals(result, 'within_quota');
});

Deno.test('free en el tope con saldo es needs_credit', () => {
  const result = decideModificationCreditGate({
    isPremium: false, modificationsCount: 3, freeLimit: 3, creditBalance: 2,
  });
  assertEquals(result, 'needs_credit');
});

Deno.test('free en el tope sin saldo es blocked', () => {
  const result = decideModificationCreditGate({
    isPremium: false, modificationsCount: 3, freeLimit: 3, creditBalance: 0,
  });
  assertEquals(result, 'blocked');
});
```

- [ ] **Step 2: Correr los tests, confirmar que fallan**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno test credits.test.ts`
Expected: FAIL — `Module not found "./credits.ts"`.

- [ ] **Step 3: Implementar**

```ts
// supabase/functions/submit-session-feedback/credits.ts
export type ModificationCreditGateDecision = 'unlimited' | 'within_quota' | 'needs_credit' | 'blocked';

export function decideModificationCreditGate(input: {
  isPremium: boolean;
  modificationsCount: number;
  freeLimit: number;
  creditBalance: number;
}): ModificationCreditGateDecision {
  if (input.isPremium) return 'unlimited';
  if (input.modificationsCount < input.freeLimit) return 'within_quota';
  if (input.creditBalance > 0) return 'needs_credit';
  return 'blocked';
}
```

- [ ] **Step 4: Correr los tests, confirmar que pasan**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno test credits.test.ts`
Expected: PASS — 4 tests OK.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-session-feedback/credits.ts supabase/functions/submit-session-feedback/credits.test.ts
git commit -m "feat(submit-session-feedback): gate de créditos para ajustes free más allá del tope"
```

---

### Task 5: `classify.ts` — clasificación con Haiku

**Files:**
- Create: `supabase/functions/submit-session-feedback/classify.ts`

**Interfaces:**
- Consumes: `ANTHROPIC_API_KEY` (env var, ya configurada en `supabase/functions/.env`, mismo secret que usan `chat`/`generate-plan`).
- Produces: `ClassificationLabel`, `SuggestedAction`, `ClassifyInput`, `ClassifyResult`, `classifyFeedback` — consumido por `index.ts` (Task 7).

No lleva test unitario dedicado (llamada real a la API externa) — mismo criterio que la llamada a Claude en `chat/index.ts`/`generate-plan/index.ts`, ninguna de las dos tiene test unitario propio. Se verifica manualmente en el Task 7 (Step de verificación con curl).

- [ ] **Step 1: Implementar**

```ts
// supabase/functions/submit-session-feedback/classify.ts
export type ClassificationLabel = 'flojera' | 'complicacion_real' | 'posible_molestia';
export type SuggestedAction = 'bajar_carga' | 'pausar_ejercicio' | 'requiere_sustitucion' | 'sin_accion';

export interface ClassifyInput {
  comment: string | null;
  problemTags: string[];
  exerciseName: string;
  hasPainHistory3Sessions: boolean;
}

export interface ClassifyResult {
  label: ClassificationLabel;
  action: SuggestedAction;
}

const SYSTEM_PROMPT = `Eres un clasificador de feedback de entrenamiento para la app Forja. NUNCA diagnostiques ni nombres condiciones médicas — solo clasifica la intención del usuario y sugiere una acción sobre el PLAN de entrenamiento, nunca sobre su salud.

Clasificaciones posibles:
- "flojera": el usuario no quiso esforzarse, sin motivo real (ej. "qué flojera", "no me gustó", "me cansé mucho").
- "complicacion_real": tuvo un problema legítimo no relacionado a dolor físico (ej. no tuvo tiempo, no tuvo el equipo).
- "posible_molestia": mencionó dolor o molestia física.

Si la clasificación es "posible_molestia", la única acción válida es "bajar_carga", "pausar_ejercicio", o "requiere_sustitucion" — NUNCA sugieras subir intensidad ante una molestia. Si hay reincidencia de dolor (3+ sesiones seguidas en el mismo ejercicio), usa "requiere_sustitucion" directamente. Si la clasificación es "flojera", la acción es "sin_accion" salvo que el patrón de sesiones ya justifique un ajuste (eso lo decide el motor, no tú). Si es "complicacion_real" sin relación a dolor, la acción es "sin_accion".

Responde SOLO un objeto JSON, sin texto adicional: {"label": "...", "action": "..."}`;

export async function classifyFeedback(apiKey: string, input: ClassifyInput): Promise<ClassifyResult> {
  const userPrompt = `Ejercicio: ${input.exerciseName}
Comentario del usuario: ${input.comment ?? '(sin comentario)'}
Problemas marcados: ${input.problemTags.length > 0 ? input.problemTags.join(', ') : 'ninguno'}
Reincidencia de dolor en este ejercicio (3+ sesiones seguidas): ${input.hasPainHistory3Sessions ? 'sí' : 'no'}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`classifyFeedback: Anthropic API error ${res.status}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? '{}';
  const parsed = JSON.parse(text.trim());
  return { label: parsed.label, action: parsed.action };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno check classify.ts`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/submit-session-feedback/classify.ts
git commit -m "feat(submit-session-feedback): clasificación de feedback con Haiku"
```

---

### Task 6: `send-notifications/texts.ts` — 3 `PayloadKind` nuevos

**Files:**
- Modify: `supabase/functions/send-notifications/texts.ts`
- Modify: `supabase/functions/send-notifications/texts.test.ts`

**Interfaces:**
- Modifies: `PayloadKind` union (agrega 3 miembros), `TEXTS` record.

- [ ] **Step 1: Ver el test existente para seguir su patrón**

Run: `cat "forja/supabase/functions/send-notifications/texts.test.ts"`

- [ ] **Step 2: Agregar los tests (fallando)**

Añadir al final de `texts.test.ts` (mismo patrón que los tests existentes de ese archivo, usando `getNotificationText`):

```ts
Deno.test('plan_adjustment_suggested_free devuelve texto es/en', () => {
  const es = getNotificationText('plan_adjustment_suggested_free', 'es');
  const en = getNotificationText('plan_adjustment_suggested_free', 'en');
  if (!es.title || !es.body || !en.title || !en.body) throw new Error('texto incompleto');
});

Deno.test('plan_adjustment_suggested_premium devuelve texto es/en', () => {
  const es = getNotificationText('plan_adjustment_suggested_premium', 'es');
  const en = getNotificationText('plan_adjustment_suggested_premium', 'en');
  if (!es.title || !es.body || !en.title || !en.body) throw new Error('texto incompleto');
});

Deno.test('plan_adjusted_premium devuelve texto es/en', () => {
  const es = getNotificationText('plan_adjusted_premium', 'es');
  const en = getNotificationText('plan_adjusted_premium', 'en');
  if (!es.title || !es.body || !en.title || !en.body) throw new Error('texto incompleto');
});
```

- [ ] **Step 3: Correr los tests, confirmar que fallan**

Run: `cd "forja/supabase/functions/send-notifications" && deno test texts.test.ts`
Expected: FAIL — `TypeError: TEXTS[kind] is undefined`.

- [ ] **Step 4: Modificar `texts.ts`**

En `supabase/functions/send-notifications/texts.ts`, extender el tipo union:

```ts
export type PayloadKind =
  | 'goal_achieved'
  | 'goal_approaching'
  | 'missed_workout_premium'
  | 'greeting_premium'
  | 'missed_workout_free'
  | 'greeting_free'
  | 'plan_adjustment_suggested_premium'
  | 'plan_adjustment_suggested_free'
  | 'plan_adjusted_premium';
```

Y agregar al objeto `TEXTS` (antes del cierre `};`):

```ts
  plan_adjustment_suggested_premium: {
    es: () => ({
      title: 'Vulcano tiene una sugerencia 🔥',
      body: 'Revisa el ajuste que propone para tu plan de entrenamiento.',
    }),
    en: () => ({
      title: 'Vulcano has a suggestion 🔥',
      body: 'Check out the adjustment proposed for your workout plan.',
    }),
  },
  plan_adjustment_suggested_free: {
    es: () => ({
      title: 'Vulcano tiene una sugerencia 🔥',
      body: 'Revisa el ajuste que propone para tu plan de entrenamiento.',
    }),
    en: () => ({
      title: 'Vulcano has a suggestion 🔥',
      body: 'Check out the adjustment proposed for your workout plan.',
    }),
  },
  plan_adjusted_premium: {
    es: () => ({
      title: 'Plan ajustado ✅',
      body: 'Vulcano ajustó tu plan según tu progreso reciente.',
    }),
    en: () => ({
      title: 'Plan adjusted ✅',
      body: 'Vulcano adjusted your plan based on your recent progress.',
    }),
  },
```

- [ ] **Step 5: Correr los tests, confirmar que pasan**

Run: `cd "forja/supabase/functions/send-notifications" && deno test texts.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/send-notifications/texts.ts supabase/functions/send-notifications/texts.test.ts
git commit -m "feat(send-notifications): agrega PayloadKind de feedback adaptativo de plan"
```

---

### Task 7: `submit-session-feedback/index.ts` — handler completo

**Files:**
- Create: `supabase/functions/submit-session-feedback/texts.ts`
- Create: `supabase/functions/submit-session-feedback/index.ts`

**Interfaces:**
- Consumes: `engine.ts` (Task 2/3: `classifyDirection`, `hasSustainedPattern`, `computeDeterministicAdjustment`, `checkNecessityGate`, `computeExpectedRateKgPerWeek`, `NECESSITY_PATTERN_WINDOW`), `classify.ts` (Task 5: `classifyFeedback`), `credits.ts` (Task 4: `decideModificationCreditGate`).
- Produces: endpoint `POST /submit-session-feedback` — request/response documentados en Step 1.

- [ ] **Step 1: Crear `texts.ts` local (copia mínima para push directo)**

```ts
// supabase/functions/submit-session-feedback/texts.ts
// Copia local de los 2 textos que esta EF envía directo (sin pasar por el
// batch de send-notifications) — ver Global Constraints del plan sobre por
// qué no se comparte un módulo entre carpetas de funciones.
export function getPushText(
  kind: 'plan_adjustment_suggested' | 'plan_adjusted',
  lang: 'es' | 'en',
): { title: string; body: string } {
  if (kind === 'plan_adjustment_suggested') {
    return lang === 'es'
      ? { title: 'Vulcano tiene una sugerencia 🔥', body: 'Revisa el ajuste que propone para tu plan de entrenamiento.' }
      : { title: 'Vulcano has a suggestion 🔥', body: 'Check out the adjustment proposed for your workout plan.' };
  }
  return lang === 'es'
    ? { title: 'Plan ajustado ✅', body: 'Vulcano ajustó tu plan según tu progreso reciente.' }
    : { title: 'Plan adjusted ✅', body: 'Vulcano adjusted your plan based on your recent progress.' };
}
```

- [ ] **Step 2: Implementar el handler**

```ts
// supabase/functions/submit-session-feedback/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  classifyDirection,
  hasSustainedPattern,
  computeDeterministicAdjustment,
  checkNecessityGate,
  computeExpectedRateKgPerWeek,
  NECESSITY_PATTERN_WINDOW,
  type DifficultyRating,
} from './engine.ts';
import { classifyFeedback } from './classify.ts';
import { decideModificationCreditGate } from './credits.ts';
import { getPushText } from './texts.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const FREE_MODIFICATIONS_LIMIT = 3;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SubmitRequestBody {
  action?: 'submit'; // default si se omite `action`
  workout_plan_id: string;
  day_number: number;
  log_date: string; // YYYY-MM-DD
  difficulty_rating: DifficultyRating;
  problem_tags: string[];
  comment: string | null;
  exercise_flags: { exercise_order: number; flag: 'facil' | 'dificil' }[];
}

interface Suggestion {
  exerciseOrder: number | null;
  source: 'deterministic' | 'ai';
  reasonTag: string;
  before: unknown;
  after: unknown;
}

interface ApplySuggestionRequestBody {
  action: 'apply_suggestion';
  workout_plan_id: string;
  day_number: number;
  suggestion: Suggestion;
}

type RequestBody = SubmitRequestBody | ApplySuggestionRequestBody;

interface Exercise {
  order: number;
  name: string;
  sets: number;
  reps: string;
}

/** Muta `workout_plans.schedule` y registra el ajuste — usado tanto por el
 * auto-aplicado (premium+auto_adjust_enabled) como por la aprobación manual
 * del usuario (free o premium sin auto-modo). */
async function applyAdjustment(
  serviceClient: ReturnType<typeof createClient>,
  plan: { id: string; schedule: unknown; modifications_count: number },
  dayNumber: number,
  suggestion: Suggestion,
  userId: string,
  appliedBy: 'auto' | 'user_approved',
) {
  const schedule = plan.schedule as { day_number: number; exercises: Exercise[] }[];
  const updatedSchedule = schedule.map((d) => {
    if (d.day_number !== dayNumber) return d;
    return {
      ...d,
      exercises: d.exercises.map((ex) => {
        if (ex.order !== suggestion.exerciseOrder) return ex;
        return { ...ex, ...(suggestion.after as Record<string, number>) };
      }),
    };
  });

  await serviceClient.from('workout_plans').update({
    schedule: updatedSchedule,
    modifications_count: plan.modifications_count + 1,
  }).eq('id', plan.id);

  await serviceClient.from('plan_adjustments').insert({
    user_id: userId,
    workout_plan_id: plan.id,
    day_number: dayNumber,
    exercise_order: suggestion.exerciseOrder,
    source: suggestion.source,
    reason_tag: suggestion.reasonTag,
    before_snapshot: suggestion.before,
    after_snapshot: suggestion.after,
    applied_by: appliedBy,
  });
}

async function sendPush(
  expoPushToken: string | null,
  kind: 'plan_adjustment_suggested' | 'plan_adjusted',
  lang: 'es' | 'en',
) {
  if (!expoPushToken) return;
  const text = getPushText(kind, lang);
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{
      to: expoPushToken,
      title: text.title,
      body: text.body,
      data: { type: kind },
      sound: 'default',
    }]),
  }).catch((err) => console.error('sendPush failed:', err));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body: RequestBody = await req.json();

    // Ruta 0: el usuario aprueba una sugerencia ya devuelta por un envío
    // anterior — no vuelve a correr el pipeline, solo re-valida créditos y aplica.
    if (body.action === 'apply_suggestion') {
      const [{ data: plan }, { data: sub }] = await Promise.all([
        supabase.from('workout_plans').select('*').eq('id', body.workout_plan_id).eq('user_id', user.id).single(),
        supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle(),
      ]);
      if (!plan) {
        return new Response(JSON.stringify({ error: 'plan_not_found' }), {
          status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      const isPremiumApprove = sub?.status === 'active' && sub?.plan !== 'free';

      if (!isPremiumApprove) {
        const { data: balanceData } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
        const creditGate = decideModificationCreditGate({
          isPremium: false,
          modificationsCount: plan.modifications_count,
          freeLimit: FREE_MODIFICATIONS_LIMIT,
          creditBalance: balanceData ?? 0,
        });
        if (creditGate === 'blocked') {
          return new Response(JSON.stringify({ error: 'no_credits_remaining' }), {
            status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }
        if (creditGate === 'needs_credit') {
          const { data: remaining } = await serviceClient.rpc('consume_credit', {
            p_user_id: user.id, p_action: 'plan_adjustment', p_related_job_id: null,
          });
          if (remaining === -1) {
            return new Response(JSON.stringify({ error: 'no_credits_remaining' }), {
              status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
        }
      }

      await applyAdjustment(serviceClient, plan, body.day_number, body.suggestion, user.id, 'user_approved');
      return new Response(JSON.stringify({ applied: true }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 1. Insertar el feedback (append-only, el índice único bloquea duplicados del mismo día)
    const { error: insertErr } = await supabase.from('session_feedback').insert({
      user_id: user.id,
      workout_plan_id: body.workout_plan_id,
      day_number: body.day_number,
      log_date: body.log_date,
      difficulty_rating: body.difficulty_rating,
      problem_tags: body.problem_tags,
      comment: body.comment,
    });
    if (insertErr) {
      if (insertErr.code === '23505') {
        return new Response(JSON.stringify({ error: 'already_submitted' }), {
          status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }
      throw insertErr;
    }

    if (body.exercise_flags.length > 0) {
      await supabase.from('exercise_feedback').insert(
        body.exercise_flags.map((f) => ({
          user_id: user.id,
          workout_plan_id: body.workout_plan_id,
          day_number: body.day_number,
          exercise_order: f.exercise_order,
          log_date: body.log_date,
          flag: f.flag,
        })),
      );
    }

    // 2. Cargar plan activo + perfil + suscripción
    const [{ data: plan }, { data: profile }, { data: sub }] = await Promise.all([
      supabase.from('workout_plans').select('*').eq('id', body.workout_plan_id).eq('user_id', user.id).single(),
      supabase.from('profiles').select('auto_adjust_enabled, language, expo_push_token').eq('id', user.id).single(),
      supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle(),
    ]);
    if (!plan) {
      return new Response(JSON.stringify({ error: 'plan_not_found' }), {
        status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    const isPremium = sub?.status === 'active' && sub?.plan !== 'free';
    const lang: 'es' | 'en' = profile?.language === 'en' ? 'en' : 'es';

    const schedule = plan.schedule as unknown as { day_number: number; exercises: Exercise[] }[];
    const day = schedule.find((d) => d.day_number === body.day_number);
    if (!day) {
      return new Response(JSON.stringify({ error: 'day_not_found' }), {
        status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 3. Determinar qué ejercicios evaluar: flags puntuales, o todos los del día
    //    gobernados por el rating de sesión si no hay flags.
    const targets = body.exercise_flags.length > 0
      ? body.exercise_flags.map((f) => ({ exerciseOrder: f.exercise_order, rating: null as DifficultyRating | null, flag: f.flag }))
      : day.exercises.map((ex) => ({ exerciseOrder: ex.order, rating: body.difficulty_rating, flag: null as 'facil' | 'dificil' | null }));

    const hasPainTag = body.problem_tags.includes('dolor');
    let suggestion: Suggestion | null = null;

    for (const target of targets) {
      const exercise = day.exercises.find((e) => e.order === target.exerciseOrder);
      if (!exercise) continue;

      // Camino de dolor/comentario -> siempre escala a IA, sin gate de necesidad.
      if (hasPainTag || body.comment) {
        const { count: painHistory } = await supabase
          .from('session_feedback')
          .select('id', { count: 'exact', head: true })
          .eq('workout_plan_id', body.workout_plan_id)
          .contains('problem_tags', ['dolor'])
          .order('log_date', { ascending: false })
          .limit(NECESSITY_PATTERN_WINDOW);

        let classification;
        try {
          classification = await classifyFeedback(ANTHROPIC_API_KEY, {
            comment: body.comment,
            problemTags: body.problem_tags,
            exerciseName: exercise.name,
            hasPainHistory3Sessions: (painHistory ?? 0) >= NECESSITY_PATTERN_WINDOW,
          });
        } catch {
          // Fail-safe: si Haiku falla y había dolor, no se pierde la señal.
          if (hasPainTag) {
            classification = { label: 'posible_molestia' as const, action: 'bajar_carga' as const };
          } else {
            continue;
          }
        }

        if (classification.action === 'sin_accion') continue;

        const reasonTag = classification.action === 'bajar_carga' ? 'molestia_bajar_carga'
          : classification.action === 'pausar_ejercicio' ? 'molestia_pausar'
          : 'molestia_requiere_sustitucion';

        suggestion = {
          exerciseOrder: exercise.order,
          source: 'ai',
          reasonTag,
          before: exercise,
          after: exercise, // requiere_sustitucion/pausar no mutan números aquí — el swap real queda fuera de alcance (ver spec §7)
        };
        break; // una sugerencia de dolor por sesión es suficiente, no se acumulan varias
      }

      // Camino determinista: patrón sostenido + gate de necesidad.
      const { data: recentRows } = await supabase
        .from('session_feedback')
        .select('difficulty_rating')
        .eq('workout_plan_id', body.workout_plan_id)
        .order('log_date', { ascending: false })
        .limit(NECESSITY_PATTERN_WINDOW);
      const recentRatings = (recentRows ?? []).map((r) => r.difficulty_rating as DifficultyRating);
      const direction = target.flag ?? classifyDirection(target.rating!);
      if (direction === 'neutral') continue;

      const pattern = hasSustainedPattern(recentRatings);
      if (pattern !== direction) continue;

      const { data: goal } = await supabase
        .from('goals')
        .select('target_weight_kg, target_date, goal_type')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      let gateResult: 'on_track' | 'needs_adjustment';
      if (goal?.target_weight_kg && goal?.target_date) {
        const windowStart = new Date();
        windowStart.setDate(windowStart.getDate() - NECESSITY_PATTERN_WINDOW * 7);
        const { data: bodyRows } = await supabase
          .from('body_data')
          .select('weight_kg, recorded_at')
          .eq('user_id', user.id)
          .gte('recorded_at', windowStart.toISOString())
          .order('recorded_at', { ascending: true });
        const oldest = bodyRows?.[0]?.weight_kg ?? null;
        const newest = bodyRows?.[bodyRows.length - 1]?.weight_kg ?? null;
        const currentWeight = newest ?? oldest;
        const expected = currentWeight
          ? computeExpectedRateKgPerWeek(currentWeight, goal.target_weight_kg, goal.target_date)
          : 0;
        // Ritmo real medido entre la medición más antigua y más reciente de
        // la ventana; con <2 mediciones no se puede confirmar "en ritmo" y
        // se trata como rezagado (actual=0), consistente con checkNecessityGate.
        const actual = oldest != null && newest != null && bodyRows!.length >= 2
          ? Math.abs(newest - oldest) / NECESSITY_PATTERN_WINDOW
          : 0;
        gateResult = checkNecessityGate({
          hasNumericGoal: true,
          expectedRateKgPerWeek: expected,
          actualRateKgPerWeek: actual,
          direction,
        });
      } else {
        const { data: logRows } = await supabase
          .from('exercise_logs')
          .select('kg, recorded_at')
          .eq('exercise_slug', exercise.name)
          .order('recorded_at', { ascending: false })
          .limit(NECESSITY_PATTERN_WINDOW);
        const weights = (logRows ?? []).map((r) => r.kg).filter((k): k is number => k != null);
        const ownProgression = weights.length >= 2 && weights[0] > weights[weights.length - 1];
        gateResult = checkNecessityGate({ hasNumericGoal: false, ownProgressionRecent: ownProgression, direction });
      }

      if (gateResult === 'on_track') continue;

      const { data: lastLog } = await supabase
        .from('exercise_logs')
        .select('kg, reps')
        .eq('user_id', user.id).eq('workout_plan_id', body.workout_plan_id)
        .eq('day_number', body.day_number).eq('exercise_order', exercise.order)
        .order('recorded_at', { ascending: false }).limit(1).maybeSingle();

      const adjustment = computeDeterministicAdjustment(direction, {
        weightKg: lastLog?.kg ?? null,
        reps: lastLog?.reps ?? Number(exercise.reps) || 10,
      });

      suggestion = {
        exerciseOrder: exercise.order,
        source: 'deterministic',
        reasonTag: direction === 'facil' ? 'progresion_facil' : 'progresion_dificil',
        before: { [adjustment.field]: adjustment.before },
        after: { [adjustment.field]: adjustment.after },
      };
      break;
    }

    if (!suggestion) {
      return new Response(JSON.stringify({ suggestion: null }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const isSafetyPath = suggestion.reasonTag.startsWith('molestia_');
    const autoApply = isPremium && profile?.auto_adjust_enabled && !isSafetyPath;

    if (!autoApply) {
      // Sugerencia pendiente de aprobación (free siempre, premium sin auto-modo, o camino de dolor).
      if (!isPremium) {
        const creditGate = decideModificationCreditGate({
          isPremium: false,
          modificationsCount: plan.modifications_count,
          freeLimit: FREE_MODIFICATIONS_LIMIT,
          creditBalance: 0, // el saldo real se checa al momento de aceptar (endpoint aparte, fuera de este handler)
        });
        if (creditGate === 'blocked') {
          return new Response(JSON.stringify({
            suggestion,
            requires_credit: true,
          }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }
      }
      await sendPush(profile?.expo_push_token ?? null, 'plan_adjustment_suggested', lang);
      return new Response(JSON.stringify({ suggestion, requires_approval: true }), {
        status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Auto-aplicar (premium + auto_adjust_enabled + no es camino de dolor).
    await applyAdjustment(serviceClient, plan, body.day_number, suggestion, user.id, 'auto');
    await sendPush(profile?.expo_push_token ?? null, 'plan_adjusted', lang);

    return new Response(JSON.stringify({ suggestion, applied: true }), {
      status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-session-feedback error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
```

- [ ] **Step 3: Verificar tipos**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno check index.ts`
Expected: sin errores.

- [ ] **Step 4: Verificación manual end-to-end**

Con `supabase start` corriendo localmente y la EF servida (`supabase functions serve submit-session-feedback --env-file supabase/functions/.env`):

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/submit-session-feedback' \
  --header 'Authorization: Bearer <JWT de un usuario de prueba con plan activo>' \
  --header 'Content-Type: application/json' \
  --data '{
    "workout_plan_id": "<id del plan activo>",
    "day_number": 1,
    "log_date": "2026-07-20",
    "difficulty_rating": "facil",
    "problem_tags": ["ninguno"],
    "comment": null,
    "exercise_flags": []
  }'
```

Expected: `200 OK`, `{"suggestion": null}` en el primer envío (no hay 3 sesiones sostenidas todavía); repetir con `log_date` distinto 2 veces más con el mismo `difficulty_rating: "facil"` para simular la racha, y confirmar que la 3ra respuesta trae `suggestion` no nula (o `requires_approval`/`applied` según el tier del usuario de prueba).

Con un usuario de prueba FREE, tomar el `suggestion` devuelto en la respuesta anterior y confirmarlo:

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/submit-session-feedback' \
  --header 'Authorization: Bearer <JWT del mismo usuario free>' \
  --header 'Content-Type: application/json' \
  --data '{
    "action": "apply_suggestion",
    "workout_plan_id": "<id del plan activo>",
    "day_number": 1,
    "suggestion": <pegar aquí el objeto "suggestion" completo de la respuesta anterior>
  }'
```

Expected: `200 OK`, `{"applied": true}`; confirmar en Studio/psql que `workout_plans.schedule` cambió el ejercicio correspondiente y `workout_plans.modifications_count` subió en 1, y que hay una fila nueva en `plan_adjustments` con `applied_by='user_approved'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/submit-session-feedback/texts.ts supabase/functions/submit-session-feedback/index.ts
git commit -m "feat(submit-session-feedback): handler completo del motor de feedback adaptativo"
```

---

### Task 8: `hooks/useSessionFeedback.ts`

**Files:**
- Create: `hooks/useSessionFeedback.ts`

**Interfaces:**
- Produces: `useCanFinalizeSession(planId, dayNumber, requiredExerciseOrders)`, `useSubmitSessionFeedback()`, `useApplySuggestion()`, tipos `Suggestion`/`SubmitSessionFeedbackResponse` — consumidos por `SessionFeedbackSheet.tsx` (Task 9) y `day/[dayNumber].tsx` (Task 10, que es quien realmente llama a `useApplySuggestion` al mostrar el Alert de aprobación).

- [ ] **Step 1: Implementar**

```ts
// hooks/useSessionFeedback.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function useCanFinalizeSession(planId: string, dayNumber: number, requiredExerciseOrders: number[]) {
  const { user } = useAuthStore();
  const today = new Date().toISOString().slice(0, 10);

  const { data: loggedOrders = [] } = useQuery({
    queryKey: ['exercise_logs_today', planId, dayNumber, today],
    enabled: !!user && requiredExerciseOrders.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('exercise_order')
        .eq('workout_plan_id', planId)
        .eq('day_number', dayNumber)
        .eq('log_date', today);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.exercise_order))];
    },
  });

  const missing = requiredExerciseOrders.filter((o) => !loggedOrders.includes(o));
  return { canFinalize: missing.length === 0, loggedCount: loggedOrders.length, totalCount: requiredExerciseOrders.length };
}

export interface SubmitSessionFeedbackInput {
  workoutPlanId: string;
  dayNumber: number;
  logDate: string;
  difficultyRating: 'muy_facil' | 'facil' | 'justo' | 'dificil' | 'muy_dificil';
  problemTags: string[];
  comment: string | null;
  exerciseFlags: { exerciseOrder: number; flag: 'facil' | 'dificil' }[];
}

export function useSubmitSessionFeedback() {
  const { session } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitSessionFeedbackInput) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-session-feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workout_plan_id: input.workoutPlanId,
          day_number: input.dayNumber,
          log_date: input.logDate,
          difficulty_rating: input.difficultyRating,
          problem_tags: input.problemTags,
          comment: input.comment,
          exercise_flags: input.exerciseFlags.map((f) => ({ exercise_order: f.exerciseOrder, flag: f.flag })),
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 200) throw new Error(data.error ?? 'submit_failed');
      return data as SubmitSessionFeedbackResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workout_plan', variables.workoutPlanId] });
    },
  });
}

export interface SubmitSessionFeedbackResponse {
  suggestion: Suggestion | null;
  requires_approval?: boolean;
  applied?: boolean;
  requires_credit?: boolean;
}

export interface Suggestion {
  exerciseOrder: number | null;
  source: 'deterministic' | 'ai';
  reasonTag: string;
  before: unknown;
  after: unknown;
}

export function useApplySuggestion() {
  const { session } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { workoutPlanId: string; dayNumber: number; suggestion: Suggestion }) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-session-feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'apply_suggestion',
          workout_plan_id: input.workoutPlanId,
          day_number: input.dayNumber,
          suggestion: input.suggestion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'apply_failed');
      return data as { applied: true };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workout_plan', variables.workoutPlanId] });
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add hooks/useSessionFeedback.ts
git commit -m "feat(hooks): useCanFinalizeSession + useSubmitSessionFeedback"
```

---

### Task 9: `components/plans/SessionFeedbackSheet.tsx`

**Files:**
- Create: `components/plans/SessionFeedbackSheet.tsx`
- Modify: `locales/es/plans.json`, `locales/en/plans.json`

**Interfaces:**
- Consumes: `useSubmitSessionFeedback` (Task 8).
- Produces: componente `SessionFeedbackSheet` con `ref` (forwardRef, mismo patrón que `UpgradeSheet`/`ExerciseSheet`), props `{ workoutPlanId: string; dayNumber: number; exercises: { order: number; name: string }[] }`. Consumido por `day/[dayNumber].tsx` (Task 10).

- [ ] **Step 1: Agregar strings i18n**

En `locales/es/plans.json`, dentro del namespace raíz, agregar:

```json
"sessionFeedback": {
  "finalizeButton": "Finalizar entrenamiento",
  "finalizeProgress": "{{logged}}/{{total}} ejercicios registrados",
  "title": "¿Cómo te fue hoy?",
  "difficultyLabel": "Dificultad",
  "difficulty": {
    "muy_facil": "Muy fácil",
    "facil": "Fácil",
    "justo": "Justo",
    "dificil": "Difícil",
    "muy_dificil": "Muy difícil"
  },
  "problemsLabel": "¿Algún problema?",
  "problems": {
    "ninguno": "Ninguno",
    "dolor": "Dolor/molestia",
    "no_completo": "No completé",
    "otro": "Otro"
  },
  "commentPlaceholder": "Cuéntale a Vulcano más (opcional)",
  "exerciseFlagsLabel": "¿Algún ejercicio en particular?",
  "submit": "Enviar",
  "submitSuccess": "¡Feedback guardado!"
}
```

En `locales/en/plans.json`, la misma estructura traducida:

```json
"sessionFeedback": {
  "finalizeButton": "Finish workout",
  "finalizeProgress": "{{logged}}/{{total}} exercises logged",
  "title": "How did it go today?",
  "difficultyLabel": "Difficulty",
  "difficulty": {
    "muy_facil": "Very easy",
    "facil": "Easy",
    "justo": "Just right",
    "dificil": "Hard",
    "muy_dificil": "Very hard"
  },
  "problemsLabel": "Any issues?",
  "problems": {
    "ninguno": "None",
    "dolor": "Pain/discomfort",
    "no_completo": "Didn't finish",
    "otro": "Other"
  },
  "commentPlaceholder": "Tell Vulcano more (optional)",
  "exerciseFlagsLabel": "Any specific exercise?",
  "submit": "Submit",
  "submitSuccess": "Feedback saved!"
}
```

- [ ] **Step 2: Implementar el componente**

```tsx
// components/plans/SessionFeedbackSheet.tsx
import { forwardRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';
import { useSubmitSessionFeedback, type SubmitSessionFeedbackResponse } from '@/hooks/useSessionFeedback';

type DifficultyRating = 'muy_facil' | 'facil' | 'justo' | 'dificil' | 'muy_dificil';
type ProblemTag = 'ninguno' | 'dolor' | 'no_completo' | 'otro';

const DIFFICULTY_OPTIONS: DifficultyRating[] = ['muy_facil', 'facil', 'justo', 'dificil', 'muy_dificil'];
const PROBLEM_OPTIONS: ProblemTag[] = ['ninguno', 'dolor', 'no_completo', 'otro'];

interface Props {
  workoutPlanId: string;
  dayNumber: number;
  exercises: { order: number; name: string }[];
  onSubmitted: (response: SubmitSessionFeedbackResponse) => void;
}

export const SessionFeedbackSheet = forwardRef<BottomSheet, Props>(
  ({ workoutPlanId, dayNumber, exercises, onSubmitted }, ref) => {
    const { t } = useTranslation('plans');
    const { colors } = useTheme();
    const { mutate, isPending } = useSubmitSessionFeedback();

    const [rating, setRating] = useState<DifficultyRating | null>(null);
    const [problems, setProblems] = useState<ProblemTag[]>(['ninguno']);
    const [comment, setComment] = useState('');
    const [flags, setFlags] = useState<Record<number, 'facil' | 'dificil' | undefined>>({});

    function toggleProblem(tag: ProblemTag) {
      if (tag === 'ninguno') { setProblems(['ninguno']); return; }
      setProblems((prev) => {
        const withoutNinguno = prev.filter((p) => p !== 'ninguno');
        return withoutNinguno.includes(tag)
          ? withoutNinguno.filter((p) => p !== tag)
          : [...withoutNinguno, tag];
      });
    }

    function toggleExerciseFlag(order: number, flag: 'facil' | 'dificil') {
      setFlags((prev) => ({ ...prev, [order]: prev[order] === flag ? undefined : flag }));
    }

    function handleSubmit() {
      if (!rating) return;
      mutate({
        workoutPlanId,
        dayNumber,
        logDate: new Date().toISOString().slice(0, 10),
        difficultyRating: rating,
        problemTags: problems,
        comment: comment.trim() || null,
        exerciseFlags: Object.entries(flags)
          .filter(([, flag]) => flag != null)
          .map(([order, flag]) => ({ exerciseOrder: Number(order), flag: flag! })),
      }, {
        onSuccess: (response) => {
          onSubmitted(response);
        },
        onError: () => Alert.alert('Error', 'No se pudo guardar el feedback. Intenta de nuevo.'),
      });
    }

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={['75%']}
        enablePanDownToClose
        backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />}
        backgroundStyle={{ backgroundColor: colors.surface }}
      >
        <BottomSheetView style={{ padding: 20, gap: 16 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>
            {t('sessionFeedback.title')}
          </Text>

          <View>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
              {t('sessionFeedback.difficultyLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DIFFICULTY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setRating(opt)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: rating === opt ? colors.primary : colors.surfaceElevated,
                  }}
                >
                  <Text style={{ color: rating === opt ? colors.background : colors.text, fontFamily: 'Inter-Medium', fontSize: 13 }}>
                    {t(`sessionFeedback.difficulty.${opt}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
              {t('sessionFeedback.problemsLabel')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PROBLEM_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => toggleProblem(opt)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
                    backgroundColor: problems.includes(opt) ? colors.accent : colors.surfaceElevated,
                  }}
                >
                  <Text style={{ color: problems.includes(opt) ? colors.background : colors.text, fontFamily: 'Inter-Medium', fontSize: 13 }}>
                    {t(`sessionFeedback.problems.${opt}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TextInput
            value={comment}
            onChangeText={(v) => setComment(v.slice(0, 300))}
            placeholder={t('sessionFeedback.commentPlaceholder')}
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              backgroundColor: colors.surfaceElevated, borderRadius: 8, padding: 12,
              color: colors.text, fontFamily: 'Inter-Regular', fontSize: 14, minHeight: 60,
            }}
          />

          {exercises.length > 0 && (
            <View>
              <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.textMuted, marginBottom: 8 }}>
                {t('sessionFeedback.exerciseFlagsLabel')}
              </Text>
              {exercises.map((ex) => (
                <View key={ex.order} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13, flex: 1 }}>{ex.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => toggleExerciseFlag(ex.order, 'facil')}>
                      <Text style={{ fontSize: 18, opacity: flags[ex.order] === 'facil' ? 1 : 0.3 }}>😌</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => toggleExerciseFlag(ex.order, 'dificil')}>
                      <Text style={{ fontSize: 18, opacity: flags[ex.order] === 'dificil' ? 1 : 0.3 }}>😤</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!rating || isPending}
            style={{
              backgroundColor: rating ? colors.primary : colors.surfaceElevated,
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            }}
          >
            <Text style={{ color: rating ? colors.background : colors.textFaint, fontFamily: 'SpaceGrotesk-Bold', fontSize: 15 }}>
              {t('sessionFeedback.submit')}
            </Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
SessionFeedbackSheet.displayName = 'SessionFeedbackSheet';
```

- [ ] **Step 3: Verificar tipos e i18n**

Run: `cd "forja" && npx tsc --noEmit && npm run check-i18n`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add components/plans/SessionFeedbackSheet.tsx locales/es/plans.json locales/en/plans.json
git commit -m "feat(ui): SessionFeedbackSheet"
```

---

### Task 10: Integrar en `day/[dayNumber].tsx`

**Files:**
- Modify: `app/(app)/plans/workout/[id]/day/[dayNumber].tsx`

**Interfaces:**
- Consumes: `useCanFinalizeSession` (Task 8), `SessionFeedbackSheet` (Task 9).

- [ ] **Step 1: Agregar imports y estado**

En `app/(app)/plans/workout/[id]/day/[dayNumber].tsx`, junto a los imports existentes (línea ~16):

```tsx
import { Alert } from 'react-native';
import { useCanFinalizeSession, useApplySuggestion, type SubmitSessionFeedbackResponse } from '@/hooks/useSessionFeedback';
import { SessionFeedbackSheet } from '@/components/plans/SessionFeedbackSheet';
```

Confirmado en el archivo actual: la línea 2 importa `{ View, Text, ScrollView, TouchableOpacity, ActivityIndicator }` de `react-native`, sin `Alert` — agregarlo a esa misma línea (`import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';`) en vez de crear un import nuevo separado.

Junto a `activeExercise` (línea ~62), agregar:

```tsx
const feedbackSheetRef = useRef<BottomSheet>(null);
const { mutate: applySuggestion } = useApplySuggestion();

function handleFeedbackSubmitted(response: SubmitSessionFeedbackResponse, planId: string, dayNum: number) {
  feedbackSheetRef.current?.close();
  if (!response.suggestion) {
    Alert.alert(t('sessionFeedback.submitSuccess', { defaultValue: '¡Feedback guardado!' }));
    return;
  }
  if (response.applied) {
    // Ya se auto-aplicó server-side (premium + auto_adjust_enabled) — el push ya salió, no hace falta Alert extra aquí.
    return;
  }
  if (response.requires_credit) {
    Alert.alert(
      'Sin ajustes gratis este mes',
      'Ya usaste tus ajustes gratuitos. ¿Quieres usar 1 crédito para aplicar este ajuste?',
      [
        { text: 'Ahora no', style: 'cancel' },
        { text: 'Usar crédito', onPress: () => applySuggestion({ workoutPlanId: planId, dayNumber: dayNum, suggestion: response.suggestion! }) },
      ],
    );
    return;
  }
  if (response.requires_approval) {
    Alert.alert(
      'Vulcano tiene una sugerencia',
      'Según tu feedback reciente, conviene ajustar este ejercicio. ¿Lo aplicamos?',
      [
        { text: 'Ignorar', style: 'cancel' },
        { text: 'Aplicar', onPress: () => applySuggestion({ workoutPlanId: planId, dayNumber: dayNum, suggestion: response.suggestion! }) },
      ],
    );
  }
}
```

Después de `const day = schedule.find(...)` (línea ~93, ya dentro del componente, tras confirmar `plan`/`day` no nulos — mover esta llamada después del early-return de `!plan || !day` para no violar reglas de hooks... en su lugar, colocarla ANTES del early-return usando `day?.exercises.map(...) ?? []` para no romper el orden de hooks):

```tsx
const { canFinalize, loggedCount, totalCount } = useCanFinalizeSession(
  plan?.id ?? '',
  Number(dayNumber),
  (day?.exercises ?? []).map((e) => e.order),
);
```

(Esta línea debe ir ANTES del `if (!plan || !day) { return ... }` para respetar las reglas de hooks de React — mover el bloque `const jsDay = ...` y el `return` completo debajo de esta llamada.)

- [ ] **Step 2: Agregar el botón y el sheet al JSX**

Al final del `ScrollView` (tras el `.map` de ejercicios, antes de `</ScrollView>`, línea ~192), agregar — solo si `!day.is_rest`:

```tsx
{!day.is_rest && (
  <TouchableOpacity
    onPress={() => feedbackSheetRef.current?.expand()}
    disabled={!canFinalize}
    style={{
      marginTop: 20, backgroundColor: canFinalize ? colors.primary : colors.surfaceElevated,
      borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    }}
  >
    <Text style={{ color: canFinalize ? colors.background : colors.textFaint, fontFamily: 'SpaceGrotesk-Bold', fontSize: 15 }}>
      {canFinalize ? t('workout.finalizeButton', { defaultValue: 'Finalizar entrenamiento' }) : t('workout.finalizeProgress', { logged: loggedCount, total: totalCount, defaultValue: `${loggedCount}/${totalCount} ejercicios registrados` })}
    </Text>
  </TouchableOpacity>
)}
```

Tras `</ExerciseSheet>` al final del componente (línea ~202), agregar:

```tsx
<SessionFeedbackSheet
  ref={feedbackSheetRef}
  workoutPlanId={plan.id}
  dayNumber={day.day_number}
  exercises={day.exercises.map((e) => ({ order: e.order, name: e.name }))}
  onSubmitted={(response) => handleFeedbackSubmitted(response, plan.id, day.day_number)}
/>
```

- [ ] **Step 3: Verificar tipos**

Run: `cd "forja" && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Verificación manual en Expo Go**

Abrir un día de entrenamiento, confirmar que el botón aparece deshabilitado con el contador, registrar todos los ejercicios, confirmar que se habilita, tocar y confirmar que abre el sheet, enviar feedback y confirmar el `Alert` de éxito. Repetir el mismo `difficulty_rating` en 3 sesiones (sembrando `log_date` distintos vía Studio/psql si no se quiere esperar 3 días reales) y confirmar que en la 3ra aparece el `Alert` de "Vulcano tiene una sugerencia" con Aplicar/Ignorar; tocar Aplicar y confirmar en Studio que `workout_plans.schedule` y `plan_adjustments` cambiaron.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/plans/workout/[id]/day/[dayNumber].tsx"
git commit -m "feat(ui): integra Finalizar entrenamiento + SessionFeedbackSheet en la vista de día"
```

---

### Task 11: Toggle "Plan ajustado" en Ajustes

**Files:**
- Modify: `app/(app)/settings/training.tsx`
- Modify: `locales/es/settings.json`, `locales/en/settings.json`

**Interfaces:**
- Modifies: lee/escribe `profiles.auto_adjust_enabled` directo con `supabase.from('profiles')` (mismo patrón que el resto de campos de este archivo).

- [ ] **Step 1: Agregar strings i18n**

En `locales/es/settings.json`:

```json
"autoAdjust": {
  "title": "Plan ajustado",
  "description": "Vulcano ajusta tu plan automáticamente según tu progreso, sin pedirte confirmación cada vez. Siempre puedes cambiar esto."
}
```

En `locales/en/settings.json`:

```json
"autoAdjust": {
  "title": "Plan adjusted",
  "description": "Vulcano adjusts your plan automatically based on your progress, without asking each time. You can always change this."
}
```

- [ ] **Step 2: Agregar el toggle (solo premium)**

En `app/(app)/settings/training.tsx`, agregar un `useState` junto a los existentes:

```tsx
const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(false);
```

En el `useEffect` de precarga (línea ~56), agregar la lectura de `auto_adjust_enabled` junto al resto de campos del perfil ya precargados ahí.

En el JSX, dentro de la card "Perfil de entrenamiento" (mismo `GroupCard` que ya existe), agregar — condicionado a que el usuario sea premium (misma variable `isPremium`/`subscription` ya usada en ese archivo para otros gates):

```tsx
{isPremium && (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
    <View style={{ flex: 1, marginRight: 12 }}>
      <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14 }}>{t('autoAdjust.title')}</Text>
      <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>{t('autoAdjust.description')}</Text>
    </View>
    <Switch
      value={autoAdjustEnabled}
      onValueChange={setAutoAdjustEnabled}
      trackColor={{ true: colors.primary, false: colors.surfaceElevated }}
    />
  </View>
)}
```

En `handleSave`, agregar `auto_adjust_enabled: autoAdjustEnabled` al objeto que se actualiza en `profiles` (no en `goals`, a diferencia del resto de campos de este archivo — es una columna de `profiles`, requiere una llamada `supabase.from('profiles').update({ auto_adjust_enabled: autoAdjustEnabled }).eq('id', user.id)` separada del `insert`/`update` de `goals` que ya hace esta función).

- [ ] **Step 3: Verificar tipos e i18n**

Run: `cd "forja" && npx tsc --noEmit && npm run check-i18n`
Expected: sin errores.

- [ ] **Step 4: Verificación manual en Expo Go**

Con un usuario premium de prueba: abrir Ajustes → Mi entrenamiento, confirmar que aparece el toggle, activarlo, guardar, recargar la pantalla y confirmar que quedó persistido. Con un usuario free: confirmar que el toggle NO aparece.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/settings/training.tsx" locales/es/settings.json locales/en/settings.json
git commit -m "feat(settings): toggle de auto-ajuste de plan (Plan ajustado) para premium"
```

---

### Task 12: Gate final — tsc, deno tests, check-i18n

**Files:** ninguno nuevo, solo verificación.

- [ ] **Step 1: TypeScript limpio**

Run: `cd "forja" && npx tsc --noEmit`
Expected: 0 errores (o solo el `TS2551` preexistente en `generate-meal-plan` ya documentado como ajeno, ver [[goal_branches_feature]]).

- [ ] **Step 2: Todos los tests Deno de la EF nueva**

Run: `cd "forja/supabase/functions/submit-session-feedback" && deno test`
Expected: todos los tests de `engine.test.ts` + `credits.test.ts` en PASS.

- [ ] **Step 3: Tests Deno de `send-notifications` (modificado)**

Run: `cd "forja/supabase/functions/send-notifications" && deno test`
Expected: todos los tests, incluidos los 3 nuevos del Task 6, en PASS.

- [ ] **Step 4: i18n**

Run: `cd "forja" && npm run check-i18n`
Expected: sin claves faltantes ni huérfanas.

- [ ] **Step 5: Commit final (si algo quedó sin commitear)**

```bash
git status --porcelain
# si hay cambios: git add -A && git commit -m "chore: gate final de feedback adaptativo de plan"
```
