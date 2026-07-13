import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

interface Props {
  size: number;
  state?: 'neutral' | 'forge' | 'celebrate';
}

// Avatar-personaje de Vulcano (dirección congelada del prototipo v7).
// Las 4 ilustraciones IA finales lo sustituirán 1:1 (mismos usos y tamaños).
export function VulcanoAvatar({ size, state = 'neutral' }: Props) {
  const { colors } = useTheme();
  const glow = state === 'celebrate' ? 1 : state === 'forge' ? 0.8 : 0.55;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <Circle cx={32} cy={32} r={30} fill={colors.chip} stroke={colors.borderStrong} />
        {/* yelmo */}
        <Path d="M18 26c0-9 6-14 14-14s14 5 14 14v3H18v-3Z" fill={colors.textFaint} opacity={0.9} />
        <Path d="M30 8l2-4 2 4c1.8.4 3 1 4 2l-6 1-6-1c1-1 2.2-1.6 4-2Z" fill={colors.primary} opacity={glow} />
        {/* rostro abstracto */}
        <Path d="M20 29h24v7c0 5-3 8-6 9H26c-3-1-6-4-6-9v-7Z" fill={colors.surfaceElevated} stroke={colors.borderStrong} />
        {/* ojos de brasa */}
        <Rect x={24.5} y={32} width={6} height={2.6} rx={1.3} fill={colors.primary} opacity={glow} />
        <Rect x={33.5} y={32} width={6} height={2.6} rx={1.3} fill={colors.primary} opacity={glow} />
        {/* barba en cuña */}
        <Path d="M22 40h20l-4 10c-2 3-4 4-6 4s-4-1-6-4l-4-10Z" fill={colors.textFaint} />
        <Path d="M29 44h6l-1.6 5c-.6 1.4-1.4 2-2.4 2s-1.8-.6-2.4-2L29 44Z" fill={colors.primary} opacity={glow * 0.7} />
        {state === 'celebrate' ? (
          <>
            <Path d="M14 34c-4-3-6-8-5-13" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
            <Path d="M50 34c4-3 6-8 5-13" stroke={colors.accent} strokeWidth={3} strokeLinecap="round" fill="none" />
          </>
        ) : null}
      </Svg>
    </View>
  );
}
