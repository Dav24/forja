import { forwardRef } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { buildPaymentURL } from '@/lib/payments';

export type UpgradeContext = 'chart_range' | 'body_composition' | 'meal_plan' | 'generic';

interface UpgradeSheetProps {
  context?: UpgradeContext;
}

const COPY: Record<UpgradeContext, { title: string; bullets: string[] }> = {
  chart_range: {
    title: 'Historial completo',
    bullets: [
      'Hasta 365 días de datos',
      'Rangos de 1 mes y 3 meses',
      'Tendencias de largo plazo',
    ],
  },
  body_composition: {
    title: 'Composición corporal',
    bullets: [
      '% de grasa corporal',
      'Masa muscular en kg',
      'Seguimiento completo de tu cuerpo',
    ],
  },
  meal_plan: {
    title: 'Planes ilimitados',
    bullets: [
      '10 planes al mes',
      'Actualiza según tu progreso',
      'Vulcano ajusta según tus datos reales',
    ],
  },
  generic: {
    title: 'Conviértete en Maestro',
    bullets: [
      'Chat ilimitado con Vulcano',
      'Planes de entrenamiento ilimitados',
      'Vulcano analiza tus datos de actividad',
    ],
  },
};

export const UpgradeSheet = forwardRef<BottomSheet, UpgradeSheetProps>(
  function UpgradeSheet({ context = 'generic' }, ref) {
    const { title, bullets } = COPY[context];
    const userId = useAuthStore((s) => s.user?.id);

    function handleUpgrade() {
      if (userId) Linking.openURL(buildPaymentURL(userId, 'yearly'));
    }

    function handleSeeAll() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ref as any)?.current?.close?.();
      router.push('/(app)/upgrade' as never);
    }

    return (
      <Sheet ref={ref} snapPoints={['60%']}>
        <View className="gap-4">
          <View className="flex-row items-center gap-[10px]">
            <Ionicons name="lock-closed" size={22} color={colors.accent} />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>
              {title}
            </Text>
          </View>

          <View className="gap-[10px]">
            {bullets.map((bullet, i) => (
              <View key={i} className="flex-row items-center gap-[10px]">
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text className="flex-1" style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text }}>
                  {bullet}
                </Text>
              </View>
            ))}
          </View>

          <Text className="text-center" style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
            Desde $1,299/año
          </Text>

          <Button label="Hazte Maestro →" onPress={handleUpgrade} />

          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7} className="items-center">
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.accent }}>
              Ver todos los beneficios ↗
            </Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  },
);
