import { Alert } from 'react-native';
import i18next from 'i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useIsPremium } from '@/hooks/useSubscription';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function useActiveMealPlan() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['meal_plan', 'active', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_plans')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    },
  });
}

export function useGenerateMealPlan() {
  const { session } = useAuthStore();
  const queryClient = useQueryClient();
  const isPremium = useIsPremium();

  return useMutation({
    mutationFn: async (params: {
      diet_type: string;
      food_availability: string;
    }) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-meal-plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw { status: res.status, ...data };
      return data as { job_id: string; status: string; plan_id: string; plan: unknown };
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['meal_plan'] });

      // Aviso único a usuarios free — no se repite, controlado por profiles.seen_health_profile_hint_meal.
      if (!isPremium) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('seen_health_profile_hint_meal')
          .eq('id', session!.user.id)
          .maybeSingle();
        if (profileRow && !profileRow.seen_health_profile_hint_meal) {
          Alert.alert('', i18next.t('plans:mealPlan.healthProfileHint'));
          await supabase
            .from('profiles')
            .update({ seen_health_profile_hint_meal: true })
            .eq('id', session!.user.id);
        }
      }
    },
  });
}
