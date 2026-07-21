import { createClient } from 'jsr:@supabase/supabase-js@2';
import { decideCreditGate } from './credits.ts';

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
  first_steps: 'primeros pasos / sin experiencia previa',
};
const VALID_MODALITIES = new Set(Object.keys(MODALITY_LABELS));

const MODALITY_GOAL_BRANCH_LABELS: Record<string, string> = {
  gym_strength_hypertrophy: 'hipertrofia / estética',
  gym_strength_max_strength: 'fuerza máxima (PRs)',
  gym_strength_competition_prep: 'prep. competencia (powerlifting/bodybuilding)',
  gym_strength_maintenance: 'mantenimiento',
  functional_hyrox_prep: 'prep. Hyrox / competencia funcional',
  functional_wod_times: 'mejorar tiempos de WOD',
  functional_general_conditioning: 'acondicionamiento general',
  functional_variety_only: 'solo variedad',
  endurance_first_5k: 'primeros 5K',
  endurance_short_distance_time: 'bajar tiempo en 5K/10K',
  endurance_half_full_marathon: 'medio maratón / maratón',
  endurance_general_cardio: 'cardio general',
  cycling_start_long_distance: 'empezar distancias largas',
  cycling_speed_power: 'mejorar velocidad / potencia',
  cycling_competition_gran_fondo: 'prep. competencia / gran fondo',
  cycling_general_cardio: 'cardio general',
  swimming_nonstop: 'nadar sin parar',
  swimming_technique: 'corregir técnica',
  swimming_distance_time: 'bajar tiempo en distancia',
  swimming_competition_triathlon: 'prep. competencia / triatlón',
  home_calisthenics_basics: 'lo básico (dominadas/lagartijas)',
  home_calisthenics_advanced_skills: 'habilidades avanzadas (muscle-up/planche/front lever)',
  home_calisthenics_weight_loss_no_equipment: 'perder peso sin equipo',
  home_calisthenics_stay_active: 'mantenerse activo',
  mobility_general_flexibility: 'flexibilidad general',
  mobility_injury_rehab: 'rehabilitación de lesión',
  mobility_pain_tension: 'reducir dolor/tensión específica',
  mobility_complement: 'complemento de otro entreno',
  ball_sports_performance: 'mejorar rendimiento en su deporte',
  ball_sports_season_prep: 'prep. física para temporada/torneo',
  ball_sports_fun_fitness: 'diversión / mantenerse en forma',
  ball_sports_injury_recovery: 'recuperación de lesión',
  first_steps_never_trained: 'nunca ha entrenado / va con calma',
  first_steps_event_date: 'tiene una fecha/evento en mente',
  first_steps_energy_health: 'quiere más energía y salud',
  first_steps_just_move: 'aún no sabe, solo quiere moverse',
};

