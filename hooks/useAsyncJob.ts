import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function useAsyncJob(jobId: string | null) {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['async_job', jobId],
    enabled: !!jobId && !!user,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 3000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('async_jobs')
        .select('*')
        .eq('id', jobId!)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
