import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ExerciseCatalogEntry {
  slug: string;
  name_es: string;
  primary_muscle: string;
  equipment: string;
  movement_pattern: string;
  difficulty: string;
  instructions_es: string[];
  video_url: string;
  poster_url: string;
}

export function useExerciseCatalogEntry(slug: string | null) {
  return useQuery<ExerciseCatalogEntry | undefined>({
    queryKey: ['exercise_catalog', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exercise_catalog')
        .select('*')
        .eq('slug', slug!)
        .maybeSingle();
      if (error) throw error;
      return data ?? undefined;
    },
  });
}
