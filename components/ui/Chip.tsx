import type { ComponentProps } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  iconName?: IoniconsName;
  /** 'primary' (ember, entrenamiento) por defecto; 'accent' (ámbar) para contextos de nutrición. */
  tint?: 'primary' | 'accent';
}

export function Chip({ label, selected, onPress, iconName, tint = 'primary' }: ChipProps) {
  const { colors } = useTheme();
  const activeColor = tint === 'accent' ? colors.accent : colors.primary;
  const activeBg = tint === 'accent' ? colors.accent + '20' : colors.primaryDim;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-1.5 rounded-full px-4 py-2 border"
      style={{
        borderColor: selected ? activeColor : colors.border,
        backgroundColor: selected ? activeBg : colors.surface,
      }}
    >
      {iconName ? (
        <Ionicons name={iconName} size={14} color={selected ? activeColor : colors.textMuted} />
      ) : null}
      <Text className="text-sm" style={{ color: selected ? activeColor : colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
}
