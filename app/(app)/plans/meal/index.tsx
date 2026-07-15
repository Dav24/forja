import { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useTheme } from '@/lib/theme';
import { useHideNavWhileFocused } from '@/lib/scrollNav';
import { useActiveMealPlan, useGenerateMealPlan } from '@/hooks/useMealPlan';
import { useIsPremium } from '@/hooks/useSubscription';
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';
import { FREE_LIMITS } from '@/lib/limits';
import { MacroBar } from '@/components/plans/MacroBar';
import { MealPlanCard, type Meal } from '@/components/plans/MealPlanCard';
import { MealSwapSheet } from '@/components/plans/MealSwapSheet';
import { useSwapsUsedThisWeek } from '@/hooks/useMealSwap';
import { PaywallBanner } from '@/components/premium/PaywallBanner';
import { Badge } from '@/components/ui/Badge';
import {
  AVAILABILITY_OPTIONS,
  DIET_OPTIONS,
  type MealOption,
} from '@/constants/mealOptions';

type MealDay = { day_number: number; day_name: string; total_calories: number; meals: Meal[] };
type MealPlanData = {
  title: string;
  description: string;
  daily_calories: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  days: MealDay[];
};
type LocalizedMealContent = { title: string; meals: MealPlanData };

function ChipGroup({
  options, selected, onSelect, multi = false,
}: {
  options: MealOption[]; selected: string[]; onSelect: (val: string) => void; multi?: boolean;
}) {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
              borderWidth: 1,
              borderColor: isSelected ? colors.primary : colors.border,
              backgroundColor: isSelected ? colors.primaryDim : colors.surface,
            }}
          >
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: isSelected ? colors.primary : colors.textMuted }}>
              {t(opt.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MealPlansScreen() {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const { data: activePlan, isLoading } = useActiveMealPlan();
  const { mutateAsync: generatePlan, isPending: generating } = useGenerateMealPlan();
  const isPremium = useIsPremium();
  const { content: localized, isTranslating, error: translateError } = useLocalizedPlan<LocalizedMealContent>(
    activePlan ?? null,
    'meal',
  );

  const [selectedDiet, setSelectedDiet] = useState<string[]>([DIET_OPTIONS[0].value]);
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([AVAILABILITY_OPTIONS[1].value]);
  const [selectedDay, setSelectedDay] = useState(0);
  const swapSheetRef = useRef<BottomSheet>(null);
  const [activeSwap, setActiveSwap] = useState<{ dayNumber: number; mealIndex: number } | null>(null);
  const { data: swapsUsed } = useSwapsUsedThisWeek();
  const swapLimitReached = !isPremium && (swapsUsed ?? 0) >= FREE_LIMITS.MEAL_SWAPS_PER_WEEK;
  useHideNavWhileFocused();

  async function handleGenerate() {
    const diet_type = (selectedDiet[0] ?? DIET_OPTIONS[0].value).toLowerCase();
    const food_availability = (selectedAvailability[0] ?? AVAILABILITY_OPTIONS[1].value).toLowerCase();
    try {
      await generatePlan({ diet_type, food_availability });
      setSelectedDay(0);
    } catch (err: unknown) {
      const e = err as Record<string, unknown>;
      if (e?.error === 'meal_plan_limit_reached') {
        Alert.alert(
          t('meal.alerts.limitTitle'),
          isPremium ? t('meal.alerts.limitPremium') : t('meal.alerts.limitFree'),
        );
      } else if (e?.error === 'generation_in_progress') {
        Alert.alert(t('meal.alerts.inProgressTitle'), t('meal.alerts.inProgressBody'));
      } else if (e?.error === 'no_active_goal') {
        Alert.alert(t('meal.alerts.noGoalTitle'), t('meal.alerts.noGoalBody'));
      } else {
        Alert.alert(t('common:error'), t('meal.alerts.errorBody'));
      }
    }
  }

  // El contenido localizado envuelve el JSON completo del plan (meals);
  // mientras isTranslating, planData es null y se muestra el spinner.
  const planData = (localized?.meals ?? null) as MealPlanData | null;
  const days = planData?.days ?? [];
  const currentDay = days[selectedDay];

  if (isLoading || (activePlan && isTranslating)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          {isTranslating && (
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, marginTop: 12 }}>
              {t('translating')}
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Animated.View entering={FadeInUp.duration(250)} style={{ flex: 1 }}>
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center',
        gap: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: 'BebasNeue-Regular', fontSize: 30 }}>
            {t('meal.title')}
          </Text>
          {activePlan && planData && (
            <Text style={{ color: colors.accent, fontFamily: 'Inter-Medium', fontSize: 12, marginTop: 1 }}>
              {t('meal.headerMacros', {
                calories: activePlan.daily_calories,
                protein: planData.macros.protein_g,
              })}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {activePlan && planData ? (
          <>
            {translateError ? (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12 }}>
                  {t('translateError')}
                </Text>
              </View>
            ) : null}
            {/* Macros diarios */}
            <View style={{
              backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16,
              borderWidth: 1, borderColor: colors.border,
            }}>
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 11, marginBottom: 4 }}>
                {t('meal.dailyAverages')}
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
                    {t('meal.dayCalories', { calories: currentDay.total_calories })}
                  </Text>
                </View>
                {currentDay.meals.map((meal, i) => (
                  <MealPlanCard
                    key={i}
                    meal={meal}
                    onPressSwap={swapLimitReached ? undefined : () => {
                      setActiveSwap({ dayNumber: currentDay.day_number, mealIndex: i });
                      swapSheetRef.current?.expand();
                    }}
                  />
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
                  {generating ? t('meal.generating') : t('meal.regenerate')}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Badge label={t('hub.premiumBadge')} variant="premium" />
                <PaywallBanner
                  message={t('meal.upgradeBanner')}
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
                {t('meal.emptyTitle')}
              </Text>
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
                {t('meal.emptySubtitle')}
              </Text>
            </View>

            {/* Form */}
            <View style={{ gap: 20, marginBottom: 24 }}>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  {t('meal.form.dietLabel')}
                </Text>
                <ChipGroup options={DIET_OPTIONS} selected={selectedDiet} onSelect={(v) => setSelectedDiet([v])} />
              </View>
              <View>
                <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, marginBottom: 10 }}>
                  {t('meal.form.availabilityLabel')}
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
                {generating ? t('meal.generatingMine') : t('meal.generateMine')}
              </Text>
            </TouchableOpacity>

            {!isPremium && (
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
                {t('meal.freeLimitNote', { limit: FREE_LIMITS.MEAL_PLANS_LIFETIME })}
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {activePlan ? (
        <MealSwapSheet
          ref={swapSheetRef}
          mealPlanId={activePlan.id}
          dayNumber={activeSwap?.dayNumber ?? 0}
          mealIndex={activeSwap?.mealIndex ?? 0}
          onDone={() => {
            swapSheetRef.current?.close();
            setActiveSwap(null);
          }}
        />
      ) : null}
      </Animated.View>
    </SafeAreaView>
  );
}
