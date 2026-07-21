import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import type { MedicalConditionCode } from '@/constants/health';

export interface MedicalCondition {
  id: string;
  condition: MedicalConditionCode;
  notes: string | null;
}

export function useMedicalConditions() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['medical_conditions', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medical_conditions')
        .select('id, condition, notes')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MedicalCondition[];
    },
  });
}

export function useAddMedicalCondition() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ condition, notes }: { condition: MedicalConditionCode; notes: string }) => {
      const sanitizedNotes = notes.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      const { error } = await supabase
        .from('medical_conditions')
        .insert({ user_id: user!.id, condition, notes: sanitizedNotes || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical_conditions'] });
    },
  });
}

export function useRemoveMedicalCondition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('medical_conditions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical_conditions'] });
    },
  });
}
