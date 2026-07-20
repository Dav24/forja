import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { buildCreditPackURL } from '@/lib/payments';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import type { ModalityId } from '@/constants/modalities';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export function useActiveWorkoutPlan() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['workout_plan', 'active', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
    },
  });
}

export function useWorkoutPlans() {
  const { user } = useAuthStore();
  return useQuery({
    queryKey: ['workout_plans', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface GeneratePlanParams {
  modality: ModalityId;
  days_per_week: number;
  minutes_per_session: number;
  equipment: string;
}

export function useGeneratePlan(refetch: () => Promise<unknown>) {
  const { session } = useAuthStore();
  const [generating, setGenerating] = useState(false);

  async function generate(params: GeneratePlanParams) {
    if (!session) return;
    setGenerating(true);
    try {
      // Persistir la modalidad en el goal activo si aún no tiene (usuarios
      // pre-multi-modalidad) y recoger las secundarias para la EF.
      const { data: goal } = await supabase
        .from('goals')
        .select('id, modality, secondary_modalities')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (goal && !goal.modality) {
        await supabase.from('goals').update({ modality: params.modality }).eq('id', goal.id);
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          secondary_modalities: goal?.secondary_modalities ?? [],
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'monthly_plan_limit_reached') {
          Alert.alert('Límite alcanzado', 'En el plan free puedes generar 1 plan por mes. Actualiza a premium para generar más.');
        } else if (data.error === 'no_credits_remaining') {
          Alert.alert(
            'Sin créditos',
            'Ya usaste tu plan gratuito de este mes. Compra créditos extra para generar otro.',
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Comprar créditos', onPress: () => Linking.openURL(buildCreditPackURL(session.user.id)) },
            ],
          );
        } else if (data.error === 'generation_in_progress') {
          Alert.alert('En proceso', 'Ya hay un plan siendo generado. Espera un momento.');
        } else {
          Alert.alert('Error', 'No se pudo generar el plan. Intenta de nuevo.');
        }
        return;
      }

      await refetch();
      if (data.plan_id) {
        router.push(`/(app)/plans/workout/${data.plan_id}`);
      }
    } catch {
      Alert.alert('Error', 'Ocurrió un error de conexión. Intenta de nuevo.');
    } finally {
      setGenerating(false);
    }
  }

  return { generating, generate };
}

export function useDeactivateWorkoutPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('workout_plans')
        .update({ is_active: false })
        .eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout_plan'] });
    },
  });
}
