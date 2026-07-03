import { Text, View } from 'react-native';
import { colors } from '@/constants/colors';

// Placeholder del avatar de Vulcano — se reemplaza por ilustración (spec §7)
export function VulcanoAvatar({ size }: { size: number }) {
  return (
    <View
      className="items-center justify-center bg-surface-elevated"
      style={{ width: size, height: size, borderRadius: size * 0.33, borderWidth: 1.5, borderColor: colors.primary }}
    >
      <Text style={{ fontSize: size * 0.5 }}>🔥</Text>
    </View>
  );
}
