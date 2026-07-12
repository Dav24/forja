import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  mergeTranslations,
  PlanNotFoundError,
  ShapeMismatchError,
  translatePlan,
  type Json,
  type Language,
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
    const planType = body?.plan_type;
    const planId = body?.plan_id;
    const target = body?.target_language;
    if (
      (planType !== 'workout' && planType !== 'meal') ||
      typeof planId !== 'string' || planId.length === 0 ||
      (target !== 'es' && target !== 'en')
    ) {
      return json(400, { error: 'invalid_request' });
    }

    const table = planType === 'workout' ? 'workout_plans' : 'meal_plans';
    // El UPDATE de translations va con service role (RLS solo da SELECT/UPDATE
    // de sus filas al usuario; el caché lo administra el servidor).
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    const content = await translatePlan(
      {
        loadPlan: async () => {
          // Cliente con el JWT del usuario: RLS + eq(user_id) garantizan propiedad.
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', planId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (error) throw error;
          return data as Json | null;
        },
        callTranslator: async (prompt) => {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              // El JSON de un plan grande ronda los mismos tokens que en
              // generate-plan; mismo techo para no truncar la traducción.
              max_tokens: 16000,
              messages: [{ role: 'user', content: prompt }],
            }),
          });
          if (!res.ok) {
            console.error('Anthropic error:', await res.text());
            throw new Error('ai_error');
          }
          const result = await res.json();
          if (result.stop_reason === 'max_tokens') {
            console.error('translate-plan: respuesta truncada (max_tokens)');
            throw new Error('ai_error');
          }
          return result.content?.[0]?.text ?? '';
        },
        saveTranslation: async (lang: Language, translated: Json) => {
          // Releer y mergear para no pisar idiomas cacheados por otra petición.
          const { data: row, error: readError } = await admin
            .from(table)
            .select('translations')
            .eq('id', planId)
            .single();
          if (readError) throw readError;
          const { error } = await admin
            .from(table)
            .update({ translations: mergeTranslations((row?.translations ?? {}) as Json, lang, translated) })
            .eq('id', planId);
          if (error) throw error;
        },
      },
      { planType, targetLanguage: target },
    );

    return json(200, { content });
  } catch (err) {
    if (err instanceof PlanNotFoundError) return json(404, { error: 'not_found' });
    if (err instanceof ShapeMismatchError) {
      console.error('translate-plan shape error:', err.message);
      return json(502, { error: 'invalid_ai_response' });
    }
    if (err instanceof Error && err.message === 'ai_error') return json(502, { error: 'ai_error' });
    console.error('translate-plan error:', err);
    return json(500, { error: 'internal_error' });
  }
});
