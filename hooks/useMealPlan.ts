import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meal_plan'] });
    },
  });
}
