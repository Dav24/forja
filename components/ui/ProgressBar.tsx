import { useEffect } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';
import { gradientsByTheme } from '@/constants/themes';

interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const { resolved } = useTheme();
  const gradients = gradientsByTheme[resolved];
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(Math.max(value, 0), 100), { duration: 600 });
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View className={`h-2.5 bg-surface-elevated rounded-full overflow-hidden ${className}`}>
      <Animated.View
        style={[
          { height: '100%', borderRadius: 9999, shadowColor: '#FBBF24', shadowOpacity: 0.5, shadowRadius: 12, elevation: 4 },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={[gradients.ember[1], gradients.ember[0]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1, borderRadius: 9999 }}
        />
      </Animated.View>
    </View>
  );
}
