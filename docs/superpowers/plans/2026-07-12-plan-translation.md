# Traducción de planes al vuelo con caché — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el contenido IA de los planes (workout y meal) siga el idioma de la app, traduciendo UNA vez por idioma con Haiku y cacheando el resultado en la fila del plan.

**Architecture:** Migración `0010` agrega `source_language` + `translations JSONB` a `workout_plans`/`meal_plans`. Una EF nueva `translate-plan` (lógica pura TDD, patrón `delete-account/logic.ts`) corto-circuita sin IA cuando el idioma coincide o ya hay caché, y si no llama a Haiku, valida forma y mergea el caché con service role. En el cliente, el hook `useLocalizedPlan` resuelve qué contenido renderizar y dispara la EF solo desde las pantallas de detalle (el hub es pasivo).

**Tech Stack:** Supabase Edge Functions (Deno + deno test), Claude Haiku (`claude-haiku-4-5-20251001`), TanStack Query v5, react-i18next, Expo Router.

**Spec:** `docs/superpowers/specs/2026-07-09-plan-translation-design.md`

## Global Constraints

- Idiomas soportados: `'es' | 'en'` exactamente (extensible, pero V1 solo estos).
- Modelo de traducción: **`claude-haiku-4-5-20251001`** (nunca Sonnet — la traducción es barata).
- Un idioma cacheado NUNCA se re-traduce; el merge de `translations` no debe pisar otros idiomas.
- Los valores numéricos (sets, reps, rest_seconds, calorías, macros, day_number, duraciones) NUNCA cambian entre idiomas — se preservan por construcción desde el original.
- Nombres de marca "Forja" y "Vulcano" no se traducen.
- El hub de planes NUNCA llama a la EF de traducción (modo pasivo).
- Toda clave i18n nueva va en `locales/es/` Y `locales/en/` con paridad (`npm run check-i18n`).
- NativeWind: colores del design system y fontFamily siempre en `style={{}}`, nunca en `className`.
- Todos los comandos se ejecutan desde `/home/davro/Documentos/Physis Labs/Per-TrAIneer/forja/` (raíz del repo git). Docker requiere `sg docker -c "..."`.
- La EF corre en el edge runtime local ya levantado; tras crear/editar EFs, reiniciar: `sg docker -c "docker restart supabase_edge_runtime_forja"`.

---

### Task 1: Migración 0010 + `source_language` en las EFs de generación

**Files:**
- Create: `supabase/migrations/0010_plan_translations.sql`
- Modify: `supabase/functions/generate-plan/index.ts` (INSERT, ~línea 360)
- Modify: `supabase/functions/generate-meal-plan/index.ts` (INSERT, ~línea 289)

