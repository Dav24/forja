import { useState } from 'react';
import { Alert, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { useActiveWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { PlanGenerating } from '@/components/plans/PlanGenerating';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;

export default function WorkoutPlansIndex() {
  const { session } = useAuthStore();
  const { data: activePlan, refetch } = useActiveWorkoutPlan();
  const [generating, setGenerating] = useState(false);

  async function handleForjarPlan() {
    if (!session) return;

    Alert.alert(
      'Forjar Plan',
      '¿Cuántos días por semana quieres entrenar?',
      [3, 4, 5, 6].map((days) => ({
        text: `${days} días`,
        onPress: () => generate(days),
      })),
    );
  }

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

  // Si hay plan activo, redirigir directamente a él
  if (activePlan) {
    router.replace(`/(app)/plans/workout/${(activePlan as { id: string }).id}`);
    return null;
  }

  // Mientras se genera, mostrar Vulcano trabajando
  if (generating) {
    return <PlanGenerating />;
  }

  // Empty state — sin plan activo
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 32,
          gap: 16,
        }}
      >
        <VulcanoAvatar size={72} />

        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text
            className="uppercase"
            style={{
              color: colors.text,
              fontFamily: 'BebasNeue-Regular',
              fontSize: 26,
              textAlign: 'center',
              letterSpacing: 1,
            }}
          >
            Aún no forjamos tu plan
          </Text>
          <Text
            style={{
              color: colors.textMuted,
              fontFamily: 'Inter-Regular',
              fontSize: 14,
              textAlign: 'center',
              lineHeight: 20,
            }}
          >
            Cuéntame tu objetivo y lo forjamos juntos.
          </Text>
        </View>

        <Button
          label="Forjar mi plan"
          variant="primary"
          size="lg"
          loading={generating}
          onPress={handleForjarPlan}
          className="w-full"
          style={{ width: '100%' }}
        />
      </View>
    </SafeAreaView>
  );
}
