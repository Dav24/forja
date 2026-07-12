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
