import { View, Text } from 'react-native';
import { colors } from '@/constants/colors';

interface MacroBarProps {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  compact?: boolean;
}

function MacroLabel({ color, label, grams, pct }: { color: string; label: string; grams: number; pct: number }) {
  return (
    <View className="items-center gap-0.5">
      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 10 }}>{label}</Text>
      <Text style={{ color: colors.text, fontFamily: 'JetBrainsMono-Medium', fontSize: 12 }}>{grams}g</Text>
      <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 10 }}>{pct}%</Text>
    </View>
  );
}

export function MacroBar({ protein_g, carbs_g, fat_g, compact = false }: MacroBarProps) {
  const total = protein_g + carbs_g + fat_g;
  if (total === 0) return null;

  const proteinPct = Math.round((protein_g / total) * 100);
  const carbsPct = Math.round((carbs_g / total) * 100);
  const fatPct = 100 - proteinPct - carbsPct;

  return (
    <View>
      <View className="flex-row rounded overflow-hidden" style={{ height: compact ? 6 : 10 }}>
        <View style={{ flex: proteinPct, backgroundColor: colors.primary }} />
        <View style={{ flex: carbsPct, backgroundColor: colors.primaryBright }} />
        <View style={{ flex: fatPct, backgroundColor: colors.textMuted }} />
      </View>
      {!compact && (
        <View className="flex-row justify-between mt-2">
          <MacroLabel color={colors.primary} label="Proteína" grams={protein_g} pct={proteinPct} />
          <MacroLabel color={colors.primaryBright} label="Carbs" grams={carbs_g} pct={carbsPct} />
          <MacroLabel color={colors.textMuted} label="Grasa" grams={fat_g} pct={fatPct} />
        </View>
      )}
    </View>
  );
}
