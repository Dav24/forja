import { Text, View } from 'react-native';
import { useTheme } from '@/lib/theme';
import { Ember } from './Ember';

interface ForjaWordmarkProps {
  size?: 'sm' | 'lg';
}

const SIZES = {
  sm: { font: 15, ember: 14, spacing: 1 },
  lg: { font: 44, ember: 40, spacing: 2.5 },
} as const;

export function ForjaWordmark({ size = 'sm' }: ForjaWordmarkProps) {
  const s = SIZES[size];
  // El wordmark aparece sobre bg-background (login/register), que sí cambia de tema —
  // el texto debe seguir a colors.text para mantener contraste en claro y oscuro.
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center">
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: s.font, letterSpacing: s.spacing, color: colors.text }}>F</Text>
      <View style={{ marginHorizontal: s.font * 0.06 }}>
        <Ember size={s.ember} glow={size === 'lg'} />
      </View>
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: s.font, letterSpacing: s.spacing, color: colors.text }}>RJA</Text>
    </View>
  );
}
