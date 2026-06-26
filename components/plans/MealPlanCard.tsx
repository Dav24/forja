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
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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
          <Text style={{ color: colors.textMuted, fontFamily: 'JetBrainsMono-Medium', fontSize: 12, marginTop: 2 }}>
            {meal.calories} kcal
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
          style={{ marginLeft: 8, marginTop: 2 }}
        />
      </View>

      <View style={{ marginTop: 10 }}>
        <MacroBar
          protein_g={meal.protein_g}
          carbs_g={meal.carbs_g}
          fat_g={meal.fat_g}
          compact={!expanded}
        />
      </View>

      {expanded && (
        <View style={{ marginTop: 12, gap: 4 }}>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 11, marginBottom: 4 }}>
            INGREDIENTES
          </Text>
          {meal.ingredients.map((ing, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
              <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13 }}>{ing}</Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
