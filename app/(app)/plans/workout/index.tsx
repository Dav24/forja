import { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useActiveWorkoutPlan, useGeneratePlan } from '@/hooks/useWorkoutPlan';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { PlanGenerating } from '@/components/plans/PlanGenerating';
import { GeneratePlanSheet } from '@/components/plans/GeneratePlanSheet';

export default function WorkoutPlansIndex() {
  const { data: activePlan, refetch } = useActiveWorkoutPlan();
  const { generating, generate } = useGeneratePlan(refetch);
  const sheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (activePlan) {
      router.replace(`/(app)/plans/workout/${(activePlan as { id: string }).id}`);
    }
  }, [activePlan]);

  // Si hay plan activo, no renderizar nada mientras ocurre la navegación
  if (activePlan) return null;

  // GeneratePlanSheet permanece montado durante `generating` para que su animación
  // de cierre no se corte a mitad de camino al desmontar todo el árbol.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {generating ? (
        <PlanGenerating />
      ) : (
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
            onPress={() => sheetRef.current?.expand()}
            className="w-full"
            style={{ width: '100%' }}
          />
        </View>
      )}

      <GeneratePlanSheet
        ref={sheetRef}
        onGenerate={(params) => {
          sheetRef.current?.close();
          generate(params);
        }}
      />
    </SafeAreaView>
  );
}
