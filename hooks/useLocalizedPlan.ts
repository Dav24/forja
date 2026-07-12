import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import type { AppLanguage } from '@/lib/i18n';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export type LocalizedPlanType = 'workout' | 'meal';

export interface LocalizablePlan {
  id: string;
  title: string;
  description?: string | null;
  schedule?: unknown;
  meals?: unknown;
  source_language?: string;
  // `unknown` para aceptar el Json de los tipos generados de Supabase;
  // en runtime siempre es el objeto { "<lang>": contenido } de la migración 0010.
  translations?: unknown;
}

function extractOriginal(plan: LocalizablePlan, planType: LocalizedPlanType): Record<string, unknown> {
  return planType === 'workout'
    ? { title: plan.title, description: plan.description ?? '', schedule: plan.schedule ?? [] }
    : { title: plan.title, meals: plan.meals ?? {} };
}

// Resuelve el contenido del plan en el idioma activo de la app.
// - idioma === source_language → contenido original, instantáneo
// - translations[idioma] cacheado → caché, instantáneo
// - sin caché y trigger=true → dispara la EF translate-plan UNA vez
//   (isTranslating mientras tanto; en error, fallback al original + error)
// - trigger=false (hub): nunca llama a la EF, muestra caché u original
export function useLocalizedPlan<T = Record<string, unknown>>(
  plan: LocalizablePlan | null | undefined,
  planType: LocalizedPlanType,
  options: { trigger?: boolean } = {},
): { content: T | null; isTranslating: boolean; error: Error | null } {
  const trigger = options.trigger ?? true;
  const { i18n } = useTranslation();
  const { session } = useAuthStore();
  const queryClient = useQueryClient();
  const attempted = useRef<string | null>(null);

  const lang: AppLanguage = i18n.language === 'en' ? 'en' : 'es';
  const source: AppLanguage = plan?.source_language === 'en' ? 'en' : 'es';
  const cached = (plan?.translations as Record<string, unknown> | null | undefined)?.[lang];
  const needsTranslation = !!plan && lang !== source && !cached;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/translate-plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan_type: planType, plan_id: plan!.id, target_language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'translate_failed');
      return data.content as T;
    },
    onSuccess: () => {
      // Releer el plan con translations[lang] ya persistido.
      queryClient.invalidateQueries({ queryKey: planType === 'workout' ? ['workout_plan'] : ['meal_plan'] });
      if (planType === 'workout') queryClient.invalidateQueries({ queryKey: ['workout_plans'] });
    },
  });
  const { mutate } = mutation;

  useEffect(() => {
    if (!trigger || !needsTranslation || !session || !plan) return;
    const key = `${plan.id}:${lang}`;
    // Un intento por (plan, idioma) por montaje: en error se muestra el
    // original con banner; reabrir la pantalla reintenta.
    if (attempted.current === key) return;
    attempted.current = key;
    mutate();
  }, [trigger, needsTranslation, session, plan, lang, mutate]);

  if (!plan) return { content: null, isTranslating: false, error: null };
  if (lang === source) return { content: extractOriginal(plan, planType) as T, isTranslating: false, error: null };
  if (cached) return { content: cached as T, isTranslating: false, error: null };
  if (mutation.data) return { content: mutation.data, isTranslating: false, error: null };
  if (mutation.isError && trigger) {
    return { content: extractOriginal(plan, planType) as T, isTranslating: false, error: mutation.error as Error };
  }
  if (!trigger) return { content: extractOriginal(plan, planType) as T, isTranslating: false, error: null };
  return { content: null, isTranslating: true, error: null };
}
