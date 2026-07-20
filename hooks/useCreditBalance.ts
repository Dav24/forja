import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function useCreditBalance() {
  const { user } = useAuthStore();

  return useQuery({
    queryKey: ['credit_balance', user?.id],
    enabled: !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_credit_balance', { p_user_id: user!.id });
      if (error) throw error;
      return data ?? 0;
    },
  });
}
