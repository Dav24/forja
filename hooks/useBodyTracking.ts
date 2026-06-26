import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useIsPremium } from './useSubscription';
import { FREE_LIMITS } from '@/lib/limits';

export function useLatestBodyData() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['body_data', 'latest', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('body_data')
        .select('*')
        .eq('user_id', user!.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    },
  });
}

export function useBodyHistory() {
  const { user } = useAuthStore();
  const isPremium = useIsPremium();
  return useQuery({
    queryKey: ['body_data', 'history', user?.id, isPremium],
    enabled: !!user,
    queryFn: async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - (isPremium ? 365 : FREE_LIMITS.BODY_HISTORY_DAYS));
      const { data, error } = await supabase
        .from('body_data')
        .select('*')
        .eq('user_id', user!.id)
        .gte('recorded_at', fromDate.toISOString())
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLogBodyData() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      weight_kg?: number;
      body_fat_pct?: number;
      muscle_mass_kg?: number;
    }) => {
      const { error } = await supabase.from('body_data').insert({ user_id: user!.id, ...entry });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['body_data'] });
    },
  });
}
