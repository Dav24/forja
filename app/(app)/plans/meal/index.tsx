import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/constants/colors';
import { useActiveMealPlan, useGenerateMealPlan } from '@/hooks/useMealPlan';
import { useIsPremium } from '@/hooks/useSubscription';
import { FREE_LIMITS } from '@/lib/limits';
import { MacroBar } from '@/components/plans/MacroBar';
import { MealPlanCard, type Meal } from '@/components/plans/MealPlanCard';
import { PaywallBanner } from '@/components/premium/PaywallBanner';

const ALLERGY_OPTIONS = ['Ninguna', 'Gluten', 'Lactosa', 'Frutos secos', 'Mariscos'];
const DIET_OPTIONS = ['Omnívoro', 'Vegetariano', 'Vegano', 'Sin gluten', 'Keto'];
const AVAILABILITY_OPTIONS = ['Básica', 'Media', 'Amplia'];

type MealDay = { day_number: number; day_name: string; total_calories: number; meals: Meal[] };
type MealPlanData = {
  title: string;
  description: string;
  daily_calories: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  days: MealDay[];
};

function ChipGroup({
  options, selected, onSelect, multi = false,
}: {
  options: string[]; selected: string[]; onSelect: (val: string) => void; multi?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              borderWidth: 1,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primaryDim : colors.surface,
            }}
          >
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: isSelected ? colors.primary : colors.textMuted }}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MealPlansScreen() {
  const { data: activePlan, isLoading } = useActiveMealPlan();
  const { mutateAsync: generatePlan, isPending: generating } = useGenerateMealPlan();
  const isPremium = useIsPremium();

  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(['Ninguna']);
  const [selectedDiet, setSelectedDiet] = useState<string[]>(['Omnívoro']);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>(['Media']);
  const [selectedDay, setSelectedDay] = useState(0);

  function toggleAllergy(val: string) {
    if (val === 'Ninguna') { setSelectedAllergies(['Ninguna']); return; }
    setSelectedAllergies(prev => {
      const without = prev.filter(v => v !== 'Ninguna');
      const next = without.includes(val) ? without.filter(v => v !== val) : [...without, val];
      return next.length === 0 ? ['Ninguna'] : next;
    });
  }

  async function handleGenerate() {
    const allergies = selectedAllergies.filter(v => v !== 'Ninguna').join(', ') || 'ninguna';
    const diet_type = (selectedDiet[0] ?? 'Omnívoro').toLowerCase();
    const food_availability = (selectedAvailability[0] ?? 'Media').toLowerCase();
    try {
      await generatePlan({ allergies, diet_type, food_availability });
      setSelectedDay(0);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e?.error === 'meal_plan_limit_reached') {
        Alert.alert(
          'Límite alcanzado',
          isPremium
            ? 'Has alcanzado el límite de 10 planes este mes.'
            : 'Ya usaste tu plan gratuito. Actualiza a Premium para regenerar cuando quieras.',
        );
      } else if (e?.error === 'generation_in_progress') {
        Alert.alert('En proceso', 'Ya hay un plan siendo generado. Espera un momento.');
      } else if (e?.error === 'no_active_goal') {
        Alert.alert('Sin objetivo', 'Completa tu perfil con un objetivo activo primero.');
      } else {
        Alert.alert('Error', 'No se pudo generar el plan. Intenta de nuevo.');
      }
    }
  }

  const planData = activePlan?.meals as MealPlanData | null;
  const days = planData?.days ?? [];
  const currentDay = days[selectedDay];

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center',
        gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18 }}>
            Plan Alimenticio
          </Text>
          {activePlan && planData && (
            <Text style={{ color: colors.accent, fontFamily: 'Inter-Medium', fontSize: 12, marginTop: 1 }}>
              {activePlan.daily_calories} kcal · {planData.macros.protein_g}g proteína
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {activePlan && planData ? (
          <>
            {/* Macros diarios */}
            <View style={{
              backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: colors.border,
            }}>
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 11, marginBottom: 4 }}>
                PROMEDIOS DIARIOS
              </Text>
              <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, marginBottom: 12 }}>
                {planData.title}
              </Text>
              <MacroBar
                protein_g={planData.macros.protein_g}
                carbs_g={planData.macros.carbs_g}
                fat_g={planData.macros.fat_g}
              />
            </View>

            {/* Navegador de días */}
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}
            >
              {days.map((day, i) => (
                <TouchableOpacity
                  key={i} onPress={() => setSelectedDay(i)} activeOpacity={0.7}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                    borderColor: selectedDay === i ? colors.primary : colors.border,
                    backgroundColor: selectedDay === i ? colors.primaryDim : colors.surface,
                  }}
                >
                  <Text style={{
                    fontFamily: 'Inter-Medium', fontSize: 13,
                    color: selectedDay === i ? colors.primary : colors.textMuted,
                  }}>
                    {day.day_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Comidas del día */}
            {currentDay && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 16 }}>
                    {currentDay.day_name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontFamily: 'JetBrainsMono-Medium', fontSize: 13 }}>
                    {currentDay.total_calories} kcal
                  </Text>
                </View>
                {currentDay.meals.map((meal, i) => (
                  <MealPlanCard key={i} meal={meal} />
                ))}
              </>
            )}

            {/* Regenerar */}
            {isPremium ? (
              <TouchableOpacity
                onPress={handleGenerate} disabled={generating} activeOpacity={0.7}
                style={{
                  marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
                  paddingVertical: 14, alignItems: 'center', flexDirection: 'row',
                  justifyContent: 'center', gap: 8, opacity: generating ? 0.6 : 1,
                }}
              >
                {generating
                  ? <ActivityIndicator color={colors.primary} size="small" />
                  : <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />}
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 14 }}>
                  {generating ? 'Generando plan...' : 'Regenerar plan'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: 16 }}>
                <PaywallBanner
                  message="Actualiza para crear nuevos planes cuando quieras"
                  onPress={() => router.push('/(app)/upgrade' as never)}
                />
              </View>
            )}
          </>
        ) : (
          <>
            {/* Estado sin plan */}
            <View style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 8 }}>
              <View style={{
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: colors.accent + '20',
                alignItems: 'center', justifyContent: 'center', marginBottom: 16,
              }}>
                <Ionicons name="nutrition-outline" size={28} color={colors.accent} />
              </View>
              <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, textAlign: 'center', marginBottom: 8 }}>
                Tu plan alimenticio
              </Text>
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
                Generado con IA según tu objetivo, cuerpo y preferencias.
              </Text>
            </View>

            {/* Form */}
            <View style={{ gap: 20, marginBottom: 24 }}>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  Alergias o intolerancias
                </Text>
                <ChipGroup options={ALLERGY_OPTIONS} selected={selectedAllergies} onSelect={toggleAllergy} multi />
              </View>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  Tipo de dieta
                </Text>
                <ChipGroup options={DIET_OPTIONS} selected={selectedDiet} onSelect={(v) => setSelectedDiet([v])} />
              </View>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  Disponibilidad de alimentos
                </Text>
                <ChipGroup options={AVAILABILITY_OPTIONS} selected={selectedAvailability} onSelect={(v) => setSelectedAvailability([v])} />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleGenerate} disabled={generating} activeOpacity={0.8}
              style={{
                backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
                gap: 8, opacity: generating ? 0.7 : 1,
              }}
            >
              {generating
                ? <ActivityIndicator color={colors.background} size="small" />
                : <Ionicons name="sparkles-outline" size={20} color={colors.background} />}
              <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 16 }}>
                {generating ? 'Generando tu plan...' : 'Generar mi plan'}
              </Text>
            </TouchableOpacity>

            {!isPremium && (
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
                Plan gratuito: {FREE_LIMITS.MEAL_PLANS_LIFETIME} generación de por vida · Premium: ilimitadas
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
