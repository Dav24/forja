import { useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useActiveWorkoutPlan, useGeneratePlan } from '@/hooks/useWorkoutPlan';
import { useActiveMealPlan } from '@/hooks/useMealPlan';
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';
import { useTheme } from '@/lib/theme';
import { useHideNavOnScroll } from '@/lib/scrollNav';
import { Badge } from '@/components/ui/Badge';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { useIsPremium } from '@/hooks/useSubscription';
import { GeneratePlanSheet } from '@/components/plans/GeneratePlanSheet';
import { WeekBars } from '@/components/plans/WeekBars';
import { MacroBar } from '@/components/plans/MacroBar';
import { typography } from '@/constants/typography';

type WorkoutDay = {
  day_number: number;
  day_name: string;
  is_rest: boolean;
  focus: string;
  estimated_duration_minutes: number;
  exercises: { name: string; sets: number; reps: string }[];
};

type MealPlanSummary = {
  id: string;
  title: string;
  daily_calories: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
};

function getTodayDayIndex() {
  return new Date().getDay(); // 0=Dom, 1=Lun...
}

export default function PlansScreen() {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const { data: activePlan, isLoading, refetch } = useActiveWorkoutPlan();
  const { generating, generate } = useGeneratePlan(refetch);
  // Pasivo: muestra la traducción SI ya está cacheada; nunca dispara la EF
  // (listar planes no debe costar llamadas de IA). La traducción se dispara
  // solo al abrir el detalle.
  const { content: localized } = useLocalizedPlan<{
    title: string;
    description: string;
    schedule: WorkoutDay[];
  }>(activePlan ?? null, 'workout', { trigger: false });
  // Vista previa sin disparar traducción (igual que el plan de entrenamiento arriba):
  // los gramos/kcal son numéricos y el título se muestra tal cual se generó.
  const { data: mealPlan } = useActiveMealPlan();
  const isPremium = useIsPremium();
  const sheetRef = useRef<BottomSheet>(null);
  const navScroll = useHideNavOnScroll();

  const todayIndex = getTodayDayIndex();

  const schedule: WorkoutDay[] = Array.isArray(localized?.schedule)
    ? localized.schedule
    : Array.isArray(activePlan?.schedule)
    ? (activePlan.schedule as unknown as WorkoutDay[])
    : [];

  // day_number va de 1-7, donde 1=Lun. Ajustamos al índice JS (0=Dom)
  const todayWorkout = schedule.find((d) => {
    const jsDay = d.day_number === 7 ? 0 : d.day_number;
    return jsDay === todayIndex;
  });

  const mealSummary = mealPlan as MealPlanSummary | null | undefined;
  const mealMacros = mealSummary?.macros;
  const mealMacroTotal = mealMacros ? mealMacros.protein_g + mealMacros.carbs_g + mealMacros.fat_g : 0;

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
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false} {...navScroll}>
        {/* Header */}
        <StaggerIn index={0}>
        <View style={{ marginBottom: 24 }}>
          <Text className="uppercase" style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text, letterSpacing: 1 }}>
            {t('hub.title')}
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, marginTop: 2 }}>
            {t('hub.subtitle')}
          </Text>
        </View>
        </StaggerIn>

        {/* Plan activo o estado vacío */}
        <StaggerIn index={1}>
        {activePlan ? (
          <>
            {/* Card plan activo */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/(app)/plans/workout/${(activePlan as { id: string }).id}`)}
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 16,
                padding: 17,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.primaryDim,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.primaryDim,
                    borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5,
                  }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                  <Text style={{ color: colors.primaryText, fontFamily: 'Inter-Medium', fontSize: 11.5 }}>{t('hub.activePlanBadge')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <Text className="uppercase" style={{ color: colors.text, fontFamily: 'BebasNeue-Regular', fontSize: 26, letterSpacing: 0.5, marginTop: 10 }}>
                {localized?.title ?? (activePlan as { title: string }).title}
              </Text>
              {(localized?.description ?? (activePlan as { description?: string }).description) ? (
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12.5, lineHeight: 18, marginTop: 5 }} numberOfLines={2}>
                  {localized?.description ?? (activePlan as { description: string }).description}
                </Text>
              ) : null}

              <WeekBars schedule={schedule} todayJsDay={todayIndex} />
            </TouchableOpacity>

            {/* Entrenamiento de hoy */}
            {todayWorkout && !todayWorkout.is_rest ? (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 12, marginBottom: 8 }}>
                  {t('hub.todayHeader', { day: todayWorkout.day_name.toUpperCase() })}
                </Text>
                <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, marginBottom: 4 }}>
                  {todayWorkout.focus}
                </Text>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 13 }}>
                  {t('hub.exercisesMeta', {
                    n: todayWorkout.exercises.length,
                    minutes: todayWorkout.estimated_duration_minutes,
                  })}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/(app)/plans/workout/${(activePlan as { id: string }).id}`)}
                  activeOpacity={0.8}
                  style={{ marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 14 }}>
                    {t('hub.viewFullRoutine')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : todayWorkout?.is_rest ? (
              <View style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}>
                <Ionicons name="moon-outline" size={28} color={colors.accent} style={{ marginBottom: 8 }} />
                <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 16 }}>
                  {t('hub.restDayTitle')}
                </Text>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 13, marginTop: 4 }}>
                  {t('hub.restDaySubtitle')}
                </Text>
              </View>
            ) : null}

            {/* Botón nuevo plan — ghost, conserva el handler/sheet actual */}
            <TouchableOpacity
              onPress={() => sheetRef.current?.expand()}
              disabled={generating}
              activeOpacity={0.7}
              style={{
                borderWidth: 1,
                borderColor: colors.borderStrong,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 7,
                marginTop: 14,
                opacity: generating ? 0.6 : 1,
              }}
            >
              {generating ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="add" size={16} color={colors.textMuted} />
              )}
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 13 }}>
                {generating ? t('hub.generating') : t('hub.generateNew')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          /* Estado vacío — sin plan */
          <View style={{ alignItems: 'center', paddingVertical: 48 }}>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.chip,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="barbell-outline" size={36} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
              {t('hub.emptyTitle')}
            </Text>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
              {t('hub.emptySubtitle')}
            </Text>
            <TouchableOpacity
              onPress={() => sheetRef.current?.expand()}
              disabled={generating}
              activeOpacity={0.8}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 32,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Ionicons name="sparkles-outline" size={20} color={colors.background} />
              )}
              <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 16 }}>
                {generating ? t('hub.generatingMine') : t('hub.generateMine')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        </StaggerIn>

        {/* Acceso a planes alimenticios */}
        <StaggerIn index={2}>
        {mealSummary && mealMacroTotal > 0 ? (
          <TouchableOpacity
            onPress={() => router.push('/(app)/plans/meal')}
            activeOpacity={0.8}
            style={{
              marginTop: 24,
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 17,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.textMuted }}>
                {t('hub.mealPlanEyebrow')}
              </Text>
              <Text style={{ color: colors.accentText, fontFamily: 'JetBrainsMono-Medium', fontSize: 12 }}>
                {t('meal.dayCalories', { calories: mealSummary.daily_calories })}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14.5, marginTop: 8 }}>
              {mealSummary.title}
            </Text>
            <MacroBar
              protein_g={mealMacros!.protein_g}
              carbs_g={mealMacros!.carbs_g}
              fat_g={mealMacros!.fat_g}
              compact
            />
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
              <Text style={{ color: colors.textMuted, fontFamily: 'JetBrainsMono-Medium', fontSize: 10.5 }}>
                {t('hub.mealMacroProtein', { grams: mealMacros!.protein_g })}
              </Text>
              <Text style={{ color: colors.textMuted, fontFamily: 'JetBrainsMono-Medium', fontSize: 10.5 }}>
                {t('hub.mealMacroCarbs', { grams: mealMacros!.carbs_g })}
              </Text>
              <Text style={{ color: colors.textMuted, fontFamily: 'JetBrainsMono-Medium', fontSize: 10.5 }}>
                {t('hub.mealMacroFat', { grams: mealMacros!.fat_g })}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/(app)/plans/meal')}
            activeOpacity={0.8}
            style={{
              marginTop: 24,
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="nutrition-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <Text className="uppercase" style={{ color: colors.text, fontFamily: 'BebasNeue-Regular', fontSize: 22, letterSpacing: 0.5, flex: 1 }}>
                  {t('hub.mealPlansTitle')}
                </Text>
                {!isPremium && <Badge label={t('hub.premiumBadge')} variant="premium" />}
              </View>
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
                {t('hub.mealPlansSubtitle')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        </StaggerIn>
      </ScrollView>

      <GeneratePlanSheet
        ref={sheetRef}
        onGenerate={(params) => {
          sheetRef.current?.close();
          generate(params);
        }}
      />
    </SafeAreaView>
  );
}
