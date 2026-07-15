import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

export type FoodPreferenceKind = 'allergy' | 'dislike';

export function useFoodPreferences() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['food_preferences', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('food_preferences')
        .select('id, item, kind')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      return {
        allergies: rows.filter((r) => r.kind === 'allergy').map((r) => ({ id: r.id, item: r.item })),
        dislikes: rows.filter((r) => r.kind === 'dislike').map((r) => ({ id: r.id, item: r.item })),
      };
    },
  });
}

export function useAddFoodPreference() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, kind }: { item: string; kind: FoodPreferenceKind }) => {
      const { error } = await supabase
        .from('food_preferences')
        .insert({ user_id: user!.id, item: item.trim(), kind });
      // Conflicto de unique(user_id, kind, item) = ya existe, no es un error visible.
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food_preferences'] });
    },
  });
}

export function useRemoveFoodPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('food_preferences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['food_preferences'] });
    },
  });
}