**Interfaces:**
- Produces: columnas `workout_plans.source_language` / `meal_plans.source_language` (`text not null default 'es'`, check `in ('es','en')`) y `workout_plans.translations` / `meal_plans.translations` (`jsonb not null default '{}'`). Las EFs de generación escriben `source_language` con el idioma ya resuelto en su variable local `language: 'es' | 'en'`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/0010_plan_translations.sql`:

```sql
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
```

- [ ] **Step 2: Aplicar la migración en local**

Run: `sg docker -c "supabase migration up"`
Expected: aplica `0010_plan_translations.sql` sin errores.

- [ ] **Step 3: Verificar columnas y backfill**

Run: `sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -c \"select column_name, data_type, column_default from information_schema.columns where table_name in ('workout_plans','meal_plans') and column_name in ('source_language','translations') order by table_name, column_name;\""`
Expected: 4 filas (2 por tabla), `source_language` con default `'es'::text`, `translations` con default `'{}'::jsonb`.

Run: `sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -c \"select count(*) filter (where source_language = 'es') as es, count(*) as total from workout_plans;\""`
Expected: `es == total` (backfill correcto).

- [ ] **Step 4: Escribir `source_language` en generate-plan**

En `supabase/functions/generate-plan/index.ts`, el INSERT del plan (busca `.from('workout_plans')` seguido de `.insert({`) ya tiene la variable `language` resuelta arriba (`const language: 'es' | 'en' = profileResult.data?.language === 'en' ? 'en' : 'es';`). Agregar el campo:

```ts
      .insert({
        user_id: user.id,
        title: String(planData.title ?? 'Mi Plan de Entrenamiento'),
        description: String(planData.description ?? ''),
        schedule: planData.schedule ?? [],
        generated_by: 'claude-sonnet-4-6',
        is_active: true,
        source_language: language,
      })
```

- [ ] **Step 5: Escribir `source_language` en generate-meal-plan**

En `supabase/functions/generate-meal-plan/index.ts`, el INSERT (busca `.from('meal_plans')` seguido de `.insert({`) también tiene `language` resuelta arriba. Agregar el campo:

```ts
      .insert({
        user_id: user.id,
        title: String(planData.title ?? 'Mi Plan Alimenticio'),
        daily_calories: Number(planData.daily_calories ?? 0),
        macros,
        meals: planData,
        generated_by: 'claude-sonnet-4-6',
        is_active: true,
        source_language: language,
      })
```

- [ ] **Step 6: Reiniciar edge runtime y verificar que las EFs siguen vivas**

Run: `sg docker -c "docker restart supabase_edge_runtime_forja" && sleep 3 && curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS http://127.0.0.1:54321/functions/v1/generate-plan`
Expected: `200`.

(La escritura real de `source_language='en'` se comprueba en el punto 5 del E2E humano de la Task 7 — generar un plan con la app en EN cuesta tokens de Sonnet, no se hace aquí.)

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0010_plan_translations.sql supabase/functions/generate-plan/index.ts supabase/functions/generate-meal-plan/index.ts
git commit -m "feat: columnas source_language y translations para traducción de planes (migración 0010)"
```

---

### Task 2: Lógica pura de `translate-plan` (TDD)

**Files:**
- Create: `supabase/functions/translate-plan/logic.ts`
- Test: `supabase/functions/translate-plan/logic.test.ts`

**Interfaces:**
- Produces (consumidas por Task 3):
  - `type PlanType = 'workout' | 'meal'` · `type Language = 'es' | 'en'` · `type Json = Record<string, unknown>`
  - `class PlanNotFoundError extends Error` · `class ShapeMismatchError extends Error`
  - `extractOriginalContent(plan: Json, planType: PlanType): Json` — workout → `{ title, description, schedule }`; meal → `{ title, meals }`.
  - `buildTranslationPrompt(planType: PlanType, content: Json, target: Language): string`
  - `applyTranslation(original: Json, translated: Json, planType: PlanType): Json` — lanza `ShapeMismatchError` si cambia el número de días/ejercicios/comidas; los numéricos se preservan por construcción.
  - `mergeTranslations(existing: Json, lang: Language, content: Json): Json`
  - `interface TranslateDeps { loadPlan(): Promise<Json | null>; callTranslator(prompt: string): Promise<string>; saveTranslation(lang: Language, content: Json): Promise<void> }`
  - `translatePlan(deps: TranslateDeps, input: { planType: PlanType; targetLanguage: Language }): Promise<Json>`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `supabase/functions/translate-plan/logic.test.ts`:

```ts
import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert';
import {
  applyTranslation,
  mergeTranslations,
  ShapeMismatchError,
  translatePlan,
  type Json,
  type TranslateDeps,
} from './logic.ts';

// ---------- Fixtures ----------

const workoutRow: Json = {
  id: 'plan-1',
  title: 'Plan Hipertrofia 3 días',
  description: 'Plan de fuerza con enfoque en básicos.',
  source_language: 'es',
  translations: {},
  schedule: [
    {
      day_number: 1,
      day_name: 'Lunes',
      is_rest: false,
      focus: 'Push - Pecho',
      estimated_duration_minutes: 60,
      exercises: [
        {
          order: 1,
          name: 'Press de banca',
          muscle_group: 'Pecho',
          sets: 4,
          reps: '8-10',
          rest_seconds: 90,
          technique_notes: 'Control excéntrico',
        },
      ],
    },
  ],
};

const workoutTranslatedOk: Json = {
  title: '3-Day Hypertrophy Plan',
  description: 'Strength plan focused on compound lifts.',
  schedule: [
    {
      day_number: 1,
      day_name: 'Monday',
      is_rest: false,
      focus: 'Push - Chest',
      estimated_duration_minutes: 60,
      exercises: [
        {
          order: 1,
          name: 'Barbell bench press',
          muscle_group: 'Chest',
          sets: 4,
          reps: '8-10',
          rest_seconds: 90,
          technique_notes: 'Eccentric control',
        },
      ],
    },
  ],
};

const mealRow: Json = {
  id: 'meal-1',
  title: 'Plan Nutrición 2800 kcal',
  source_language: 'es',
  translations: {},
  meals: {
    title: 'Plan Nutrición 2800 kcal',
    description: 'Enfoque hipercalórico limpio.',
    daily_calories: 2800,
    macros: { protein_g: 210, carbs_g: 280, fat_g: 80 },
    days: [
      {
        day_number: 1,
        day_name: 'Lunes',
        total_calories: 2800,
        meals: [
          {
            meal_type: 'Desayuno',
            time_suggestion: '7:00–8:00',
            name: 'Avena proteica',
            calories: 520,
            protein_g: 35,
            carbs_g: 65,
            fat_g: 10,
            ingredients: ['80g avena', '1 scoop proteína'],
          },
        ],
      },
    ],
  },
};

function makeDeps(overrides: Partial<TranslateDeps> = {}) {
  const calls: string[] = [];
  let saved: { lang: string; content: Json } | null = null;
  const deps: TranslateDeps = {
    loadPlan: async () => structuredClone(workoutRow),
    callTranslator: async () => {
      calls.push('ai');
      return JSON.stringify(workoutTranslatedOk);
    },
    saveTranslation: async (lang, content) => {
      calls.push('save');
      saved = { lang, content };
    },
    ...overrides,
  };
  return { deps, calls, getSaved: () => saved };
}

// ---------- (a) target === source: original sin IA ----------

Deno.test('target igual a source_language devuelve el original sin llamar a la IA', async () => {
  const { deps, calls } = makeDeps();
  const content = await translatePlan(deps, { planType: 'workout', targetLanguage: 'es' });
  assertEquals(content.title, 'Plan Hipertrofia 3 días');
  assertEquals(calls, []);
});

// ---------- (b) caché existente: sin IA y sin save ----------

Deno.test('idioma ya cacheado se devuelve sin IA y sin re-guardar', async () => {
  const cached = { title: 'Cached EN title', description: 'x', schedule: [] };
  const { deps, calls } = makeDeps({
    loadPlan: async () => ({ ...structuredClone(workoutRow), translations: { en: cached } }),
  });
  const content = await translatePlan(deps, { planType: 'workout', targetLanguage: 'en' });
  assertEquals(content, cached);
  assertEquals(calls, []);
});

// ---------- (c) idioma nuevo: llama IA, guarda, y el merge preserva idiomas previos ----------

Deno.test('idioma nuevo llama a la IA una vez y guarda la traducción', async () => {
  const { deps, calls, getSaved } = makeDeps();
  const content = await translatePlan(deps, { planType: 'workout', targetLanguage: 'en' });
  assertEquals(calls, ['ai', 'save']);
  assertEquals(getSaved()!.lang, 'en');
  assertEquals(content.title, '3-Day Hypertrophy Plan');
  const day = (content.schedule as Json[])[0];
  assertEquals(day.day_name, 'Monday');
});

Deno.test('mergeTranslations agrega un idioma sin pisar los previos', () => {
  const merged = mergeTranslations({ en: { title: 'A' } }, 'es', { title: 'B' });
  assertEquals(merged, { en: { title: 'A' }, es: { title: 'B' } });
});

// ---------- (d) validación de forma ----------

Deno.test('applyTranslation rechaza schedule con distinto número de días', () => {
  const bad = { ...structuredClone(workoutTranslatedOk), schedule: [] };
  assertThrows(
    () => applyTranslation(
      { title: 't', description: 'd', schedule: (workoutRow.schedule as Json[]) },
      bad,
      'workout',
    ),
    ShapeMismatchError,
  );
});

Deno.test('applyTranslation rechaza un día con distinto número de ejercicios', () => {
  const bad = structuredClone(workoutTranslatedOk);
  ((bad.schedule as Json[])[0] as Json).exercises = [];
  assertThrows(
    () => applyTranslation(
      { title: 't', description: 'd', schedule: (workoutRow.schedule as Json[]) },
      bad,
      'workout',
    ),
    ShapeMismatchError,
  );
});

Deno.test('si la IA devuelve forma inválida, translatePlan rechaza y NO guarda', async () => {
  const { deps, calls } = makeDeps({
    callTranslator: async () => JSON.stringify({ ...workoutTranslatedOk, schedule: [] }),
  });
  await assertRejects(
    () => translatePlan(deps, { planType: 'workout', targetLanguage: 'en' }),
    ShapeMismatchError,
  );
  assertEquals(calls.includes('save'), false);
});

// ---------- (e) los numéricos del original se preservan ----------

Deno.test('los campos numéricos del original se preservan aunque la IA los altere', () => {
  const tampered = structuredClone(workoutTranslatedOk);
  const tDay = (tampered.schedule as Json[])[0] as Json;
  tDay.estimated_duration_minutes = 999;
  ((tDay.exercises as Json[])[0] as Json).sets = 99;
  ((tDay.exercises as Json[])[0] as Json).rest_seconds = 1;

  const result = applyTranslation(
    { title: 't', description: 'd', schedule: (workoutRow.schedule as Json[]) },
    tampered,
    'workout',
  );
  const day = (result.schedule as Json[])[0] as Json;
  assertEquals(day.estimated_duration_minutes, 60);
  const ex = (day.exercises as Json[])[0] as Json;
  assertEquals(ex.sets, 4);
  assertEquals(ex.rest_seconds, 90);
  assertEquals(ex.name, 'Barbell bench press'); // el texto sí se tradujo
});

Deno.test('meal: macros y calorías intactos, textos e ingredientes traducidos', async () => {
  const mealTranslated = {
    title: '2800 kcal Nutrition Plan',
    meals: {
      title: '2800 kcal Nutrition Plan',
      description: 'Clean bulk approach.',
      daily_calories: 1, // alterado a propósito — debe ignorarse
      macros: { protein_g: 1, carbs_g: 1, fat_g: 1 },
      days: [
        {
          day_number: 1,
          day_name: 'Monday',
          total_calories: 1,
          meals: [
            {
              meal_type: 'Breakfast',
              time_suggestion: '7:00–8:00 AM',
              name: 'Protein oatmeal',
              calories: 1,
              protein_g: 1,
              carbs_g: 1,
              fat_g: 1,
              ingredients: ['80g oats', '1 scoop protein'],
            },
          ],
        },
      ],
    },
  };
  const { deps } = makeDeps({
    loadPlan: async () => structuredClone(mealRow),
    callTranslator: async () => JSON.stringify(mealTranslated),
  });
  const content = await translatePlan(deps, { planType: 'meal', targetLanguage: 'en' });
  const meals = content.meals as Json;
  assertEquals(meals.daily_calories, 2800);
  assertEquals((meals.macros as Json).protein_g, 210);
  const day = (meals.days as Json[])[0] as Json;
  assertEquals(day.total_calories, 2800);
  assertEquals(day.day_name, 'Monday');
  const meal = (day.meals as Json[])[0] as Json;
  assertEquals(meal.calories, 520);
  assertEquals(meal.name, 'Protein oatmeal');
  assertEquals(meal.ingredients, ['80g oats', '1 scoop protein']);
});
```

- [ ] **Step 2: Verificar que fallan**

Run: `cd supabase/functions && deno test translate-plan/logic.test.ts`
Expected: FAIL — módulo `./logic.ts` no existe.

- [ ] **Step 3: Implementar `logic.ts`**

Crear `supabase/functions/translate-plan/logic.ts`:

```ts
export type PlanType = 'workout' | 'meal';
export type Language = 'es' | 'en';
export type Json = Record<string, unknown>;

export class PlanNotFoundError extends Error {}
export class ShapeMismatchError extends Error {}

// Campos de lenguaje natural que se traducen. Todo lo demás (números,
// booleans, ids) se copia del original por construcción.
const WORKOUT_TOP_FIELDS = ['title', 'description', 'weekly_schedule_summary', 'progression_notes'];
const WORKOUT_DAY_FIELDS = ['day_name', 'focus'];
const EXERCISE_FIELDS = ['name', 'muscle_group', 'technique_notes'];
const MEAL_TOP_FIELDS = ['title', 'description'];
const MEAL_DAY_FIELDS = ['day_name'];
const MEAL_ITEM_FIELDS = ['meal_type', 'time_suggestion', 'name'];

export interface TranslateDeps {
  loadPlan(): Promise<Json | null>;
  callTranslator(prompt: string): Promise<string>;
  saveTranslation(lang: Language, content: Json): Promise<void>;
}

export function extractOriginalContent(plan: Json, planType: PlanType): Json {
  if (planType === 'workout') {
    return {
      title: plan.title,
      description: plan.description ?? '',
      schedule: plan.schedule ?? [],
    };
  }
  return { title: plan.title, meals: plan.meals ?? {} };
}

export function buildTranslationPrompt(planType: PlanType, content: Json, target: Language): string {
  const langName = target === 'en' ? 'inglés' : 'español';
  const fields = planType === 'workout'
    ? 'title, description, weekly_schedule_summary, progression_notes, day_name, focus, name, muscle_group, technique_notes'
    : 'title, description, day_name, meal_type, time_suggestion, name, ingredients';
  return `Eres un traductor profesional especializado en fitness y nutrición deportiva. Traduce al ${langName} ÚNICAMENTE los VALORES de texto del siguiente JSON. Responde SOLO con el objeto JSON traducido, sin markdown ni explicaciones.

REGLAS ESTRICTAS:
- Conserva TODAS las claves JSON exactamente iguales.
- Conserva la estructura exacta: mismo número de elementos en cada array (días, ejercicios, comidas, ingredientes).
- NO cambies ningún valor numérico (sets, reps, rest_seconds, calorías, macros, day_number, duraciones).
- Traduce SOLO estos campos: ${fields}.
- day_name debe ser el nombre del día de la semana en ${langName} (${target === 'en' ? 'Monday...Sunday' : 'Lunes...Domingo'}).
- NO traduzcas los nombres de marca "Forja" y "Vulcano".
- Usa terminología natural de fitness/nutrición en el idioma destino.

JSON A TRADUCIR:
${JSON.stringify(content)}`;
}

function pickString(orig: Json, trans: Json | undefined, field: string): unknown {
  const t = trans?.[field];
  return typeof t === 'string' && typeof orig[field] === 'string' ? t : orig[field];
}

function requireSameLengthArray(value: unknown, expected: number, label: string): Json[] {
  if (!Array.isArray(value) || value.length !== expected) {
    throw new ShapeMismatchError(`shape mismatch en ${label}`);
  }
  return value as Json[];
}

// Reconstruye el contenido traducido CAMINANDO EL ORIGINAL: solo los campos
// de texto permitidos toman el valor traducido; números y estructura quedan
// intactos por construcción. Lanza ShapeMismatchError si los arrays no calzan.
export function applyTranslation(original: Json, translated: Json, planType: PlanType): Json {
  if (planType === 'workout') {
    const out: Json = { ...original };
    for (const f of WORKOUT_TOP_FIELDS) {
      if (f in original) out[f] = pickString(original, translated, f);
    }
    const origSchedule = (original.schedule ?? []) as Json[];
    const transSchedule = requireSameLengthArray(translated.schedule, origSchedule.length, 'schedule');
    out.schedule = origSchedule.map((day, i) => {
      const tDay = transSchedule[i];
      const dayOut: Json = { ...day };
      for (const f of WORKOUT_DAY_FIELDS) dayOut[f] = pickString(day, tDay, f);
      const origEx = (day.exercises ?? []) as Json[];
      const transEx = requireSameLengthArray(tDay.exercises ?? [], origEx.length, `schedule[${i}].exercises`);
      dayOut.exercises = origEx.map((ex, j) => {
        const exOut: Json = { ...ex };
        for (const f of EXERCISE_FIELDS) exOut[f] = pickString(ex, transEx[j], f);
        return exOut;
      });
      return dayOut;
    });
    return out;
  }

  // meal
  const origMeals = (original.meals ?? {}) as Json;
  const tMeals = translated.meals;
  if (typeof tMeals !== 'object' || tMeals === null || Array.isArray(tMeals)) {
    throw new ShapeMismatchError('shape mismatch en meals');
  }
  const transMeals = tMeals as Json;
  const mealsOut: Json = { ...origMeals };
  for (const f of MEAL_TOP_FIELDS) {
    if (f in origMeals) mealsOut[f] = pickString(origMeals, transMeals, f);
  }
  const origDays = (origMeals.days ?? []) as Json[];
  const transDays = requireSameLengthArray(transMeals.days, origDays.length, 'days');
  mealsOut.days = origDays.map((day, i) => {
    const dayOut: Json = { ...day };
    for (const f of MEAL_DAY_FIELDS) dayOut[f] = pickString(day, transDays[i], f);
    const origItems = (day.meals ?? []) as Json[];
    const transItems = requireSameLengthArray(transDays[i].meals ?? [], origItems.length, `days[${i}].meals`);
    dayOut.meals = origItems.map((meal, j) => {
      const mealOut: Json = { ...meal };
      for (const f of MEAL_ITEM_FIELDS) mealOut[f] = pickString(meal, transItems[j], f);
      const origIng = (meal.ingredients ?? []) as unknown[];
      const tIng = transItems[j].ingredients;
      mealOut.ingredients =
        Array.isArray(tIng) && tIng.length === origIng.length && tIng.every((s) => typeof s === 'string')
          ? tIng
          : origIng;
      return mealOut;
    });
    return dayOut;
  });
  return { title: pickString(original, translated, 'title'), meals: mealsOut };
}

export function mergeTranslations(existing: Json, lang: Language, content: Json): Json {
  return { ...existing, [lang]: content };
}

export async function translatePlan(
  deps: TranslateDeps,
  input: { planType: PlanType; targetLanguage: Language },
): Promise<Json> {
  const plan = await deps.loadPlan();
  if (!plan) throw new PlanNotFoundError('plan not found');

  const original = extractOriginalContent(plan, input.planType);
  const source: Language = plan.source_language === 'en' ? 'en' : 'es';

  // Corto-circuitos sin IA: idioma original o caché existente.
  if (input.targetLanguage === source) return original;
  const cached = (plan.translations as Json | null | undefined)?.[input.targetLanguage];
  if (cached) return cached as Json;

  const raw = await deps.callTranslator(buildTranslationPrompt(input.planType, original, input.targetLanguage));
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new ShapeMismatchError('no JSON en la respuesta de la IA');
  let parsed: Json;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new ShapeMismatchError('JSON inválido de la IA');
  }

  const content = applyTranslation(original, parsed, input.planType);
  await deps.saveTranslation(input.targetLanguage, content);
  return content;
}
```

- [ ] **Step 4: Verificar que pasan**

Run: `cd supabase/functions && deno test translate-plan/logic.test.ts`
Expected: PASS — 9 tests en verde.

- [ ] **Step 5: Verificar que los tests existentes no se rompieron**

Run: `cd supabase/functions && deno test delete-account/logic.test.ts translate-plan/logic.test.ts`
Expected: PASS — 14 tests (5 + 9).

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/translate-plan/logic.ts supabase/functions/translate-plan/logic.test.ts
git commit -m "feat: lógica pura de translate-plan con TDD (corto-circuitos, validación de forma, merge)"
```

---

### Task 3: HTTP wrapper `translate-plan/index.ts` + verificación curl

**Files:**
- Create: `supabase/functions/translate-plan/index.ts`

**Interfaces:**
- Consumes: todo lo exportado por `./logic.ts` (Task 2).
- Produces: `POST /functions/v1/translate-plan` con body `{ plan_type: 'workout' | 'meal', plan_id: string, target_language: 'es' | 'en' }` → `200 { content }`. Errores: `400 invalid_request`, `401 unauthorized`, `404 not_found`, `502 ai_error | invalid_ai_response`, `500 internal_error`. El cliente (Task 4) consume exactamente este contrato.

- [ ] **Step 1: Implementar el wrapper**

Crear `supabase/functions/translate-plan/index.ts`:

```ts
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  mergeTranslations,
  PlanNotFoundError,
  ShapeMismatchError,
  translatePlan,
  type Json,
  type Language,
} from './logic.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'unauthorized' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json(401, { error: 'unauthorized' });

    const body = await req.json().catch(() => null);
    const planType = body?.plan_type;
    const planId = body?.plan_id;
    const target = body?.target_language;
    if (
      (planType !== 'workout' && planType !== 'meal') ||
      typeof planId !== 'string' || planId.length === 0 ||
      (target !== 'es' && target !== 'en')
    ) {
      return json(400, { error: 'invalid_request' });
    }

    const table = planType === 'workout' ? 'workout_plans' : 'meal_plans';
    // El UPDATE de translations va con service role (RLS solo da SELECT/UPDATE
    // de sus filas al usuario; el caché lo administra el servidor).
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const content = await translatePlan(
      {
        loadPlan: async () => {
          // Cliente con el JWT del usuario: RLS + eq(user_id) garantizan propiedad.
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', planId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (error) throw error;
          return data as Json | null;
        },
        callTranslator: async (prompt) => {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              // El JSON de un plan grande ronda los mismos tokens que en
              // generate-plan; mismo techo para no truncar la traducción.
              max_tokens: 16000,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          if (!res.ok) {
            console.error('Anthropic error:', await res.text());
            throw new Error('ai_error');
          }
          const result = await res.json();
          if (result.stop_reason === 'max_tokens') {
            console.error('translate-plan: respuesta truncada (max_tokens)');
            throw new Error('ai_error');
          }
          return result.content?.[0]?.text ?? '';
        },
        saveTranslation: async (lang: Language, translated: Json) => {
          // Releer y mergear para no pisar idiomas cacheados por otra petición.
          const { data: row, error: readError } = await admin
            .from(table)
            .select('translations')
            .eq('id', planId)
            .single();
          if (readError) throw readError;
          const { error } = await admin
            .from(table)
            .update({ translations: mergeTranslations((row?.translations ?? {}) as Json, lang, translated) })
            .eq('id', planId);
          if (error) throw error;
        },
      },
      { planType, targetLanguage: target },
    );

    return json(200, { content });
  } catch (err) {
    if (err instanceof PlanNotFoundError) return json(404, { error: 'not_found' });
    if (err instanceof ShapeMismatchError) {
      console.error('translate-plan shape error:', err.message);
      return json(502, { error: 'invalid_ai_response' });
    }
    if (err instanceof Error && err.message === 'ai_error') return json(502, { error: 'ai_error' });
    console.error('translate-plan error:', err);
    return json(500, { error: 'internal_error' });
  }
});
```

- [ ] **Step 2: Reiniciar edge runtime y probar OPTIONS**

Run: `sg docker -c "docker restart supabase_edge_runtime_forja" && sleep 3 && curl -s -o /dev/null -w "%{http_code}\n" -X OPTIONS http://127.0.0.1:54321/functions/v1/translate-plan`
Expected: `200`.

- [ ] **Step 3: Verificación E2E real con el usuario de prueba**

El usuario `test-planfix@forja.test` (password `Test1234!`) tiene un plan de workout activo en español. Traducirlo a inglés (una llamada Haiku real, costo ínfimo):

```bash
ANON=$(grep -oP 'EXPO_PUBLIC_SUPABASE_ANON_KEY=\K.*' .env.local)
TOKEN=$(curl -s -X POST "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"test-planfix@forja.test","password":"Test1234!"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
PLAN_ID=$(curl -s "http://127.0.0.1:54321/rest/v1/workout_plans?is_active=eq.true&select=id&limit=1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s -X POST http://127.0.0.1:54321/functions/v1/translate-plan \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"plan_type\":\"workout\",\"plan_id\":\"$PLAN_ID\",\"target_language\":\"en\"}" \
  | python3 -m json.tool | head -30
```

Expected: `{ "content": { "title": "<título en inglés>", ... "schedule": [...] } }` con `day_name` en inglés (Monday…) y `sets`/`reps`/`rest_seconds` idénticos al original.

- [ ] **Step 4: Verificar el caché (segunda llamada instantánea, sin IA)**

Repetir el último curl del Step 3 midiendo tiempo:

Run: el mismo curl con `-w "\ntime: %{time_total}s\n" -o /dev/null -s`
Expected: `time` < 1s (la primera tarda varios segundos por Haiku; esta responde del caché).

Verificar persistencia:

Run: `sg docker -c "docker exec supabase_db_forja psql -U postgres -d postgres -c \"select jsonb_object_keys(translations) from workout_plans where translations != '{}';\""`
Expected: al menos una fila con `en`.

- [ ] **Step 5: Casos de error del contrato**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:54321/functions/v1/translate-plan \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"plan_type":"nope","plan_id":"x","target_language":"en"}'
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:54321/functions/v1/translate-plan \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"plan_type":"workout","plan_id":"00000000-0000-0000-0000-000000000000","target_language":"en"}'
```

Expected: `400` y `404` respectivamente.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/translate-plan/index.ts
git commit -m "feat: EF translate-plan — traducción con Haiku, caché por idioma y merge con service role"
```

---

### Task 4: Hook `useLocalizedPlan` + claves i18n

**Files:**
- Create: `hooks/useLocalizedPlan.ts`
- Modify: `locales/es/plans.json`
- Modify: `locales/en/plans.json`

**Interfaces:**
- Consumes: EF `translate-plan` (contrato de Task 3), `useAuthStore` (`session.access_token`), `i18n.language` de react-i18next.
- Produces (consumido por Tasks 5–7):
  - `useLocalizedPlan<T>(plan: LocalizablePlan | null | undefined, planType: 'workout' | 'meal', options?: { trigger?: boolean }): { content: T | null; isTranslating: boolean; error: Error | null }`
  - `interface LocalizablePlan { id: string; title: string; description?: string | null; schedule?: unknown; meals?: unknown; source_language?: string; translations?: Record<string, unknown> | null }`
  - Claves i18n `plans:translating` y `plans:translateError`.

- [ ] **Step 1: Agregar claves i18n (es + en, paridad)**

En `locales/es/plans.json`, agregar al nivel superior del objeto (junto a `"generating"`):

```json
  "translating": "Traduciendo tu plan…",
  "translateError": "No se pudo traducir, mostrando el original",
```

En `locales/en/plans.json`, en la misma posición:

```json
  "translating": "Translating your plan…",
  "translateError": "Couldn't translate, showing the original",
```

- [ ] **Step 2: Verificar paridad**

Run: `npm run check-i18n`
Expected: sin errores de paridad.

- [ ] **Step 3: Implementar el hook**

Crear `hooks/useLocalizedPlan.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import type { AppLanguage } from '@/lib/i18n';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export type LocalizedPlanType = 'workout' | 'meal';

export interface LocalizablePlan {
  id: string;
  title: string;
  description?: string | null;
  schedule?: unknown;
  meals?: unknown;
  source_language?: string;
  translations?: Record<string, unknown> | null;
}

function extractOriginal(plan: LocalizablePlan, planType: LocalizedPlanType): Record<string, unknown> {
  return planType === 'workout'
    ? { title: plan.title, description: plan.description ?? '', schedule: plan.schedule ?? [] }
    : { title: plan.title, meals: plan.meals ?? {} };
}

// Resuelve el contenido del plan en el idioma activo de la app.
// - idioma === source_language → contenido original, instantáneo
// - translations[idioma] cacheado → caché, instantáneo
// - sin caché y trigger=true → dispara la EF translate-plan UNA vez
//   (isTranslating mientras tanto; en error, fallback al original + error)
// - trigger=false (hub): nunca llama a la EF, muestra caché u original
export function useLocalizedPlan<T = Record<string, unknown>>(
  plan: LocalizablePlan | null | undefined,
  planType: LocalizedPlanType,
  options: { trigger?: boolean } = {},
): { content: T | null; isTranslating: boolean; error: Error | null } {
  const trigger = options.trigger ?? true;
  const { i18n } = useTranslation();
  const { session } = useAuthStore();
  const queryClient = useQueryClient();
  const attempted = useRef<string | null>(null);

  const lang: AppLanguage = i18n.language === 'en' ? 'en' : 'es';
  const source: AppLanguage = plan?.source_language === 'en' ? 'en' : 'es';
  const cached = plan?.translations?.[lang];
  const needsTranslation = !!plan && lang !== source && !cached;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/translate-plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_type: planType, plan_id: plan!.id, target_language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'translate_failed');
      return data.content as T;
    },
    onSuccess: () => {
      // Releer el plan con translations[lang] ya persistido.
      queryClient.invalidateQueries({ queryKey: planType === 'workout' ? ['workout_plan'] : ['meal_plan'] });
      if (planType === 'workout') queryClient.invalidateQueries({ queryKey: ['workout_plans'] });
    },
  });
  const { mutate } = mutation;

  useEffect(() => {
    if (!trigger || !needsTranslation || !session || !plan) return;
    const key = `${plan.id}:${lang}`;
    // Un intento por (plan, idioma) por montaje: en error se muestra el
    // original con banner; reabrir la pantalla reintenta.
    if (attempted.current === key) return;
    attempted.current = key;
    mutate();
  }, [trigger, needsTranslation, session, plan, lang, mutate]);

  if (!plan) return { content: null, isTranslating: false, error: null };
  if (lang === source) return { content: extractOriginal(plan, planType) as T, isTranslating: false, error: null };
  if (cached) return { content: cached as T, isTranslating: false, error: null };
  if (mutation.data) return { content: mutation.data, isTranslating: false, error: null };
  if (mutation.isError && trigger) {
    return { content: extractOriginal(plan, planType) as T, isTranslating: false, error: mutation.error as Error };
  }
  if (!trigger) return { content: extractOriginal(plan, planType) as T, isTranslating: false, error: null };
  return { content: null, isTranslating: true, error: null };
}
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add hooks/useLocalizedPlan.ts locales/es/plans.json locales/en/plans.json
git commit -m "feat: hook useLocalizedPlan + claves i18n de traducción de planes"
```

---

### Task 5: Pantalla de detalle del plan de entrenamiento

**Files:**
- Modify: `app/(app)/plans/workout/[id].tsx`

**Interfaces:**
- Consumes: `useLocalizedPlan<LocalizedWorkoutContent>(plan, 'workout')` (Task 4); claves `plans:translating` / `plans:translateError`.

- [ ] **Step 1: Cablear el hook en la pantalla**

En `app/(app)/plans/workout/[id].tsx`:

1. Agregar import:

```ts
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';
```

2. Definir el tipo del contenido localizado junto a los tipos existentes:

```ts
type LocalizedWorkoutContent = {
  title: string;
  description: string;
  schedule: WorkoutDay[];
};
```

3. Después del `useQuery` del plan, agregar:

```ts
  const { content, isTranslating, error: translateError } = useLocalizedPlan<LocalizedWorkoutContent>(
    plan ?? null,
    'workout',
  );
```

4. Extender el bloque de loading para cubrir la traducción — reemplazar la condición `if (isLoading)` por:

```ts
  if (isLoading || (plan && isTranslating)) {
```

y dentro, reemplazar el texto `{t('workout.loading')}` por:

```ts
            {isLoading ? t('workout.loading') : t('translating')}
```

5. Renderizar desde `content` (con fallback defensivo al plan crudo, que solo aplica un frame antes de resolverse el hook). Después del guard `if (!plan)`, reemplazar la línea `const schedule: WorkoutDay[] = Array.isArray(plan.schedule) ? plan.schedule : [];` por:

```ts
  const view = content ?? { title: plan.title, description: plan.description, schedule: plan.schedule };
  const schedule: WorkoutDay[] = Array.isArray(view.schedule) ? view.schedule : [];
```

6. En el JSX, cambiar `{plan.title}` por `{view.title}` y el bloque del subtítulo por:

```tsx
        {(plan.weekly_schedule_summary ?? view.description) ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {plan.weekly_schedule_summary ?? view.description}
          </Text>
        ) : null}
```

(`weekly_schedule_summary` y `progression_notes` no se persisten en la DB — el INSERT solo guarda title/description/schedule — así que quedan como están: render condicional que hoy nunca aparece.)

7. Banner de error de traducción — insertar inmediatamente antes del bloque `{/* StatCards row */}`:

```tsx
        {translateError ? (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 10,
            padding: 10,
            marginTop: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12 }}>
              {t('translateError')}
            </Text>
          </View>
        ) : null}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/plans/workout/[id].tsx"
git commit -m "feat: detalle de workout renderiza contenido localizado con spinner y fallback"
```

---

### Task 6: Pantalla del plan alimenticio

**Files:**
- Modify: `app/(app)/plans/meal/index.tsx`

**Interfaces:**
- Consumes: `useLocalizedPlan<LocalizedMealContent>(activePlan, 'meal')` (Task 4); claves `plans:translating` / `plans:translateError`.

- [ ] **Step 1: Cablear el hook**

En `app/(app)/plans/meal/index.tsx`:

1. Agregar import:

```ts
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';
```

2. Junto a los tipos existentes, agregar:

```ts
type LocalizedMealContent = { title: string; meals: MealPlanData };
```

3. Dentro del componente, después de `const isPremium = useIsPremium();`, agregar:

```ts
  const { content: localized, isTranslating, error: translateError } = useLocalizedPlan<LocalizedMealContent>(
    activePlan ?? null,
    'meal',
  );
```

4. Reemplazar la línea `const planData = activePlan?.meals as MealPlanData | null;` por:

```ts
  // El contenido localizado envuelve el JSON completo del plan (meals);
  // mientras isTranslating, planData es null y se muestra el spinner.
  const planData = (localized?.meals ?? null) as MealPlanData | null;
```

5. Extender el loading — reemplazar `if (isLoading)` por:

```ts
  if (isLoading || (activePlan && isTranslating)) {
```

y dentro del `<View>` centrado, después del `<ActivityIndicator ... />`, agregar:

```tsx
          {isTranslating && (
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, marginTop: 12 }}>
              {t('translating')}
            </Text>
          )}
```

6. Banner de error — dentro del bloque `{activePlan && planData ? (<> ... </>)}`, insertar como PRIMER hijo (antes de `{/* Macros diarios */}`):

```tsx
            {translateError ? (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12 }}>
                  {t('translateError')}
                </Text>
              </View>
            ) : null}
```

(El header con `t('meal.headerMacros', ...)` usa `activePlan.daily_calories` y `planData.macros` — números que no cambian entre idiomas; `planData.title` y los `day_name` del navegador salen traducidos automáticamente al venir de `localized.meals`.)

- [ ] **Step 2: Verificar tipos y paridad i18n**

Run: `npx tsc --noEmit && npm run check-i18n`
Expected: ambos sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/plans/meal/index.tsx"
git commit -m "feat: plan alimenticio renderiza contenido localizado con spinner y fallback"
```

---

### Task 7: Hub pasivo + verificación final

**Files:**
- Modify: `app/(app)/plans/index.tsx`
- Modify: `forja-docs.md` (sección nueva breve)

**Interfaces:**
- Consumes: `useLocalizedPlan(plan, 'workout', { trigger: false })` — modo pasivo: nunca llama a la EF; devuelve caché si existe u original.

- [ ] **Step 1: Modo pasivo en el hub**

En `app/(app)/plans/index.tsx`:

1. Agregar import:

```ts
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';
```

2. Después de `const { generating, generate } = useGeneratePlan(refetch);`, agregar:

```ts
  // Pasivo: muestra la traducción SI ya está cacheada; nunca dispara la EF
  // (listar planes no debe costar llamadas de IA). La traducción se dispara
  // solo al abrir el detalle.
  const { content: localized } = useLocalizedPlan<{
    title: string;
    description: string;
    schedule: WorkoutDay[];
  }>(activePlan ?? null, 'workout', { trigger: false });
```

**Nota:** el tipo `WorkoutDay` está declarado DENTRO del componente, después de este punto — mover la declaración `type WorkoutDay = {...}` fuera del componente (arriba de `function getTodayDayIndex()`), sin cambiarla.

3. Reemplazar la asignación de `schedule`:

```ts
  const schedule: WorkoutDay[] = Array.isArray(localized?.schedule)
    ? localized.schedule
    : Array.isArray(activePlan?.schedule)
    ? (activePlan.schedule as unknown as WorkoutDay[])
    : [];
```

4. En la card del plan activo, cambiar `{(activePlan as { title: string }).title}` por:

```tsx
                {localized?.title ?? (activePlan as { title: string }).title}
```

y el bloque de descripción por:

```tsx
              {(localized?.description ?? (activePlan as { description?: string }).description) ? (
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                  {localized?.description ?? (activePlan as { description: string }).description}
                </Text>
              ) : null}
```

(`todayWorkout.day_name` y `todayWorkout.focus` salen de `schedule`, que ya es el localizado cuando hay caché.)

- [ ] **Step 2: Verificación estática completa**

Run: `npx tsc --noEmit && npm run check-i18n && (cd supabase/functions && deno test translate-plan/logic.test.ts delete-account/logic.test.ts)`
Expected: todo en verde.

- [ ] **Step 3: Documentar en forja-docs.md**

Agregar al final de `forja-docs.md` una sección breve:

```markdown
## Traducción de planes (caché por idioma)

Los planes IA guardan `source_language` ('es'|'en') y un caché `translations JSONB`
(`{ "<lang>": contenido }`) en `workout_plans`/`meal_plans` (migración 0010). La EF
`translate-plan` (Haiku `claude-haiku-4-5-20251001`, lógica pura TDD en `logic.ts`)
traduce UNA vez por idioma: idioma original o cacheado → respuesta instantánea sin IA.
La validación de forma reconstruye el JSON caminando el original (números intactos por
construcción; rechaza si cambia el nº de días/ejercicios/comidas — no se cachea basura).
En el cliente, `hooks/useLocalizedPlan.ts` resuelve el contenido a renderizar; las
pantallas de detalle disparan la traducción al abrir (spinner `plans:translating`,
error → original + banner `plans:translateError`); el hub usa `{ trigger: false }` y
nunca llama a la EF. Spec: `docs/superpowers/specs/2026-07-09-plan-translation-design.md`.
```

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/plans/index.tsx" forja-docs.md
git commit -m "feat: hub de planes en modo pasivo de traducción + docs"
```

- [ ] **Step 5: E2E humano en Expo Go (checklist de la spec §8 — lo ejecuta el usuario)**

1. Plan viejo (ES) + app en EN → al abrir el detalle: spinner "Translating your plan…" y luego contenido en inglés.
2. Cerrar y reabrir el plan → instantáneo (caché).
3. Cambiar la app a ES y abrir el plan → instantáneo, contenido español original.
4. Números idénticos entre idiomas (sets/reps/descansos en workout; calorías/macros en meal).
5. Generar un plan nuevo con la app en EN → se guarda con `source_language='en'` y verlo en EN no dispara traducción (verificar en DB: `select source_language from workout_plans order by created_at desc limit 1;`).
6. Forzar fallo de la EF (parar el edge runtime: `sg docker -c "docker stop supabase_edge_runtime_forja"`, abrir un plan sin caché en el otro idioma) → banner "Couldn't translate, showing the original", sin crash. Reactivar después: `sg docker -c "docker start supabase_edge_runtime_forja"`.

No commitear nada nuevo aquí; si algún punto falla, se abre fix puntual.
