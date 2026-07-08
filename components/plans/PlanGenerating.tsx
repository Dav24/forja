import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors } from '@/constants/colors';

// Simula progreso indeterminado en ~30 s para reflejar el tiempo real de generación
function useSimulatedProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Avanza rápido al principio y se desacelera al acercarse al 90 %
    const intervals = [
      { target: 30, delay: 300 },
      { target: 55, delay: 600 },
      { target: 75, delay: 900 },
      { target: 88, delay: 1200 },
      { target: 93, delay: 2000 },
    ];

    const timers: ReturnType<typeof setTimeout>[] = [];
    let accumulated = 0;

    for (const { target, delay } of intervals) {
      accumulated += delay;
      const t = setTimeout(() => setProgress(target), accumulated);
      timers.push(t);
    }

    return () => timers.forEach(clearTimeout);
  }, []);

  return progress;
}

export function PlanGenerating() {
  const { t } = useTranslation('plans');
  const progress = useSimulatedProgress();

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        paddingHorizontal: 32,
        gap: 20,
      }}
    >
      <VulcanoAvatar size={72} />

      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text
          style={{
            color: colors.text,
            fontFamily: 'SpaceGrotesk-SemiBold',
            fontSize: 18,
            textAlign: 'center',
          }}
        >
          {t('generating.title')}
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
          {t('generating.subtitle')}
        </Text>
      </View>

      <ProgressBar value={progress} className="w-full" />
    </View>
  );
}
