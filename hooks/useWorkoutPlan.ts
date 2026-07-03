import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';

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

export function useGeneratePlan(refetch: () => Promise<unknown>) {
  const { session } = useAuthStore();
  const [generating, setGenerating] = useState(false);

  async function generate(days: number) {
    if (!session) return;
    setGenerating(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-plan`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days_per_week: days }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'monthly_plan_limit_reached') {
          Alert.alert('Límite alcanzado', 'En el plan free puedes generar 1 plan por mes. Actualiza a premium para generar más.');
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

  function promptDaysAndGenerate(alertTitle: string) {
    if (!session) return;
    Alert.alert(
      alertTitle,
      '¿Cuántos días por semana quieres entrenar?',
      [3, 4, 5, 6].map((days) => ({
        text: `${days} días`,
        onPress: () => generate(days),
      })),
    );
  }

  return { generating, promptDaysAndGenerate };
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
