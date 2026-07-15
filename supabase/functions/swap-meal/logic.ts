export type Json = Record<string, unknown>;

export class PlanNotFoundError extends Error {}
export class MealNotFoundError extends Error {}
export class InvalidCandidateError extends Error {}
export class SwapLimitReachedError extends Error {}
export class TooManyAttemptsError extends Error {}

export interface MealCandidate {
  meal_type: string;
  time_suggestion: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

const MAX_PREVIEW_ATTEMPTS = 3;
const FREE_WEEKLY_SWAP_LIMIT = 3;

export function validateCandidate(value: unknown): MealCandidate {
  if (typeof value !== 'object' || value === null) throw new InvalidCandidateError('candidate no es un objeto');
  const c = value as Record<string, unknown>;
  if (typeof c.meal_type !== 'string' || c.meal_type.length === 0) throw new InvalidCandidateError('meal_type inválido');
  if (typeof c.time_suggestion !== 'string' || c.time_suggestion.length === 0) throw new InvalidCandidateError('time_suggestion inválido');
  if (typeof c.name !== 'string' || c.name.length === 0) throw new InvalidCandidateError('name inválido');
  if (typeof c.calories !== 'number' || !(c.calories > 0)) throw new InvalidCandidateError('calories inválido');
  for (const f of ['protein_g', 'carbs_g', 'fat_g'] as const) {
    if (typeof c[f] !== 'number' || (c[f] as number) < 0) throw new InvalidCandidateError(`${f} inválido`);
  }
  if (
    !Array.isArray(c.ingredients) ||
    c.ingredients.length === 0 ||
    !c.ingredients.every((i) => typeof i === 'string' && i.length > 0)
  ) {
    throw new InvalidCandidateError('ingredients inválido');
  }
  return {
    meal_type: c.meal_type,
    time_suggestion: c.time_suggestion,
    name: c.name,
    calories: c.calories,
    protein_g: c.protein_g as number,
    carbs_g: c.carbs_g as number,
    fat_g: c.fat_g as number,
    ingredients: c.ingredients as string[],
  };
}

export function locateMeal(
  planMeals: Json,
  dayNumber: number,
  mealIndex: number,
): { dayIndex: number; meal: Json; day: Json } {
  const days = (planMeals.days ?? []) as Json[];
  const dayIndex = days.findIndex((d) => d.day_number === dayNumber);
  if (dayIndex === -1) throw new MealNotFoundError(`día ${dayNumber} no existe`);
  const meals = (days[dayIndex].meals ?? []) as Json[];
  if (mealIndex < 0 || mealIndex >= meals.length) throw new MealNotFoundError(`meal_index ${mealIndex} fuera de rango`);
  return { dayIndex, meal: meals[mealIndex], day: days[dayIndex] };
}

export function applySwap(planMeals: Json, dayNumber: number, mealIndex: number, candidate: MealCandidate): Json {
  const { dayIndex } = locateMeal(planMeals, dayNumber, mealIndex);
  const days = (planMeals.days ?? []) as Json[];
  const newDays = days.map((day, i) => {
    if (i !== dayIndex) return day;
    const meals = (day.meals ?? []) as Json[];
    const newMeals = meals.map((m, j) => (j === mealIndex ? { ...candidate } : m));
    return { ...day, meals: newMeals };
  });
  return { ...planMeals, days: newDays };
}

export function buildSwapPrompt(input: {
  currentMeal: Json;
  otherMeals: Json[];
  allergies: string[];
  dislikes: string[];
  language: 'es' | 'en';
}): string {
  const langLine = input.language === 'en'
    ? 'LANGUAGE: Write ALL text values in ENGLISH.'
    : 'IDIOMA: Escribe TODOS los valores de texto en español.';
  return `Eres un nutriólogo deportivo. El usuario quiere reemplazar UNA comida de su plan por otra con calorías equivalentes. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin explicaciones.

COMIDA A REEMPLAZAR: ${JSON.stringify(input.currentMeal)}

OTRAS COMIDAS DEL MISMO DÍA (para mantener coherencia de estilo, no las repitas): ${JSON.stringify(input.otherMeals)}

- Alergias/intolerancias (NUNCA sugerir): ${input.allergies.join(', ') || 'ninguna'}
- Disgustos declarados (evitar si es posible): ${input.dislikes.join(', ') || 'ninguno'}
- Calorías objetivo: dentro de ±10% de ${(input.currentMeal as { calories?: number }).calories ?? 0} kcal.
- meal_type debe ser exactamente el mismo que la comida a reemplazar.
- El nombre y los ingredientes deben ser claramente distintos a la comida a reemplazar.

${langLine}

FORMATO JSON REQUERIDO (responde EXACTAMENTE así, un solo objeto de comida):
{ "meal_type": "...", "time_suggestion": "...", "name": "...", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "ingredients": ["..."] }`;
}

export interface PreviewDeps {
  loadMealPlan(): Promise<{ meals: Json } | null>;
  loadFoodPreferences(): Promise<{ allergies: string[]; dislikes: string[] }>;
  callAI(prompt: string): Promise<string>;
}

export async function swapMealPreview(
  deps: PreviewDeps,
  input: { dayNumber: number; mealIndex: number; attemptNumber: number; language: 'es' | 'en' },
): Promise<MealCandidate> {
  if (input.attemptNumber > MAX_PREVIEW_ATTEMPTS) {
    throw new TooManyAttemptsError('máximo de intentos de preview alcanzado');
  }
  const plan = await deps.loadMealPlan();
  if (!plan) throw new PlanNotFoundError('plan no encontrado');
  const { meal: currentMeal, day } = locateMeal(plan.meals, input.dayNumber, input.mealIndex);
  const otherMeals = ((day.meals ?? []) as Json[]).filter((m) => m !== currentMeal);
  const { allergies, dislikes } = await deps.loadFoodPreferences();
  const prompt = buildSwapPrompt({ currentMeal, otherMeals, allergies, dislikes, language: input.language });
  const raw = await deps.callAI(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new InvalidCandidateError('sin JSON en la respuesta de la IA');
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new InvalidCandidateError('JSON inválido de la IA');
  }
  return validateCandidate(parsed);
}

export interface AcceptDeps {
  loadMealPlan(): Promise<{ meals: Json } | null>;
  countRecentSwaps(): Promise<number>;
  isPremium(): Promise<boolean>;
  saveSwap(input: {
    updatedMeals: Json;
    oldMealName: string;
    newMealName: string;
    dayNumber: number;
    mealIndex: number;
  }): Promise<void>;
}

export async function swapMealAccept(
  deps: AcceptDeps,
  input: { dayNumber: number; mealIndex: number; candidate: unknown },
): Promise<void> {
  const candidate = validateCandidate(input.candidate);
  const plan = await deps.loadMealPlan();
  if (!plan) throw new PlanNotFoundError('plan no encontrado');
  const { meal: currentMeal } = locateMeal(plan.meals, input.dayNumber, input.mealIndex);

  const premium = await deps.isPremium();
  if (!premium) {
    const recentCount = await deps.countRecentSwaps();
    if (recentCount >= FREE_WEEKLY_SWAP_LIMIT) throw new SwapLimitReachedError('límite semanal alcanzado');
  }

  const updatedMeals = applySwap(plan.meals, input.dayNumber, input.mealIndex, candidate);
  await deps.saveSwap({
    updatedMeals,
    oldMealName: String((currentMeal as { name?: unknown }).name ?? ''),
    newMealName: candidate.name,
    dayNumber: input.dayNumber,
    mealIndex: input.mealIndex,
  });
}
