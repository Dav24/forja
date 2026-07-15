import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export interface MealCandidate {
  meal_type: string;
  time_suggestion: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

function useSwapFetch() {
  const { session } = useAuthStore();
  return async (body: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/swap-meal`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session!.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw { status: res.status, ...data };
    return data;
  };
}

export function useSwapMealPreview() {
  const swapFetch = useSwapFetch();
  return useMutation({
    mutationFn: async (params: { mealPlanId: string; dayNumber: number; mealIndex: number; attemptNumber: number }) => {
      const data = await swapFetch({
        action: 'preview',
        meal_plan_id: params.mealPlanId,
        day_number: params.dayNumber,
        meal_index: params.mealIndex,
        attempt_number: params.attemptNumber,
      });
      return data.candidate as MealCandidate;
    },
  });
}

export function useSwapMealAccept() {
  const swapFetch = useSwapFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { mealPlanId: string; dayNumber: number; mealIndex: number; candidate: MealCandidate }) => {
      await swapFetch({
        action: 'accept',
        meal_plan_id: params.mealPlanId,
        day_number: params.dayNumber,
        meal_index: params.mealIndex,
        candidate: params.candidate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal_plan'] });
      queryClient.invalidateQueries({ queryKey: ['meal_swaps_this_week'] });
    },
  });
}

export function useSwapsUsedThisWeek() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['meal_swaps_this_week', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('meal_swaps')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .gte('created_at', sevenDaysAgo);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
