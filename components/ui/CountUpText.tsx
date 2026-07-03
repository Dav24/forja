import { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import { Easing, runOnJS, useSharedValue, withTiming, useAnimatedReaction } from 'react-native-reanimated';

interface CountUpTextProps {
  value: number;
  decimals?: number;
  style?: TextStyle;
}

// Números que cuentan hacia arriba al aparecer (spec §6.2)
export function CountUpText({ value, decimals = 0, style }: CountUpTextProps) {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    progress.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [value]);

  useAnimatedReaction(
    () => progress.value * value,
    (current) => runOnJS(setDisplay)(current.toFixed(decimals)),
  );

  return <Text style={style}>{display}</Text>;
}
