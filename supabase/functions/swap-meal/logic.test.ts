import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert';
import {
  applySwap,
  InvalidCandidateError,
  locateMeal,
  MealNotFoundError,
  PlanNotFoundError,
  SwapLimitReachedError,
  swapMealAccept,
  swapMealPreview,
  TooManyAttemptsError,
  validateCandidate,
  type Json,
} from './logic.ts';

const samplePlanMeals: Json = {
  title: 'Plan Hipertrofia',
  days: [
    {
      day_number: 1,
      day_name: 'Lunes',
      total_calories: 2800,
      meals: [
        { meal_type: 'Desayuno', time_suggestion: '7:00', name: 'Avena', calories: 500, protein_g: 30, carbs_g: 60, fat_g: 10, ingredients: ['avena', 'leche'] },
        { meal_type: 'Almuerzo', time_suggestion: '13:00', name: 'Pollo con arroz', calories: 700, protein_g: 50, carbs_g: 80, fat_g: 15, ingredients: ['pollo', 'arroz'] },
      ],
    },
    {
      day_number: 2,
      day_name: 'Martes',
      total_calories: 2800,
      meals: [
        { meal_type: 'Desayuno', time_suggestion: '7:00', name: 'Huevos', calories: 450, protein_g: 32, carbs_g: 20, fat_g: 25, ingredients: ['huevo'] },
      ],
    },
  ],
};

const validCandidate = {
  meal_type: 'Desayuno',
  time_suggestion: '7:30',
  name: 'Yogur con granola',
  calories: 480,
  protein_g: 28,
  carbs_g: 55,
  fat_g: 12,
  ingredients: ['yogur griego', 'granola', 'miel'],
};

Deno.test('validateCandidate acepta forma correcta', () => {
  const result = validateCandidate(validCandidate);
  assertEquals(result.name, 'Yogur con granola');
});

Deno.test('validateCandidate rechaza calories <= 0', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, calories: 0 }), InvalidCandidateError);
});

Deno.test('validateCandidate rechaza ingredients vacío', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, ingredients: [] }), InvalidCandidateError);
});

Deno.test('validateCandidate rechaza protein_g negativo', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, protein_g: -1 }), InvalidCandidateError);
});

Deno.test('validateCandidate rechaza name vacío', () => {
  assertThrows(() => validateCandidate({ ...validCandidate, name: '' }), InvalidCandidateError);
});

Deno.test('locateMeal encuentra el día por day_number, no por posición', () => {
  // day_number:2 está en la posición 1 del array — si locateMeal usara
  // days[dayNumber-1] esto fallaría igual (coincide por casualidad aquí),
  // así que se prueba también con un array reordenado.
  const reordered: Json = { days: [samplePlanMeals.days as Json[]][0].slice().reverse() as unknown as Json };
  const { meal } = locateMeal(reordered, 2, 0);
  assertEquals((meal as Json).name, 'Huevos');
});

Deno.test('locateMeal lanza MealNotFoundError con day_number inexistente', () => {
  assertThrows(() => locateMeal(samplePlanMeals, 99, 0), MealNotFoundError);
});

Deno.test('locateMeal lanza MealNotFoundError con meal_index fuera de rango', () => {
  assertThrows(() => locateMeal(samplePlanMeals, 1, 5), MealNotFoundError);
});

Deno.test('applySwap reemplaza solo la comida indicada, el resto intacto', () => {
  const result = applySwap(samplePlanMeals, 1, 0, validCandidate);
  const days = result.days as Json[];
  assertEquals((days[0].meals as Json[])[0].name, 'Yogur con granola');
  assertEquals((days[0].meals as Json[])[1].name, 'Pollo con arroz');
  assertEquals((days[1].meals as Json[])[0].name, 'Huevos');
});

