import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import type { BodyArea, InjurySeverity } from '@/constants/health';

export interface Injury {
  id: string;
  body_area: BodyArea;
  severity: InjurySeverity;
  notes: string | null;
}

export function useInjuries() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['injuries', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('injuries')
        .select('id, body_area, severity, notes')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Injury[];
    },
  });
}

export function useAddInjury() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body_area, severity, notes }: { body_area: BodyArea; severity: InjurySeverity; notes: string }) => {
      const sanitizedNotes = notes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      const { error } = await supabase
        .from('injuries')
        .insert({ user_id: user!.id, body_area, severity, notes: sanitizedNotes || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injuries'] });
    },
  });
}

export function useRemoveInjury() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('injuries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['injuries'] });
    },
  });
}
