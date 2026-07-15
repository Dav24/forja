import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  InvalidCandidateError,
  MealNotFoundError,
  PlanNotFoundError,
  SwapLimitReachedError,
  swapMealAccept,
  swapMealPreview,
  TooManyAttemptsError,
  type Json,
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
    const action = body?.action;
    const mealPlanId = body?.meal_plan_id;
    const dayNumber = body?.day_number;
    const mealIndex = body?.meal_index;

    if (
      (action !== 'preview' && action !== 'accept') ||
      typeof mealPlanId !== 'string' || mealPlanId.length === 0 ||
      typeof dayNumber !== 'number' ||
      typeof mealIndex !== 'number'
    ) {
      return json(400, { error: 'invalid_request' });
    }

    const { data: profileData } = await supabase.from('profiles').select('language').eq('id', user.id).maybeSingle();
    const language: 'es' | 'en' = profileData?.language === 'en' ? 'en' : 'es';

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const loadMealPlan = async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('meals')
        .eq('id', mealPlanId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data ? { meals: data.meals as Json } : null;
    };

    if (action === 'preview') {
      const attemptNumber = typeof body?.attempt_number === 'number' ? body.attempt_number : 1;
      const candidate = await swapMealPreview(
        {
          loadMealPlan,
          loadFoodPreferences: async () => {
            const { data } = await supabase.from('food_preferences').select('item, kind').eq('user_id', user.id);
            const rows = data ?? [];
            return {
              allergies: rows.filter((r) => r.kind === 'allergy').map((r) => r.item),
              dislikes: rows.filter((r) => r.kind === 'dislike').map((r) => r.item),
            };
          },
          callAI: async (prompt) => {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
              }),
            });
            if (!res.ok) {
              console.error('Anthropic error:', await res.text());
              throw new Error('ai_error');
            }
            const result = await res.json();
            if (result.stop_reason === 'max_tokens') throw new Error('ai_error');
            return result.content?.[0]?.text ?? '';
          },
        },
        { dayNumber, mealIndex, attemptNumber, language },
      );
      return json(200, { candidate });
    }

    // action === 'accept'
    await swapMealAccept(
      {
        loadMealPlan,
        countRecentSwaps: async () => {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { count } = await supabase
            .from('meal_swaps')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('created_at', sevenDaysAgo);
          return count ?? 0;
        },
        isPremium: async () => {
          const { data } = await supabase.from('subscriptions').select('status, plan').eq('user_id', user.id).maybeSingle();
          return data?.status === 'active' && data?.plan !== 'free';
        },
        saveSwap: async ({ updatedMeals, oldMealName, newMealName, dayNumber: dn, mealIndex: mi }) => {
          const { error: updateError } = await admin
            .from('meal_plans')
            .update({ meals: updatedMeals, translations: {} })
            .eq('id', mealPlanId);
          if (updateError) throw updateError;
          const { error: insertError } = await admin.from('meal_swaps').insert({
            user_id: user.id,
            meal_plan_id: mealPlanId,
            day_number: dn,
            meal_index: mi,
            old_meal_name: oldMealName,
            new_meal_name: newMealName,
          });
          if (insertError) throw insertError;
        },
      },
      { dayNumber, mealIndex, candidate: body?.candidate },
    );
    return json(200, { success: true });
  } catch (err) {
    if (err instanceof PlanNotFoundError || err instanceof MealNotFoundError) return json(404, { error: 'not_found' });
    if (err instanceof InvalidCandidateError) return json(400, { error: 'invalid_candidate' });
    if (err instanceof TooManyAttemptsError) return json(429, { error: 'too_many_attempts' });
    if (err instanceof SwapLimitReachedError) return json(429, { error: 'meal_swap_limit_reached' });
    if (err instanceof Error && err.message === 'ai_error') return json(502, { error: 'ai_error' });
    console.error('swap-meal error:', err);
    return json(500, { error: 'internal_error' });
  }
});
