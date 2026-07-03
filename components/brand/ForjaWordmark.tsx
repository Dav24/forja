import { Text, View } from 'react-native';
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
  return (
    <View className="flex-row items-center">
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: s.font, letterSpacing: s.spacing, color: '#FAFAF9' }}>F</Text>
      <View style={{ marginHorizontal: s.font * 0.06 }}>
        <Ember size={s.ember} glow={size === 'lg'} />
      </View>
      <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: s.font, letterSpacing: s.spacing, color: '#FAFAF9' }}>RJA</Text>
    </View>
  );
}
