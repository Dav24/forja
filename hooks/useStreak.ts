import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export function useStreak() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['streak', user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // Traer los últimos 60 días de actividad (mensajes o registros corporales)
      const since = new Date();
      since.setDate(since.getDate() - 60);

      const [{ data: convDays }, { data: bodyDays }] = await Promise.all([
        supabase
          .from('conversations')
          .select('created_at')
          .eq('user_id', user!.id)
          .eq('role', 'user')
          .gte('created_at', since.toISOString()),
        supabase
          .from('body_data')
          .select('recorded_at')
          .eq('user_id', user!.id)
          .gte('recorded_at', since.toISOString()),
      ]);

      // Unir todas las fechas de actividad en un Set de strings 'YYYY-MM-DD'
      const activeDays = new Set<string>();
      convDays?.forEach((r) => activeDays.add(r.created_at.slice(0, 10)));
      bodyDays?.forEach((r) => activeDays.add(r.recorded_at.slice(0, 10)));

      // Contar días consecutivos hacia atrás desde hoy
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 60; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (activeDays.has(key)) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    },
  });
}
