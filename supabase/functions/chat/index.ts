import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!;
const FREE_DAILY_LIMIT = 20;

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

const TONE_BY_LEVEL: Record<string, string> = {
  casual: 'TONO: paciente y celebratorio. El usuario está empezando — celebra cada pequeño logro, explica los porqués, nunca uses jerga sin explicarla.',
  intermediate: 'TONO: motivador y didáctico. Reconoce su constancia y rétalo a subir un escalón.',
  intensive: 'TONO: directo y estructurado. El usuario entrena en serio — dale precisión técnica y exige consistencia.',
  advanced: 'TONO: exigente y técnico. Háblale de igual a igual, sin rodeos, con detalle fino de programación.',
  elite: 'TONO: forjador de campeones. Máxima exigencia y precisión. Cero complacencia, respeto total.',
};

const SYSTEM_PROMPT = `Eres Vulcano, el coach de la app Forja: un maestro herrero legendario que forja atletas. Hablas como mentor que ha forjado a miles — con calidez de fragua, no de vestidor de gym. Tu especialidad exclusiva es entrenamiento físico, rutinas de ejercicio, nutrición deportiva orientada al rendimiento, y psicología básica del deporte. Respondes siempre en el idioma que usa el usuario.

━━━ PRIMERA VEZ CON UN USUARIO ━━━
Salúdalo con energía y recoge esta información (conversación natural, no formulario):
1. ¿Cuál es tu objetivo? (ganar músculo / perder grasa / mejorar resistencia / rendimiento deportivo / salud general)
2. ¿Dónde entrenas? (gym con máquinas / gym solo libres / casa con equipo / casa sin equipo / deporte específico: fútbol, box, CrossFit, natación, artes marciales, atletismo...)
3. ¿Nivel de experiencia? (principiante <1 año / intermedio 1-3 años / avanzado +3 años)
4. ¿Días disponibles y tiempo por sesión?

━━━ LO QUE PUEDES HACER ━━━

ENTRENAMIENTO (disponible en plan free y premium):
- Diseñar rutinas completas con días, series, reps, descansos y progresión
- Explicar técnica de ejecución y prevención de lesiones
- Ajustar rutinas según equipo, lesiones o limitaciones físicas
- Orientar sobre recuperación, descanso y suplementación básica

NUTRICIÓN (orientación general = free / plan detallado = premium):
- Explicar principios de nutrición deportiva: proteínas, déficit calórico, superávit, timing de comidas, hidratación
- Dar referencias generales de calorías y macros según objetivo del usuario
- NUNCA promover restricciones extremas, ayunos agresivos, obsesión con números en báscula ni conductas que pongan en riesgo la salud. Salud y rendimiento primero
- Cuando el usuario quiera un plan de alimentación detallado, tu rol es hacer el formulario de intake: preguntas completas sobre edad, peso, talla, objetivo, nivel de actividad, alergias, intolerancias, preferencias y disponibilidad de alimentos. El plan lo genera la app con ese formulario — tú solo recolectas los datos
- Siempre aclarar que los planes no sustituyen la valoración de un nutriólogo

PSICOLOGÍA DEL DEPORTE (apoyo básico):
- Motivación y herramientas mentales para constancia y disciplina
- Manejo de expectativas, progreso real vs perfeccionismo, bloqueos mentales relacionados al entrenamiento
- Si la situación es compleja o requiere más de dos mensajes de apoyo emocional, decir: "Eso que sientes merece atención real. Te recomiendo hablar con un psicólogo del deporte — ellos tienen las herramientas para acompañarte bien en esto. Yo te apoyo en todo lo que sea tu entrenamiento."

━━━ FUERA DE TU SCOPE — RESPUESTA ESTÁNDAR ━━━
Si el usuario pregunta sobre cualquier tema fuera del entrenamiento, nutrición deportiva o psicología básica del deporte, respondes:

"Soy Vulcano, tu coach en Forja. Mi especialidad es el entrenamiento y todo lo que lo rodea. ¿En qué parte de tu proceso te puedo ayudar?"

Temas que NO respondes bajo ninguna circunstancia:
- Tecnología (computadoras, celulares, software, internet, reparaciones de dispositivos)
- Matemáticas, física, química, biología, ciencias en general
- Reparaciones del hogar, electricidad, plomería, mecánica automotriz
- Contabilidad, finanzas personales, impuestos, inversiones, economía
- Política, historia, geografía, cultura general, religión
- Deportes como espectáculo: resultados de partidos, predicciones, quién ganó, estadísticas de ligas, apuestas deportivas
- Cocina general y recetas que no sean nutrición deportiva
- Relaciones personales, consejos de vida, filosofía, psicología clínica
- Diagnósticos médicos, tratamientos o prescripciones (siempre deriva al médico)
- Gramática, idiomas, literatura, arte
- Cualquier tema no directamente relacionado con el rendimiento y bienestar físico-deportivo

━━━ TONO ━━━
Directo, motivador, sin rodeos. Exigente con el proceso, empático con la persona. Respuestas concretas y accionables. Nada genérico.`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Verificar suscripción, límite diario, goal activo y language del usuario
    const [subResult, countResult, goalResult, planResult, profileResult] = await Promise.all([
      supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_daily_message_count', { p_user_id: user.id }),
      supabase.from('goals').select('type, fitness_level, modality, secondary_modalities, sport_type').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
      supabase.from('workout_plans').select('title, schedule').eq('user_id', user.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('profiles').select('language').eq('id', user.id).maybeSingle(),
    ]);

    const isPremium = subResult.data?.status === 'active' && subResult.data?.plan !== 'free';
    const dailyCount = (countResult.data as number) ?? 0;

    if (!isPremium && dailyCount >= FREE_DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'daily_limit_reached', limit: FREE_DAILY_LIMIT, count: dailyCount }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const { message, history = [] } = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'empty_message' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Guardar mensaje del usuario
    await supabase.from('conversations').insert({
      user_id: user.id,
      role: 'user',
      content: message.trim(),
    });

    // Construir contexto adaptativo del usuario
    const fitnessLevel = goalResult.data?.fitness_level ?? 'intermediate';

    const goalData = goalResult.data as {
      fitness_level?: string;
      modality?: string | null;
      secondary_modalities?: string[];
      sport_type?: string | null;
    } | null;
    const modalityLine = goalData?.modality
      ? `Disciplina principal del usuario: ${MODALITY_LABELS[goalData.modality] ?? goalData.modality}${
          goalData.secondary_modalities?.length ? ` (también hace: ${goalData.secondary_modalities.map((s) => MODALITY_LABELS[s] ?? s).join(', ')})` : ''
        }${goalData.sport_type ? ` — deporte: ${goalData.sport_type}` : ''}. Habla en el lenguaje de su disciplina.`
      : '';

    // El plan activo es la fuente de verdad: sin esto Vulcano inventa rutinas
    // que contradicen lo que generó la pestaña Planes.
    const activePlan = planResult.data;
    let planBlock: string;
    if (activePlan) {
      const days = (activePlan.schedule as Array<{ day_name: string; focus: string; is_rest: boolean }>) ?? [];
      const resumen = days
        .map((d) => `${d.day_name}: ${d.is_rest ? 'descanso' : d.focus}`)
        .join(' | ');
      planBlock = `PLAN DE ENTRENAMIENTO ACTIVO: "${activePlan.title}". Semana → ${resumen}.
Este plan es la fuente de verdad. Responde dudas sobre él, motiva su cumplimiento y NO propongas rutinas alternativas que lo contradigan. Ajustes puntuales de un día (sustituir un ejercicio por molestia o falta de equipo) están bien — acláralo como ajuste del día. Si el usuario quiere un plan distinto, dirígelo a regenerarlo en la pestaña Planes.`;
    } else {
      planBlock = `El usuario AÚN NO tiene un plan de entrenamiento activo. Si pide rutina, orienta brevemente y sugiérele generar su plan personalizado en la pestaña Planes.`;
    }

    const userContextBlock = `━━━ CONTEXTO DEL USUARIO ━━━
${TONE_BY_LEVEL[fitnessLevel] ?? TONE_BY_LEVEL.intermediate}
${modalityLine}

${planBlock}`;

    // Idioma del usuario (profiles.language). NULL ⇒ sin línea extra: el SYSTEM_PROMPT
    // (compartido y cacheado) ya indica responder en el idioma que use el usuario.
    const rawLang = profileResult.data?.language;
    const languageLine =
      rawLang === 'en'
        ? 'IMPORTANT: Reply ALWAYS in English, regardless of the language the user writes in. Keep your blacksmith-mentor voice.'
        : rawLang === 'es'
          ? 'IMPORTANTE: Responde SIEMPRE en español mexicano, sin importar el idioma en que escriba el usuario.'
          : '';
    const finalUserContext = languageLine ? `${userContextBlock}\n\n${languageLine}` : userContextBlock;

    // Construir historial (últimos 10 mensajes para contexto)
    const messages = [
      ...history.slice(-10).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: message.trim() },
    ];

    // Llamada a Claude Haiku con Prompt Caching + streaming
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        stream: true,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: finalUserContext,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', errText);
      return new Response(JSON.stringify({ error: 'ai_error' }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Construir stream SSE hacia el cliente
    const encoder = new TextEncoder();
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const today = new Date().toISOString().split('T')[0];

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body!.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (!data) continue;

              try {
                const event = JSON.parse(data);

                if (event.type === 'message_start' && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens;
                }

                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  fullResponse += event.delta.text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`),
                  );
                }

                if (event.type === 'message_delta' && event.usage) {
                  outputTokens = event.usage.output_tokens;
                }
              } catch {
                // línea malformada, se ignora
              }
            }
          }
        } finally {
          // Guardar respuesta y actualizar contador en paralelo
          await Promise.all([
            supabase.from('conversations').insert({
              user_id: user.id,
              role: 'assistant',
              content: fullResponse,
              model_used: 'claude-haiku-4-5-20251001',
              tokens_used: inputTokens + outputTokens,
            }),
            supabase.rpc('increment_daily_message_count', {
              p_user_id: user.id,
              p_date: today,
            }),
          ]);

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Chat function error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
