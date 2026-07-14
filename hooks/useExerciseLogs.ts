import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export interface LogSetsInput {
  workoutPlanId: string;
  dayNumber: number;
  exerciseOrder: number;
  exerciseSlug: string | null;
  sets: { setNumber: number; kg?: number; reps?: number; bodyweightLastreKg?: number }[];
}

export function useLogExerciseSets() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: LogSetsInput) => {
      const rows = input.sets.map((s) => ({
        user_id: user!.id,
        workout_plan_id: input.workoutPlanId,
        day_number: input.dayNumber,
        exercise_order: input.exerciseOrder,
        exercise_slug: input.exerciseSlug,
        set_number: s.setNumber,
        kg: s.kg ?? null,
        reps: s.reps ?? null,
        bodyweight_lastre_kg: s.bodyweightLastreKg ?? null,
      }));
      const { error } = await supabase.from('exercise_logs').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      if (variables.exerciseSlug) {
        queryClient.invalidateQueries({ queryKey: ['exercise_progression', variables.exerciseSlug] });
      }
    },
  });
}

export function useExerciseProgression(slug: string | null) {
  return useQuery({
    queryKey: ['exercise_progression', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('recorded_at, kg, reps, bodyweight_lastre_kg')
        .eq('exercise_slug', slug!)
        .order('recorded_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).reverse();
    },
  });
}
