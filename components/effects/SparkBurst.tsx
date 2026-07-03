import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';

const SPARK_COUNT = 14;
const COLORS = ['#FDE68A', '#FBBF24', '#F97316', '#EA580C'];
const DURATION = 900;

interface SparkBurstProps {
  trigger: boolean;
  onDone?: () => void;
}

function Spark({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const angle = (index / SPARK_COUNT) * Math.PI * 2 + (index % 3) * 0.2;
  const distance = 70 + (index % 4) * 22;
  const size = 4 + (index % 3) * 2;
  const color = COLORS[index % COLORS.length];

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(angle) * distance * progress.value },
      { translateY: Math.sin(angle) * distance * progress.value + 30 * progress.value * progress.value },
      { scale: 1 - progress.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

export function SparkBurst({ trigger, onDone }: SparkBurstProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!trigger) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [trigger]);

  if (!trigger) return null;

  return (
    <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
      {Array.from({ length: SPARK_COUNT }, (_, i) => (
        <Spark key={i} index={i} progress={progress} />
      ))}
    </View>
  );
}
