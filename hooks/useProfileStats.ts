import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

async function countRows(table: 'workout_plans' | 'meal_plans' | 'body_data', userId: string) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw error;
  return count ?? 0;
}

export function useProfileStats() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['profile-stats', user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [workouts, meals, bodyRecords] = await Promise.all([
        countRows('workout_plans', user!.id),
        countRows('meal_plans', user!.id),
        countRows('body_data', user!.id),
      ]);
      return { plansGenerated: workouts + meals, bodyRecords };
    },
  });
}
