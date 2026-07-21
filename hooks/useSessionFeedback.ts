import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function useCanFinalizeSession(planId: string, dayNumber: number, requiredExerciseOrders: number[]) {
  const { user } = useAuthStore();
  const today = new Date().toISOString().slice(0, 10);

  const { data: loggedOrders = [] } = useQuery({
    queryKey: ['exercise_logs_today', planId, dayNumber, today],
    enabled: !!user && requiredExerciseOrders.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('exercise_order')
        .eq('workout_plan_id', planId)
        .eq('day_number', dayNumber)
        .eq('log_date', today);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.exercise_order))];
    },
  });

  const missing = requiredExerciseOrders.filter((o) => !loggedOrders.includes(o));
  return { canFinalize: missing.length === 0, loggedCount: loggedOrders.length, totalCount: requiredExerciseOrders.length };
}

export interface SubmitSessionFeedbackInput {
  workoutPlanId: string;
  dayNumber: number;
  logDate: string;
  difficultyRating: 'muy_facil' | 'facil' | 'justo' | 'dificil' | 'muy_dificil';
  problemTags: string[];
  comment: string | null;
  exerciseFlags: { exerciseOrder: number; flag: 'facil' | 'dificil' }[];
}

export function useSubmitSessionFeedback() {
  const { session } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SubmitSessionFeedbackInput) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-session-feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workout_plan_id: input.workoutPlanId,
          day_number: input.dayNumber,
          log_date: input.logDate,
          difficulty_rating: input.difficultyRating,
          problem_tags: input.problemTags,
          comment: input.comment,
          exercise_flags: input.exerciseFlags.map((f) => ({ exercise_order: f.exerciseOrder, flag: f.flag })),
        }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 200) throw new Error(data.error ?? 'submit_failed');
      return data as SubmitSessionFeedbackResponse;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workout_plan', variables.workoutPlanId] });
    },
  });
}

export interface SubmitSessionFeedbackResponse {
  suggestion: Suggestion | null;
  requires_approval?: boolean;
  applied?: boolean;
  requires_credit?: boolean;
}

export interface Suggestion {
  exerciseOrder: number | null;
  source: 'deterministic' | 'ai';
  reasonTag: string;
  before: unknown;
  after: unknown;
}

export function useApplySuggestion() {
  const { session } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { workoutPlanId: string; dayNumber: number; suggestion: Suggestion }) => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-session-feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'apply_suggestion',
          workout_plan_id: input.workoutPlanId,
          day_number: input.dayNumber,
          suggestion: input.suggestion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'apply_failed');
      return data as { applied: true };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workout_plan', variables.workoutPlanId] });
    },
  });
}
