import { forwardRef } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';

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
      'Memo ajusta según tus datos reales',
    ],
  },
  generic: {
    title: 'Desbloquea Premium',
    bullets: [
      'Chat ilimitado con Memo',
      'Planes de entrenamiento ilimitados',
      'Memo analiza tus datos de actividad',
    ],
  },
};

export const UpgradeSheet = forwardRef<unknown, UpgradeSheetProps>(
  function UpgradeSheet({ context = 'generic' }, ref) {
    const { title, bullets } = COPY[context];

    function handleUpgrade() {
      Linking.openURL('https://pay.forja.fit?plan=premium&billing=yearly');
    }

    function handleSeeAll() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ref as any)?.current?.close?.();
      router.push('/(app)/upgrade' as never);
    }

    return (
      <Sheet ref={ref} snapPoints={['60%']}>
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="lock-closed" size={22} color={colors.accent} />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>
              {title}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {bullets.map((bullet, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text, flex: 1 }}>
                  {bullet}
                </Text>
              </View>
            ))}
          </View>

          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, textAlign: 'center' }}>
            Desde $1,299/año
          </Text>

          <Button label="Hazte Premium →" onPress={handleUpgrade} />

          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7} style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.accent }}>
              Ver todos los beneficios ↗
            </Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  },
);
