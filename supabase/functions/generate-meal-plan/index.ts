import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const FREE_MEAL_PLAN_LIFETIME_LIMIT = 1;
const PREMIUM_MEAL_PLAN_MONTHLY_LIMIT = 10;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildMealPlanPrompt(userData: {
  goal_type: string;
  fitness_level: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  gender: string | null;
  activity_level: string | null;
  allergies: string[];
  dislikes: string[];
  diet_type: string;
  food_availability: string;
  language: 'es' | 'en';
  athleticBackground: string | null;
  supplements: string[];
  supplementsOther: string | null;
}): string {
  const goalMap: Record<string, string> = {
    weight_loss: 'pérdida de grasa',
    muscle_gain: 'ganancia muscular (hipertrofia)',
    recomposition: 'recomposición corporal',
    powerlifting: 'fuerza/powerlifting',
    sport_specific: 'rendimiento deportivo',
    general_fitness: 'salud y condición física general',
  };

  const availabilityMap: Record<string, string> = {
    'básica': 'ingredientes básicos y fáciles de conseguir (pollo, arroz, huevos, verduras comunes)',
    'media': 'variedad moderada de ingredientes (carnes diversas, legumbres, frutas variadas)',
    'amplia': 'acceso a ingredientes especializados (proteínas variadas, superfoods, productos importados)',
  };

  const backgroundMap: Record<string, string> = {
    amateur: 'competidor amateur',
    high_performance: 'competidor de alto rendimiento',
    bodybuilding: 'fisicoculturismo competitivo',
  };
  const backgroundLine = userData.athleticBackground && userData.athleticBackground !== 'none'
    ? `- Trayectoria competitiva declarada: ${backgroundMap[userData.athleticBackground] ?? userData.athleticBackground} — ajusta el timing/cantidad de comidas si es relevante.\n`
    : '';
  const supplementsList = userData.supplements.filter((s) => s !== 'none');
  const supplementsLine = supplementsList.length > 0 || userData.supplementsOther
    ? `- Suplementación declarada (SOLO contexto): ${[...supplementsList, userData.supplementsOther].filter(Boolean).join(', ')}\nREGLA DE SEGURIDAD: el dato de suplementación es únicamente contexto (p.ej. no dupliques una recomendación de proteína si el usuario ya toma un shake). Bajo NINGUNA circunstancia recomiendes, apruebes, sugieras dosis, o valides el uso de sustancias o suplementos.\n`
    : '';

  return `Eres un nutriólogo deportivo de élite. Genera un plan alimenticio semanal COMPLETO y DETALLADO de 7 días para el siguiente perfil. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin explicaciones.

PERFIL DEL USUARIO:
- Objetivo: ${goalMap[userData.goal_type] ?? userData.goal_type}
- Nivel de fitness: ${userData.fitness_level}
${userData.weight_kg ? `- Peso: ${userData.weight_kg} kg` : ''}
${userData.height_cm ? `- Estatura: ${userData.height_cm} cm` : ''}
${userData.age ? `- Edad: ${userData.age} años` : ''}
${userData.gender ? `- Género: ${userData.gender}` : ''}
${userData.activity_level ? `- Nivel de actividad: ${userData.activity_level}` : ''}
- Alergias/intolerancias (NUNCA sugerir): ${userData.allergies.join(', ') || 'ninguna'}
- Disgustos declarados (evitar si es posible, no es riesgo de seguridad): ${userData.dislikes.join(', ') || 'ninguno'}
- Tipo de dieta: ${userData.diet_type}
- Disponibilidad de alimentos: ${availabilityMap[userData.food_availability] ?? userData.food_availability}
${backgroundLine}${supplementsLine}
IMPORTANTE: Los planes no sustituyen la valoración de un nutriólogo. No promuevas restricciones extremas ni conductas que pongan en riesgo la salud.

${userData.language === 'en'
  ? 'LANGUAGE: Write ALL content values (title, description, day_name, meal_type, name, ingredients) in ENGLISH. day_name must be the English weekday name (Monday...Sunday). Keep every JSON key exactly as specified.'
  : 'IDIOMA: Escribe TODOS los valores de contenido en español. day_name en español (Lunes...Domingo). Mantén las claves JSON exactamente como se especifican.'}

FORMATO JSON REQUERIDO (responde EXACTAMENTE así):
{
  "title": "Nombre del plan (ej: Plan Nutrición Hipertrofia — 2800 kcal)",
  "description": "Descripción breve del enfoque nutricional (2-3 oraciones)",
  "daily_calories": 2800,
  "macros": { "protein_g": 210, "carbs_g": 280, "fat_g": 80 },
  "days": [
    {
      "day_number": 1,
      "day_name": "Lunes",
      "total_calories": 2800,
      "meals": [
        {
          "meal_type": "Desayuno",
          "time_suggestion": "7:00–8:00",
          "name": "Avena proteica con fruta",
          "calories": 520,
          "protein_g": 35,
          "carbs_g": 65,
          "fat_g": 10,
          "ingredients": ["80g avena", "1 scoop proteína", "1 plátano", "200ml leche desnatada"]
        },
        { "meal_type": "Media mañana", "time_suggestion": "10:00–10:30", "name": "...", "calories": 250, "protein_g": 20, "carbs_g": 25, "fat_g": 8, "ingredients": ["..."] },
        { "meal_type": "Almuerzo", "time_suggestion": "13:00–14:00", "name": "...", "calories": 700, "protein_g": 55, "carbs_g": 80, "fat_g": 20, "ingredients": ["..."] },
        { "meal_type": "Merienda", "time_suggestion": "17:00–17:30", "name": "...", "calories": 300, "protein_g": 25, "carbs_g": 30, "fat_g": 8, "ingredients": ["..."] },
        { "meal_type": "Cena", "time_suggestion": "20:00–21:00", "name": "...", "calories": 600, "protein_g": 50, "carbs_g": 60, "fat_g": 15, "ingredients": ["..."] }
      ]
    }
  ]
}

Genera exactamente 7 días distintos con variedad. Cada día debe tener exactamente 5 comidas: ${
    userData.language === 'en'
      ? 'Breakfast, Mid-morning snack, Lunch, Afternoon snack, Dinner'
      : 'Desayuno, Media mañana, Almuerzo, Merienda y Cena'
  }. Las calorías de las comidas deben sumar aproximadamente el total diario. Respeta ESTRICTAMENTE las alergias indicadas — es una regla de seguridad, no una preferencia. Evita los disgustos declarados salvo que sea imposible por las demás restricciones.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'method_not_allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  let jobId: string | null = null;

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

    const [subResult, totalPlansResult, activeJobResult] = await Promise.all([
      supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle(),
      supabase.from('meal_plans').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase
        .from('async_jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'generate_meal_plan')
        .in('status', ['pending', 'processing'])
        .limit(1)
        .maybeSingle(),
    ]);

    if (activeJobResult.data) {
      return new Response(
        JSON.stringify({ error: 'generation_in_progress', job_id: activeJobResult.data.id }),
        { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const isPremium = subResult.data?.status === 'active' && subResult.data?.plan !== 'free';
    const totalPlans = totalPlansResult.count ?? 0;

    if (isPremium) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: monthlyCount } = await supabase
        .from('meal_plans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString());
      if ((monthlyCount ?? 0) >= PREMIUM_MEAL_PLAN_MONTHLY_LIMIT) {
        return new Response(
          JSON.stringify({ error: 'meal_plan_limit_reached', count: monthlyCount }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
    } else if (totalPlans >= FREE_MEAL_PLAN_LIFETIME_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'meal_plan_limit_reached', count: totalPlans }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();

    const VALID_DIETS = ['omnívoro', 'vegetariano', 'vegano', 'sin gluten', 'keto'];
    const VALID_AVAILABILITY = ['básica', 'media', 'amplia'];

    const { diet_type: rawDiet = 'omnívoro', food_availability: rawAvailability = 'media' } = body;

    const diet_type = VALID_DIETS.includes(String(rawDiet).toLowerCase()) ? String(rawDiet).toLowerCase() : 'omnívoro';
    const food_availability = VALID_AVAILABILITY.includes(String(rawAvailability).toLowerCase()) ? String(rawAvailability).toLowerCase() : 'media';

    const [goalResult, bodyResult, profileResult, foodPrefResult] = await Promise.all([
      supabase.from('goals').select('type, fitness_level, athletic_background')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('body_data').select('weight_kg, height_cm, age, gender, activity_level')
        .eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('language, supplements, supplements_other').eq('id', user.id).maybeSingle(),
      supabase.from('food_preferences').select('item, kind').eq('user_id', user.id),
    ]);

    const allergyItems = (foodPrefResult.data ?? []).filter((r) => r.kind === 'allergy').map((r) => r.item);
    const dislikeItems = (foodPrefResult.data ?? []).filter((r) => r.kind === 'dislike').map((r) => r.item);

    const language: 'es' | 'en' = profileResult.data?.language === 'en' ? 'en' : 'es';

    if (!goalResult.data) {
      return new Response(
        JSON.stringify({ error: 'no_active_goal' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('async_jobs')
      .insert({ user_id: user.id, type: 'generate_meal_plan', status: 'processing' })
      .select('id').single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'internal_error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    jobId = job.id;

    const prompt = buildMealPlanPrompt({
      goal_type: goalResult.data.type,
      fitness_level: goalResult.data.fitness_level,
      weight_kg: bodyResult.data?.weight_kg ? Number(bodyResult.data.weight_kg) : null,
      height_cm: bodyResult.data?.height_cm ? Number(bodyResult.data.height_cm) : null,
      age: bodyResult.data?.age ?? null,
      gender: bodyResult.data?.gender ?? null,
      activity_level: bodyResult.data?.activity_level ?? null,
      allergies: allergyItems,
      dislikes: dislikeItems,
      diet_type,
      food_availability,
      language,
      athleticBackground: goalResult.data.athletic_background ?? null,
      supplements: (profileResult.data?.supplements as string[] | null) ?? [],
      supplementsOther: profileResult.data?.supplements_other ?? null,
    });

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      await supabase.from('async_jobs')
        .update({ status: 'failed', error: `Anthropic error: ${anthropicRes.status}`, completed_at: new Date().toISOString() })
        .eq('id', job.id);
      return new Response(
        JSON.stringify({ error: 'ai_error', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const aiResult = await anthropicRes.json();
    const rawContent = aiResult.content?.[0]?.text ?? '';

    let planData: Record<string, unknown>;
    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      planData = JSON.parse(jsonMatch[0]);
      if (!planData || !Array.isArray(planData.days) || planData.days.length === 0) {
        throw new Error('invalid_plan_structure');
      }
    } catch (e) {
      console.error('Error parsing plan JSON:', e, rawContent.slice(0, 500));
      await supabase.from('async_jobs')
        .update({ status: 'failed', error: 'Invalid JSON from AI', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      return new Response(
        JSON.stringify({ error: 'invalid_ai_response', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('meal_plans')
      .update({ is_active: false })
      .eq('user_id', user.id).eq('is_active', true);

    const macros = (planData.macros ?? {}) as Record<string, number>;

    const { data: savedPlan, error: planError } = await supabase
      .from('meal_plans')
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
      .select('id').single();

    if (planError || !savedPlan) {
      await supabase.from('async_jobs')
        .update({ status: 'failed', error: 'DB insert failed', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      return new Response(
        JSON.stringify({ error: 'db_error', job_id: job.id }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    await supabase.from('async_jobs')
      .update({ status: 'completed', result: { plan_id: savedPlan.id }, completed_at: new Date().toISOString() })
      .eq('id', job.id);

    return new Response(
      JSON.stringify({ job_id: job.id, status: 'completed', plan_id: savedPlan.id, plan: planData }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('generate-meal-plan error:', err);
    if (jobId) {
      const cleanupClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      await cleanupClient
        .from('async_jobs')
        .update({ status: 'failed', error: 'unexpected_error', completed_at: new Date().toISOString() })
        .eq('id', jobId)
        .catch(() => {}); // no propagar error del cleanup
    }
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
