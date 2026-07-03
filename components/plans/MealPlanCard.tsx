import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { MacroBar } from './MacroBar';

export interface Meal {
  meal_type: string;
  time_suggestion: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  ingredients: string[];
}

export function MealPlanCard({ meal }: { meal: Meal }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.8}
      className="rounded-xl border p-4 mb-2"
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 mb-0.5">
            <Text style={{ color: colors.accent, fontFamily: 'Inter-Medium', fontSize: 11 }}>
              {meal.meal_type.toUpperCase()}
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 10 }}>·</Text>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 11 }}>
              {meal.time_suggestion}
            </Text>
          </View>
          <Text
            style={{ color: colors.text, fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 15 }}
            numberOfLines={expanded ? undefined : 1}
          >
            {meal.name}
          </Text>
          <View className="bg-surface-elevated rounded px-1.5 py-0.5 self-start" style={{ marginTop: 4 }}>
            <Text style={{ color: colors.primaryBright, fontFamily: 'JetBrainsMono-Medium', fontSize: 11 }}>
              {meal.calories} kcal
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
          style={{ marginLeft: 8, marginTop: 2 }}
        />
      </View>

      <View className="mt-2.5">
        <MacroBar
          protein_g={meal.protein_g}
          carbs_g={meal.carbs_g}
          fat_g={meal.fat_g}
          compact={!expanded}
        />
      </View>

      {expanded && (
        <View className="mt-3 gap-1">
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 11, marginBottom: 4 }}>
            INGREDIENTES
          </Text>
          {meal.ingredients.map((ing, i) => (
            <View key={i} className="flex-row items-center gap-2">
              <View className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.primary }} />
              <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13 }}>{ing}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