const FIRST_STEPS_EMPATHY_GUARDRAIL = 'El usuario está en modalidad "Primeros pasos" — es su punto de partida en fitness o puede tener expectativas poco realistas. Corrige expectativas poco realistas CON EMPATÍA, prioriza adherencia y formación de hábito sobre intensidad, y encuadra esto como el inicio de un cambio de estilo de vida, no una rutina relámpago.';

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
  language: 'es' | 'en';
  catalogBlock: string;
  athleticBackground: string | null;
  supplements: string[];
  supplementsOther: string | null;
  targetWeightKg: number | null;
  targetDate: string | null;
  modalityOrientation: string | null;
  modalityGoalNotes: string | null;
  secondaryGoalNotes: string | null;
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

  const backgroundMap: Record<string, string> = {
    amateur: 'competidor amateur',
    high_performance: 'competidor de alto rendimiento',
    bodybuilding: 'fisicoculturismo competitivo',
  };
  const backgroundLine = userData.athleticBackground && userData.athleticBackground !== 'none'
    ? `- Trayectoria competitiva declarada: ${backgroundMap[userData.athleticBackground] ?? userData.athleticBackground} — ajusta el volumen/periodización si es relevante (p.ej. fisicoculturismo puede justificar mayor volumen de aislamiento).\n`
    : '';
  const supplementsList = userData.supplements.filter((s) => s !== 'none');
  const supplementsLine = supplementsList.length > 0 || userData.supplementsOther
    ? `- Suplementación declarada (SOLO contexto): ${[...supplementsList, userData.supplementsOther].filter(Boolean).join(', ')}\nREGLA DE SEGURIDAD: el dato de suplementación es únicamente contexto (p.ej. no dupliques una recomendación de proteína si el usuario ya toma un shake). Bajo NINGUNA circunstancia recomiendes, apruebes, sugieras dosis, o valides el uso de sustancias o suplementos.\n`
    : '';
  const weightGoalLine = userData.targetWeightKg != null && userData.targetDate
    ? `- Meta de peso: ${userData.goal_type === 'weight_loss' ? 'bajar' : 'subir'} a ${userData.targetWeightKg}kg para ${userData.targetDate}\n`
    : '';
  const orientationLine = userData.modalityOrientation
    ? `- Objetivo específico en su disciplina principal (${MODALITY_GOAL_BRANCH_LABELS[userData.modalityOrientation] ?? userData.modalityOrientation}): ${userData.modalityGoalNotes ?? 'sin notas adicionales'}\n`
    : '';
  const secondaryNotesLine = userData.secondaryGoalNotes
    ? `- Disciplinas secundarias — notas del usuario: ${userData.secondaryGoalNotes}\n`
    : '';
  const firstStepsLine = userData.modality === 'first_steps' ? `${FIRST_STEPS_EMPATHY_GUARDRAIL}\n` : '';

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
${userData.injuries ? `- Lesiones o limitaciones (RESPETAR, no evaluar ni diagnosticar): ${userData.injuries}` : ''}
${backgroundLine}${supplementsLine}${weightGoalLine}${orientationLine}${secondaryNotesLine}${firstStepsLine}
${userData.language === 'en'
  ? 'LANGUAGE: Write ALL content values (title, description, focus, day_name, technique_notes, weekly_schedule_summary, progression_notes, exercise names) in ENGLISH. day_name must be the English weekday name (Monday...Sunday). Keep every JSON key exactly as specified.'
  : 'IDIOMA: Escribe TODOS los valores de contenido en español. day_name en español (Lunes...Domingo). Mantén las claves JSON exactamente como se especifican.'}

CATÁLOGO DE EJERCICIOS CON ANIMACIÓN REAL (usa el slug exacto cuando haya coincidencia):
${userData.catalogBlock}

