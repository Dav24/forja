import { useEffect } from 'react';
import { ViewProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps extends ViewProps {
  className?: string;
}

export function Skeleton({ className = '', style, ...props }: SkeletonProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#1C1917', '#292524']),
  }));

  return (
    <Animated.View
      style={[animatedStyle, style]}
      className={`rounded-xl ${className}`}
      {...props}
    />
  );
}
