import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';

interface StreakFlameProps {
  streak: number;
  compact?: boolean;
}

// Tamaño de llama por racha (spec §5): 1-6 / 7-29 / 30+
function flameScale(streak: number): number {
  if (streak >= 30) return 1.25;
  if (streak >= 7) return 1.1;
  return 1;
}

function Flame({ size, dead }: { size: number; dead: boolean }) {
  return (
    <Svg width={size} height={size * 1.18} viewBox="0 0 34 40">
      <Defs>
        <SvgGradient id="flameGrad" x1="0" y1="1" x2="0" y2="0">
          <Stop offset="0" stopColor="#EA580C" />
          <Stop offset="0.6" stopColor="#F97316" />
          <Stop offset="1" stopColor="#FDE68A" />
        </SvgGradient>
      </Defs>
      <Path
        d="M17 2 Q24 12 27 20 Q30 28 25 33 Q21 38 17 38 Q13 38 9 33 Q4 28 7 20 Q10 12 17 2 Z"
        fill={dead ? '#57534E' : 'url(#flameGrad)'}
      />
      {!dead && (
        <Path d="M17 16 Q20 21 21 25 Q22 30 17 33 Q12 30 13 25 Q14 21 17 16 Z" fill="#FDE68A" />
      )}
    </Svg>
  );
}

export function StreakFlame({ streak, compact = false }: StreakFlameProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('home');
  const dead = streak === 0;
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (dead) {
      cancelAnimation(flicker);
      flicker.value = withTiming(1, { duration: 200 });
      return;
    }
    flicker.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 700 }),
        withTiming(0.97, { duration: 500 }),
        withTiming(1.03, { duration: 600 }),
      ),
      -1,
      true,
    );
  }, [dead]);

  // Calculado fuera del worklet: las funciones JS normales no existen en el hilo de UI
  const baseScale = flameScale(streak);
  const flickerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flicker.value * baseScale }],
  }));

  if (compact) {
    return (
      <View className="flex-row items-center gap-1.5 bg-surface border border-border rounded-full px-3 py-1.5">
        <Animated.View style={flickerStyle}>
          <Flame size={14} dead={dead} />
        </Animated.View>
        <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 14, color: dead ? colors.textMuted : colors.accent }}>
          {streak}
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface border border-border rounded-2xl px-4 py-3 items-center gap-0.5">
      <Animated.View style={flickerStyle}>
        <Flame size={28} dead={dead} />
      </Animated.View>
      <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 20, color: dead ? colors.textMuted : colors.accent }}>
        {streak}
      </Text>
      <Text className="text-text-muted text-xs">{dead ? t('streak.revive') : t('streak.days')}</Text>
    </View>
  );
}
