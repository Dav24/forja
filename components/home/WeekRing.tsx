import { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, useReducedMotion } from 'react-native-reanimated';
import { useTheme } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props { progress: number; size?: number; children?: ReactNode }

// Anillo de progreso semanal del hero (prototipo v7, .ringwrap): track sutil +
// arco con gradiente ámbar→ember que se dibuja al montar.
export function WeekRing({ progress, size = 196, children }: Props) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const strokeWidth = 11;
  const r = (size - strokeWidth * 2) / 2 + strokeWidth / 2 - 1;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const offset = useSharedValue(circumference);

  useEffect(() => {
    const target = circumference * (1 - clamped);
    if (reduced) { offset.value = target; return; }
    offset.value = circumference;
    offset.value = withDelay(250, withTiming(target, { duration: 1300 }));
  }, [clamped, circumference, reduced, offset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id="emberRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.accent} />
            <Stop offset="1" stopColor={colors.primary} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.ringTrack} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#emberRing)" strokeWidth={strokeWidth} strokeLinecap="round" fill="none"
          strokeDasharray={`${circumference}`} animatedProps={animatedProps}
        />
      </Svg>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}
