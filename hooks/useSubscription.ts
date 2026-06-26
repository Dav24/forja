import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function useSubscription() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['subscription', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useIsPremium() {
  const { data } = useSubscription();
  if (!data) return false;
  const notExpired = data.current_period_end
    ? new Date(data.current_period_end) > new Date()
    : true;
  return data.plan === 'premium' && data.status === 'active' && notExpired;
}
