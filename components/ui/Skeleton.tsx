import { useEffect } from 'react';
import { ViewProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';

interface SkeletonProps extends ViewProps {
  className?: string;
}

export function Skeleton({ className = '', style, ...props }: SkeletonProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  // Capturados fuera del worklet: valores de tema como strings simples, no funciones JS
  const shimmerFrom = colors.surface;
  const shimmerTo = colors.surfaceElevated;

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], [shimmerFrom, shimmerTo]),
  }));

  return (
    <Animated.View
      style={[animatedStyle, style]}
      className={`rounded-xl ${className}`}
      {...props}
    />
  );
}
