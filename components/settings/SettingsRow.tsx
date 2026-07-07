import { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface SettingsRowProps {
  icon: IoniconsName;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  rightElement?: ReactNode; // p.ej. un Switch — reemplaza al chevron
}

export function SettingsRow({ icon, label, value, onPress, danger, rightElement }: SettingsRowProps) {
  const tint = danger ? colors.destructive : colors.textMuted;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
      className="flex-row items-center gap-3 px-4 py-3.5 bg-surface"
    >
      <Ionicons name={icon} size={20} color={danger ? colors.destructive : colors.primary} />
      <Text
        className="flex-1"
        style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: danger ? colors.destructive : colors.text }}
      >
        {label}
      </Text>
      {value ? (
        <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}>{value}</Text>
      ) : null}
      {rightElement ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={tint} /> : null)}
    </TouchableOpacity>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      {title ? (
        <Text
          className="px-4 mb-2"
          style={{ fontFamily: 'Inter-Medium', fontSize: 12, letterSpacing: 1, color: colors.textMuted }}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}
      <View className="rounded-2xl overflow-hidden border border-border">{children}</View>
    </View>
  );
}
