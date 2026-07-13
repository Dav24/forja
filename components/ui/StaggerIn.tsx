import { ReactNode, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming, useReducedMotion } from 'react-native-reanimated';

interface Props { index?: number; children: ReactNode }

// Entrada escalonada al enfocar el tab, SIN remount (el estado de los hijos sobrevive).
export function StaggerIn({ index = 0, children }: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useFocusEffect(useCallback(() => {
    progress.value = 0;
    progress.value = withDelay(index * 50, withTiming(1, { duration: 450 }));
  }, [index, progress]));
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));
  if (reduced) return <>{children}</>;
  return <Animated.View style={style}>{children}</Animated.View>;
}
