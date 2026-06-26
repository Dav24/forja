import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  color?: string;
}

export function ProgressBar({ value, className = '', color = '#22C55E' }: ProgressBarProps) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(Math.max(value, 0), 100), { duration: 400 });
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View className={`h-2 bg-surface-elevated rounded-full overflow-hidden ${className}`}>
      <Animated.View
        style={[{ height: '100%', borderRadius: 9999, backgroundColor: color }, animatedStyle]}
      />
    </View>
  );
}
