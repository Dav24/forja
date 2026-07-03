import { Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { CountUpText } from './CountUpText';

interface StatCardProps {
  value: string | number;
  label: string;
  suffix?: string;
  decimals?: number;
}

export function StatCard({ value, label, suffix, decimals = 0 }: StatCardProps) {
  const numberStyle = { fontFamily: 'JetBrainsMono-Medium', fontSize: 22, color: colors.primaryBright } as const;
  return (
    <View className="flex-1 bg-surface border border-border rounded-2xl px-3 py-3 items-center">
      <View className="flex-row items-baseline">
        {typeof value === 'number'
          ? <CountUpText value={value} decimals={decimals} style={numberStyle} />
          : <Text style={numberStyle}>{value}</Text>
        }
        {suffix ? <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 13, color: colors.textMuted }}>{suffix}</Text> : null}
      </View>
      <Text
        className="mt-1"
        style={{ fontFamily: 'Inter-Medium', fontSize: 9, letterSpacing: 1.2, color: colors.textMuted }}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
