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

Deno.test('applyTranslation rechaza un elemento null dentro de schedule', () => {
  assertThrows(
    () => applyTranslation(
      { title: 't', description: 'd', schedule: (workoutRow.schedule as Json[]) },
      { title: 't2', description: 'd2', schedule: [null] },
      'workout',
    ),
    ShapeMismatchError,
  );
});

Deno.test('applyTranslation rechaza un elemento null dentro de days (meal)', () => {
  assertThrows(
    () => applyTranslation(
      { title: 't', meals: (mealRow.meals as Json) },
      { title: 't2', meals: { title: 't2', description: 'd', days: [null] } },
      'meal',
    ),
    ShapeMismatchError,
  );
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