Para CADA ejercicio del plan: revisa primero si existe una coincidencia real en el catálogo de arriba (mismo movimiento y, si aplica, mismo equipo — no sustituyas por una variante con equipo distinto o técnica distinta). Si existe, usa exactamente ese "slug" en el campo "exercise_slug" y usa su nombre. Si NO hay una coincidencia real y precisa (sea porque es cardio, running, ciclismo, natación o deporte de balón sin equivalente, sea porque es un ejercicio de fuerza cuyo equipo o variante exacta no está en el catálogo), escríbelo libremente y deja "exercise_slug" en null. Es preferible dejar null que asignar un slug de una variante distinta — nunca fuerces una coincidencia falsa ni aproximada.

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
          "exercise_slug": "barbell-bench-press-slug-o-null",
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

  let creditUsed = false;
  let jobId: string | null = null;
  let userId: string | null = null;
  // consume_credit/grant_credit revocan EXECUTE a `authenticated` (Task 1) —
  // solo el service role puede llamarlas. Se crea una vez aquí, fuera del
  // try, así también queda disponible en el catch externo (Step 6) sin
  // necesidad de un cliente de cleanup aparte.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

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
    userId = user.id;

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

    const quotaExceeded = !isPremium && plansThisMonth >= 1;
    let creditBalance = 0;
    if (quotaExceeded) {
      const { data: balanceData } = await supabase.rpc('get_credit_balance', { p_user_id: user.id });
      creditBalance = balanceData ?? 0;
    }
    const creditGate = decideCreditGate({ isPremium, quotaExceeded, creditBalance });
    if (creditGate === 'blocked') {
      return new Response(
        JSON.stringify({ error: 'no_credits_remaining', plans_count: plansThisMonth, credit_balance: creditBalance }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Recoger datos del usuario para el prompt
    const body = await req.json();
    const {
      days_per_week = 3,
      minutes_per_session = 60,
      equipment = 'gym con máquinas y pesas libres',
      modality = null,
      secondary_modalities = [],
    } = body;

    // Ids fuera del catálogo se descartan — la modalidad nunca tumba la generación
    const safeModality = typeof modality === 'string' && VALID_MODALITIES.has(modality) ? modality : null;
    const safeSecondary = Array.isArray(secondary_modalities)
      ? secondary_modalities.filter((s: unknown): s is string => typeof s === 'string' && VALID_MODALITIES.has(s)).slice(0, 2)
      : [];

    const [goalResult, bodyResult, profileResult] = await Promise.all([
      supabase
        .from('goals')
        .select('type, fitness_level, mode, sport_type, athletic_background, target_weight_kg, target_date, modality_orientation, modality_goal_notes, secondary_goal_notes')
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
      supabase.from('profiles').select('language, supplements, supplements_other').eq('id', user.id).maybeSingle(),
    ]);

    const goal = goalResult.data;
    const body_data = bodyResult.data;
    const language: 'es' | 'en' = profileResult.data?.language === 'en' ? 'en' : 'es';

    if (!goal) {
      return new Response(
        JSON.stringify({ error: 'no_active_goal', message: 'El usuario no tiene un objetivo activo' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const { data: injuryRows } = await supabase
      .from('injuries')
      .select('body_area, severity, notes')
      .eq('user_id', user.id);

    const injuries = injuryRows ?? [];

    // Mapa de exclusión determinista: solo zonas donde el vocabulario coarse
    // de exercise_catalog permite una exclusión razonable. 'cuello' y 'otro'
    // no tienen mapeo limpio — caen a solo-prompt igual que severidad leve.
    const SEVERE_EXCLUSION_MAP: Record<string, { muscles?: string[]; patterns?: string[] }> = {
      rodilla: { patterns: ['Squat', 'Lunge', 'Plyometric'] },
      hombro: { muscles: ['Shoulders'] },
      espalda_baja: { patterns: ['Hinge'] },
      cadera: { patterns: ['Hinge', 'Squat', 'Lunge', 'Hip Abduction'] },
      tobillo: { patterns: ['Plyometric', 'Lunge'] },
      muñeca: { muscles: ['Forearms'] },
    };

    const severeInjuries = injuries.filter((i) => i.severity === 'severa_estructural' && SEVERE_EXCLUSION_MAP[i.body_area]);
    const mildInjuries = injuries.filter((i) => i.severity === 'leve_moderada' || !SEVERE_EXCLUSION_MAP[i.body_area]);

    const excludedMuscles = new Set(severeInjuries.flatMap((i) => SEVERE_EXCLUSION_MAP[i.body_area].muscles ?? []));
    const excludedPatterns = new Set(severeInjuries.flatMap((i) => SEVERE_EXCLUSION_MAP[i.body_area].patterns ?? []));

    const { data: allCatalogRows } = await supabase
      .from('exercise_catalog')
      .select('slug, name_es, name_en, equipment, primary_muscle, movement_pattern');

    // Filtro determinista: excluye del catálogo (antes de armar el prompt) lo
    // que Claude ni siquiera puede elegir. Ver docs/superpowers/specs/2026-07-20-perfil-de-salud-design.md.
    const catalogRows = (excludedMuscles.size > 0 || excludedPatterns.size > 0)
      ? (allCatalogRows ?? []).filter((r) => !excludedMuscles.has(r.primary_muscle) && !excludedPatterns.has(r.movement_pattern))
      : (allCatalogRows ?? []);

    const catalogBlock = catalogRows
      .map((r) => `${r.slug}|${language === 'en' ? r.name_en : r.name_es}|${r.equipment}`)
      .join('\n');

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

    jobId = job.id;

    if (creditGate === 'needs_credit') {
      const { data: remaining, error: consumeErr } = await serviceClient.rpc('consume_credit', {
        p_user_id: user.id,
        p_action: 'generate_workout_plan',
        p_related_job_id: job.id,
      });
      if (consumeErr || remaining == null || remaining < 0) {
        await supabase
          .from('async_jobs')
          .update({ status: 'failed', error: 'no_credits_remaining', completed_at: new Date().toISOString() })
          .eq('id', job.id);
        return new Response(
          JSON.stringify({ error: 'no_credits_remaining', job_id: job.id }),
          { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        );
      }
      creditUsed = true;
    }

    const injuriesText = [
      ...severeInjuries.map((i) => `${i.body_area} (lesión severa/estructural — YA EXCLUIDO del catálogo de ejercicios de la zona afectada): ${i.notes ?? 'sin notas adicionales'}`),
      ...mildInjuries.map((i) => `${i.body_area} (lesión leve/moderada — prioriza bajo impacto, evita movimientos pesados en esta zona): ${i.notes ?? 'sin notas adicionales'}`),
    ].join('; ');

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
      injuries: injuriesText,
      modality: safeModality,
      secondary_modalities: safeSecondary,
      language,
      catalogBlock,
      athleticBackground: goal.athletic_background ?? null,
      supplements: (profileResult.data?.supplements as string[] | null) ?? [],
      supplementsOther: profileResult.data?.supplements_other ?? null,
      targetWeightKg: goal.target_weight_kg != null ? Number(goal.target_weight_kg) : null,
      targetDate: goal.target_date ?? null,
      modalityOrientation: goal.modality_orientation ?? null,
      modalityGoalNotes: goal.modality_goal_notes ?? null,
      secondaryGoalNotes: goal.secondary_goal_notes ?? null,
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
      if (creditUsed) {
        await serviceClient.rpc('grant_credit', { p_user_id: user.id, p_amount: 1, p_type: 'refund', p_related_job_id: job.id });
      }

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
      if (creditUsed) {
        await serviceClient.rpc('grant_credit', { p_user_id: user.id, p_amount: 1, p_type: 'refund', p_related_job_id: job.id });
      }

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
      if (creditUsed) {
        await serviceClient.rpc('grant_credit', { p_user_id: user.id, p_amount: 1, p_type: 'refund', p_related_job_id: job.id });
      }

      return new Response(
        JSON.stringify({ error: 'invalid_ai_response', job_id: job.id }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    // Descartar exercise_slug alucinados: el modelo puede devolver un slug que no
    // existe en exercise_catalog (typo, variante inventada). Un slug inválido
    // rompería silenciosamente la ficha de ejercicio en el cliente, así que se
    // limpia a null antes de persistir en vez de confiar ciegamente en la IA.
    const validSlugs = new Set((catalogRows ?? []).map((r) => r.slug));
    if (Array.isArray(planData.schedule)) {
      for (const day of planData.schedule as any[]) {
        if (Array.isArray(day?.exercises)) {
          for (const ex of day.exercises) {
            if (ex?.exercise_slug && !validSlugs.has(ex.exercise_slug)) {
              ex.exercise_slug = null;
            }
          }
        }
      }
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
        source_language: language,
        days_per_week,
        minutes_per_session,
        equipment,
      })
      .select('id')
      .single();

    if (planError || !savedPlan) {
      console.error('Error guardando plan:', planError);
      await supabase
        .from('async_jobs')
        .update({ status: 'failed', error: 'DB insert failed', completed_at: new Date().toISOString() })
        .eq('id', job.id);
      if (creditUsed) {
        await serviceClient.rpc('grant_credit', { p_user_id: user.id, p_amount: 1, p_type: 'refund', p_related_job_id: job.id });
      }

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
    if (jobId) {
      await serviceClient
        .from('async_jobs')
        .update({ status: 'failed', error: 'unexpected_error', completed_at: new Date().toISOString() })
        .eq('id', jobId)
        .then(() => {}, () => {}); // no propagar error del cleanup
      if (creditUsed && userId) {
        await serviceClient
          .rpc('grant_credit', { p_user_id: userId, p_amount: 1, p_type: 'refund', p_related_job_id: jobId })
          .then(() => {}, () => {}); // no propagar error del cleanup, mismo patrón que generate-meal-plan
      }
    }
    return new Response(
      JSON.stringify({ error: 'internal_error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
