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
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
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
        reps: lastLog?.reps ?? (Number(exercise.reps) || 10),
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