Deno.test('swapMealPreview: happy path devuelve el candidato validado', async () => {
  const candidate = await swapMealPreview(
    {
      loadMealPlan: async () => ({ meals: samplePlanMeals }),
      loadFoodPreferences: async () => ({ allergies: ['gluten'], dislikes: [] }),
      callAI: async () => JSON.stringify(validCandidate),
    },
    { dayNumber: 1, mealIndex: 0, attemptNumber: 1, language: 'es' },
  );
  assertEquals(candidate.name, 'Yogur con granola');
});

Deno.test('swapMealPreview: rechaza attempt_number > 3', async () => {
  await assertRejects(
    () => swapMealPreview(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        loadFoodPreferences: async () => ({ allergies: [], dislikes: [] }),
        callAI: async () => JSON.stringify(validCandidate),
      },
      { dayNumber: 1, mealIndex: 0, attemptNumber: 4, language: 'es' },
    ),
    TooManyAttemptsError,
  );
});

Deno.test('swapMealPreview: plan inexistente lanza PlanNotFoundError', async () => {
  await assertRejects(
    () => swapMealPreview(
      {
        loadMealPlan: async () => null,
        loadFoodPreferences: async () => ({ allergies: [], dislikes: [] }),
        callAI: async () => JSON.stringify(validCandidate),
      },
      { dayNumber: 1, mealIndex: 0, attemptNumber: 1, language: 'es' },
    ),
    PlanNotFoundError,
  );
});

Deno.test('swapMealPreview: respuesta de IA sin JSON lanza InvalidCandidateError', async () => {
  await assertRejects(
    () => swapMealPreview(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        loadFoodPreferences: async () => ({ allergies: [], dislikes: [] }),
        callAI: async () => 'no soy json',
      },
      { dayNumber: 1, mealIndex: 0, attemptNumber: 1, language: 'es' },
    ),
    InvalidCandidateError,
  );
});

Deno.test('swapMealAccept: happy path llama saveSwap con la forma correcta', async () => {
  let saved: Json | null = null;
  await swapMealAccept(
    {
      loadMealPlan: async () => ({ meals: samplePlanMeals }),
      countRecentSwaps: async () => 0,
      isPremium: async () => false,
      saveSwap: async (input) => { saved = input as unknown as Json; },
    },
    { dayNumber: 1, mealIndex: 0, candidate: validCandidate },
  );
  assertEquals((saved as unknown as { oldMealName: string }).oldMealName, 'Avena');
  assertEquals((saved as unknown as { newMealName: string }).newMealName, 'Yogur con granola');
});

Deno.test('swapMealAccept: free en el límite semanal lanza SwapLimitReachedError', async () => {
  await assertRejects(
    () => swapMealAccept(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        countRecentSwaps: async () => 3,
        isPremium: async () => false,
        saveSwap: async () => {},
      },
      { dayNumber: 1, mealIndex: 0, candidate: validCandidate },
    ),
    SwapLimitReachedError,
  );
});

Deno.test('swapMealAccept: premium en el límite semanal NO lanza (sin límite)', async () => {
  let called = false;
  await swapMealAccept(
    {
      loadMealPlan: async () => ({ meals: samplePlanMeals }),
      countRecentSwaps: async () => 50,
      isPremium: async () => true,
      saveSwap: async () => { called = true; },
    },
    { dayNumber: 1, mealIndex: 0, candidate: validCandidate },
  );
  assertEquals(called, true);
});

Deno.test('swapMealAccept: candidato inválido lanza InvalidCandidateError sin llamar saveSwap', async () => {
  let called = false;
  await assertRejects(
    () => swapMealAccept(
      {
        loadMealPlan: async () => ({ meals: samplePlanMeals }),
        countRecentSwaps: async () => 0,
        isPremium: async () => false,
        saveSwap: async () => { called = true; },
      },
      { dayNumber: 1, mealIndex: 0, candidate: { ...validCandidate, calories: -5 } },
    ),
    InvalidCandidateError,
  );
  assertEquals(called, false);
});
