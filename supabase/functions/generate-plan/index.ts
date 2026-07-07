import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODALITY_LABELS: Record<string, string> = {
  gym_strength: 'fuerza en gimnasio (pesas y máquinas)',
  functional: 'entrenamiento funcional / CrossFit / HIIT',
  endurance: 'cardio de resistencia (correr, caminar, caminadora)',
  cycling: 'ciclismo / spinning',
  swimming: 'natación',
  home_calisthenics: 'entrenamiento en casa / calistenia',
  mobility: 'yoga / pilates / movilidad',
  ball_sports: 'preparación física para deporte con balón',
};
const VALID_MODALITIES = new Set(Object.keys(MODALITY_LABELS));

function buildPlanPrompt(userData: {
  goal_type: string;
  fitness_level: string;
  sport_type: string | null;
  mode: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  gender: string | null;
  activity_level: string | null;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string;
  injuries: string;
  modality: string | null;
  secondary_modalities: string[];
}): string {
  const goalMap: Record<string, string> = {
    weight_loss: 'pérdida de grasa',
    muscle_gain: 'ganancia muscular (hipertrofia)',
    recomposition: 'recomposición corporal',
    powerlifting: 'fuerza/powerlifting',
    sport_specific: `rendimiento deportivo (${userData.sport_type ?? 'deporte general'})`,
    general_fitness: 'salud y condición física general',
  };

  const levelMap: Record<string, string> = {
    casual: 'principiante (menos de 1 año)',
    intermediate: 'intermedio (1-3 años)',
    intensive: 'avanzado-intermedio (3-5 años)',
    advanced: 'avanzado (5+ años)',
    elite: 'élite/competidor',
  };

  return `Eres un entrenador personal de élite. Genera un plan de entrenamiento semanal COMPLETO y DETALLADO para el siguiente perfil de usuario. Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin explicaciones, solo el JSON.

PERFIL DEL USUARIO:
- Objetivo: ${goalMap[userData.goal_type] ?? userData.goal_type}
- Nivel: ${levelMap[userData.fitness_level] ?? userData.fitness_level}
- Modalidad: ${userData.mode === 'strict' ? 'Estricto (sigue el plan al pie de la letra)' : 'Flexible (puede adaptar según el día)'}
- Días disponibles por semana: ${userData.days_per_week}
- Minutos por sesión: ${userData.minutes_per_session}
- Equipo disponible: ${userData.equipment}
${userData.modality ? `- Disciplina PRINCIPAL: ${MODALITY_LABELS[userData.modality]}` : ''}
${userData.secondary_modalities.length > 0 ? `- Disciplinas secundarias: ${userData.secondary_modalities.map((s) => MODALITY_LABELS[s]).join(', ')}` : ''}
${userData.weight_kg ? `- Peso: ${userData.weight_kg} kg` : ''}
${userData.height_cm ? `- Estatura: ${userData.height_cm} cm` : ''}
${userData.age ? `- Edad: ${userData.age} años` : ''}
${userData.gender ? `- Género: ${userData.gender}` : ''}
${userData.activity_level ? `- Nivel de actividad diaria: ${userData.activity_level}` : ''}
${userData.injuries ? `- Lesiones o limitaciones: ${userData.injuries}` : ''}

FORMATO JSON REQUERIDO (responde EXACTAMENTE así):
{
  "title": "Nombre del plan (ej: Plan Hipertrofia 4 días)",
  "description": "Descripción breve del plan, enfoque y metodología (2-3 oraciones)",
  "duration_weeks": 8,
  "weekly_schedule_summary": "ej: Lun-Mar-Jue-Vie o Lun-Mié-Vie",
  "progression_notes": "Instrucciones de progresión semanal para el usuario",
  "schedule": [
    {
      "day_number": 1,
      "day_name": "Lunes",
      "is_rest": false,
      "focus": "Push - Pecho, Hombros, Tríceps",
      "estimated_duration_minutes": 60,
      "exercises": [
        {
          "order": 1,
          "name": "Press de banca con barra",
          "muscle_group": "Pecho",
          "sets": 4,
          "reps": "8-10",
          "rest_seconds": 90,
          "technique_notes": "Control excéntrico de 2-3 segundos"
        }
      ]
    },
    {
      "day_number": 2,
      "day_name": "Martes",
      "is_rest": true,
      "focus": "Descanso activo",
      "estimated_duration_minutes": 0,
      "exercises": []
    }
  ]
}

${userData.modality ? `INSTRUCCIONES DE DISCIPLINA:
- El plan es de ${MODALITY_LABELS[userData.modality]}: TODOS los días de entrenamiento se centran en esa disciplina.
- Adapta los campos del JSON semánticamente a la disciplina. Ejemplos: cardio → { "name": "Intervalos 6×400m", "sets": 6, "reps": "400m", "rest_seconds": 90 }; natación → { "name": "Series de crol", "sets": 8, "reps": "100m" }; yoga/movilidad → { "name": "Secuencia saludo al sol", "sets": 1, "reps": "5 rondas", "technique_notes": "Respiración ujjayi, un movimiento por respiración" }.
${userData.secondary_modalities.length > 0 ? `- Si days_per_week >= 4, dedica 1 día a cada disciplina secundaria; si no, intégralas en progression_notes como recomendación.` : ''}
${userData.modality === 'ball_sports' && userData.sport_type ? `- Orienta la preparación física al deporte: ${userData.sport_type}.` : ''}` : ''}
Genera exactamente ${userData.days_per_week} días de entrenamiento y ${7 - userData.days_per_week} días de descanso distribuidos en la semana. Incluye calentamiento como primer ejercicio y vuelta a la calma como último en cada día de entrenamiento. El plan debe tener 7 entradas en "schedule" (un objeto por día de la semana). Máximo 8 ejercicios por día (incluyendo calentamiento y vuelta a la calma). "technique_notes" debe ser UNA frase corta (máximo 15 palabras). Sé específico pero conciso: la progresión semanal va en "progression_notes", no repetida en cada ejercicio.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Verificar suscripción y límites del mes actual
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [subResult, plansCountResult, activeJobResult] = await Promise.all([
      supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('workout_plans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('async_jobs')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('type', 'generate_workout_plan')
        .in('status', ['pending', 'processing'])
        .limit(1)
        .maybeSingle(),
    ]);

    const isPremium = subResult.data?.status === 'active' && subResult.data?.plan !== 'free';
    const plansThisMonth = plansCountResult.count ?? 0;

    // Bloquear si hay un job en proceso
    if (activeJobResult.data) {
      return new Response(
        JSON.stringify({ error: 'generation_in_progress', job_id: activeJobResult.data.id }),
        { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    if (!isPremium && plansThisMonth >= 1) {
      return new Response(
        JSON.stringify({ error: 'monthly_plan_limit_reached', plans_count: plansThisMonth }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Recoger datos del usuario para el prompt
    const body = await req.json();
    const {
      days_per_week = 3,
      minutes_per_session = 60,
      equipment = 'gym con máquinas y pesas libres',
      injuries = '',
      modality = null,
      secondary_modalities = [],
    } = body;

    // Ids fuera del catálogo se descartan — la modalidad nunca tumba la generación
    const safeModality = typeof modality === 'string' && VALID_MODALITIES.has(modality) ? modality : null;
    const safeSecondary = Array.isArray(secondary_modalities)
      ? secondary_modalities.filter((s: unknown): s is string => typeof s === 'string' && VALID_MODALITIES.has(s)).slice(0, 2)
      : [];

    const [goalResult, bodyResult] = await Promise.all([
      supabase
        .from('goals')
        .select('type, fitness_level, mode, sport_type')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('body_data')
        .select('weight_kg, height_cm, age, gender, activity_level')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const goal = goalResult.data;
    const body_data = bodyResult.data;

    if (!goal) {
      return new Response(
        JSON.stringify({ error: 'no_active_goal', message: 'El usuario no tiene un objetivo activo' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Crear registro de async_job
    const { data: job, error: jobError } = await supabase
      .from('async_jobs')
      .insert({
        user_id: user.id,
        type: 'generate_workout_plan',
        status: 'processing',
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('Error creando async_job:', jobError);
      return new Response(
        JSON.stringify({ error: 'internal_error' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const prompt = buildPlanPrompt({
      goal_type: goal.type,
      fitness_level: goal.fitness_level,
      sport_type: goal.sport_type,
      mode: goal.mode,
      weight_kg: body_data?.weight_kg ? Number(body_data.weight_kg) : null,
      height_cm: body_data?.height_cm ? Number(body_data.height_cm) : null,
      age: body_data?.age ?? null,
      gender: body_data?.gender ?? null,
      activity_level: body_data?.activity_level ?? null,
      days_per_week,
      minutes_per_session,
      equipment,
      injuries,
      modality: safeModality,
      secondary_modalities: safeSecondary,
    });

    // Llamar a Sonnet para generar el plan
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        // El JSON del plan rebasaba 4096 (y a veces 8192) tokens y llegaba truncado
        // ("Invalid JSON from AI"). 16000 es el techo sano sin streaming; el prompt
        // además acota el tamaño de salida (máx 8 ejercicios/día, notas de 1 frase).
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic error:', errText);
      await supabase
        .from('async_jobs')
        .update({ status: 'failed', error: `Anthropic error: ${anthropicRes.status}`, completed_at: new Date().toISOString() })
        .eq('id', job.id);

      return new Response(
        JSON.stringify({ error: 'ai_error', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const aiResult = await anthropicRes.json();

    // Truncamiento: el modelo se quedó sin max_tokens a media respuesta — el JSON
    // nunca va a parsear. Registrarlo como causa distinta a un JSON malformado.
    if (aiResult.stop_reason === 'max_tokens') {
      console.error('AI response truncated at max_tokens');
      await supabase
        .from('async_jobs')
        .update({ status: 'failed', error: 'AI response truncated (max_tokens)', completed_at: new Date().toISOString() })
        .eq('id', job.id);

      return new Response(
        JSON.stringify({ error: 'invalid_ai_response', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const rawContent = aiResult.content?.[0]?.text ?? '';

    let planData: Record<string, unknown>;
    try {
      // Extraer JSON aunque Sonnet agregue texto extra
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      planData = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Error parsing plan JSON:', e, rawContent.slice(0, 500));
      await supabase
        .from('async_jobs')
        .update({ status: 'failed', error: 'Invalid JSON from AI', completed_at: new Date().toISOString() })
        .eq('id', job.id);

      return new Response(
        JSON.stringify({ error: 'invalid_ai_response', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Desactivar planes anteriores del mes y guardar el nuevo
    await supabase
      .from('workout_plans')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    const { data: savedPlan, error: planError } = await supabase
      .from('workout_plans')
      .insert({
        user_id: user.id,
        title: String(planData.title ?? 'Mi Plan de Entrenamiento'),
        description: String(planData.description ?? ''),
        schedule: planData.schedule ?? [],
        generated_by: 'claude-sonnet-4-6',
        is_active: true,
      })
      .select('id')
      .single();

    if (planError || !savedPlan) {
      console.error('Error guardando plan:', planError);
      await supabase
        .from('async_jobs')
        .update({ status: 'failed', error: 'DB insert failed', completed_at: new Date().toISOString() })
        .eq('id', job.id);

      return new Response(
        JSON.stringify({ error: 'db_error', job_id: job.id }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Marcar job como completado
    await supabase
      .from('async_jobs')
      .update({
        status: 'completed',
        result: { plan_id: savedPlan.id },
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return new Response(
      JSON.stringify({
        job_id: job.id,
        status: 'completed',
        plan_id: savedPlan.id,
        plan: planData,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('generate-plan error:', err);
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
