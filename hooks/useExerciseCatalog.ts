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
      if (!data) return undefined;
      // video_url/poster_url en DB son rutas relativas al bucket (no URLs
      // absolutas) — se resuelven aquí con el host real de este cliente,
      // que ya es correcto (LAN IP en dev con teléfono físico, o el host de
      // producción), a diferencia del host que tenía el script de import.
      return {
        ...data,
        video_url: supabase.storage.from('exercise-media').getPublicUrl(data.video_url).data.publicUrl,
        poster_url: supabase.storage.from('exercise-media').getPublicUrl(data.poster_url).data.publicUrl,
      };
    },
  });
}
