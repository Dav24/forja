import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/lib/theme';

interface HeroGlowProps {
  size?: number;
}

// Halo ambiental de marca para pantallas de llegada (auth) — mismo lenguaje
// de degradado radial que <Ember/>, a mayor escala y muy atenuado.
export function HeroGlow({ size = 260 }: HeroGlowProps) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -size * 0.32, alignSelf: 'center', width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="heroHalo" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.28" />
            <Stop offset="0.6" stopColor={colors.primary} stopOpacity="0.1" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="50" fill="url(#heroHalo)" />
      </Svg>
    </View>
  );
}
