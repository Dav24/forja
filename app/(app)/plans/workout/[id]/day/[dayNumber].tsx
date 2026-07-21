import { useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { useHideNavWhileFocused } from '@/lib/scrollNav';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';
import { ExerciseSheet } from '@/components/plans/ExerciseSheet';
import { useCanFinalizeSession, useApplySuggestion, type SubmitSessionFeedbackResponse } from '@/hooks/useSessionFeedback';
import { SessionFeedbackSheet } from '@/components/plans/SessionFeedbackSheet';

type Exercise = {
  order: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  technique_notes: string;
  exercise_slug?: string | null;
};

type WorkoutDay = {
  day_number: number;
  day_name: string;
  is_rest: boolean;
  focus: string;
  estimated_duration_minutes: number;
  exercises: Exercise[];
};

type WorkoutPlan = {
  id: string;
  title: string;
  description: string;
  schedule: WorkoutDay[];
  created_at: string;
};

type LocalizedWorkoutContent = {
  title: string;
  description: string;
  schedule: WorkoutDay[];
};

function getTodayDayIndex() {
  return new Date().getDay();
}

export default function WorkoutDayDetailScreen() {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const { id, dayNumber } = useLocalSearchParams<{ id: string; dayNumber: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const exerciseSheetRef = useRef<BottomSheet>(null);
  const [activeExercise, setActiveExercise] = useState<{ exercise: Exercise; exerciseIndex: number } | null>(null);
  const feedbackSheetRef = useRef<BottomSheet>(null);
  const { mutate: applySuggestion } = useApplySuggestion();
  useHideNavWhileFocused();

  function handleFeedbackSubmitted(response: SubmitSessionFeedbackResponse, planId: string, dayNum: number) {
    feedbackSheetRef.current?.close();
    if (!response.suggestion) {
      Alert.alert(t('sessionFeedback.submitSuccess'));
      return;
    }
    if (response.applied) {
      // Ya se auto-aplicó server-side (premium + auto_adjust_enabled) — el push ya salió, no hace falta Alert extra aquí.
      return;
    }
    if (response.requires_credit) {
      Alert.alert(
        t('sessionFeedback.requiresCredit.title'),
        t('sessionFeedback.requiresCredit.body'),
        [
          { text: t('sessionFeedback.requiresCredit.cancelButton'), style: 'cancel' },
          { text: t('sessionFeedback.requiresCredit.useButton'), onPress: () => applySuggestion({ workoutPlanId: planId, dayNumber: dayNum, suggestion: response.suggestion! }) },
        ],
      );
      return;
    }
    if (response.requires_approval) {
      Alert.alert(
        t('sessionFeedback.requiresApproval.title'),
        t('sessionFeedback.requiresApproval.body'),
        [
          { text: t('sessionFeedback.requiresApproval.ignoreButton'), style: 'cancel' },
          { text: t('sessionFeedback.requiresApproval.applyButton'), onPress: () => applySuggestion({ workoutPlanId: planId, dayNumber: dayNum, suggestion: response.suggestion! }) },
        ],
      );
    }
  }

  const { data: plan, isLoading } = useQuery<WorkoutPlan>({
    queryKey: ['workout_plan', id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', id!)
        .eq('user_id', user!.id)
        .single();
      if (error) throw error;
      return data as unknown as WorkoutPlan;
    },
  });

  const { content, isTranslating } = useLocalizedPlan<LocalizedWorkoutContent>(plan ?? null, 'workout');

  const schedule: WorkoutDay[] = Array.isArray(content?.schedule) ? content!.schedule : (plan?.schedule ?? []);
  const day = schedule.find((d) => d.day_number === Number(dayNumber));

  const { canFinalize, loggedCount, totalCount } = useCanFinalizeSession(
    plan?.id ?? '',
    Number(dayNumber),
    (day?.exercises ?? []).map((e) => e.order),
  );

  if (isLoading || (plan && isTranslating)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!plan || !day) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18, textAlign: 'center' }}>
            {t('workout.notFound')}
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter-Medium', fontSize: 15 }}>{t('workout.back')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const jsDay = day.day_number === 7 ? 0 : day.day_number;
  const isToday = jsDay === getTodayDayIndex();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.display, color: colors.primary, letterSpacing: 0.5 }}>
          {t('workout.dayNumber', { number: day.day_number })}
        </Text>
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: typography.sizes.h1, color: colors.text, marginTop: 2 }}>
          {(day.focus ?? '').toUpperCase()}
        </Text>
        {isToday && (
          <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 8 }}>
            <Text style={{ color: colors.background, fontFamily: 'SpaceGrotesk-Bold', fontSize: 10 }}>{t('workout.todayBadge')}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 20 }}>
          <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 12, color: colors.accent }}>
              {t('workout.exercisesMeta', { n: day.exercises.length, minutes: day.estimated_duration_minutes })}
            </Text>
          </View>
        </View>

        {day.exercises.map((ex, ei) => (
          <StaggerIn key={ei} index={ei}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setActiveExercise({ exercise: ex, exerciseIndex: ei });
                exerciseSheetRef.current?.expand();
              }}
            >
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
                borderBottomWidth: 1, borderBottomColor: colors.border,
              }}>
                <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 16, color: colors.textFaint, minWidth: 22 }}>
                  {String(ex.order ?? ei + 1).padStart(2, '0')}
                </Text>
                <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14 }}>
                  {ex.name}
                </Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.accent }}>
                      {ex.sets}×{ex.reps}
                    </Text>
                  </View>
                  {ex.rest_seconds ? (
                    <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.accent }}>
                        {ex.rest_seconds}s
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ width: 22, height: 22, borderRadius: 99, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="play" size={10} color={colors.primary} style={{ marginLeft: 1 }} />
                  </View>
                </View>
              </View>
              {ex.technique_notes ? (
                <Text style={{
                  fontFamily: 'Inter-Regular', fontSize: 12, fontStyle: 'italic', color: colors.textMuted,
                  paddingTop: 4, paddingBottom: 2, paddingLeft: 32,
                }}>
                  {ex.technique_notes}
                </Text>
              ) : null}
            </TouchableOpacity>
          </StaggerIn>
        ))}

        {!day.is_rest && (
          <TouchableOpacity
            onPress={() => feedbackSheetRef.current?.expand()}
            disabled={!canFinalize}
            style={{
              marginTop: 20, backgroundColor: canFinalize ? colors.primary : colors.surfaceElevated,
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            }}
          >
            <Text style={{ color: canFinalize ? colors.background : colors.textFaint, fontFamily: 'SpaceGrotesk-Bold', fontSize: 15 }}>
              {canFinalize ? t('workout.finalizeButton', { defaultValue: 'Finalizar entrenamiento' }) : t('workout.finalizeProgress', { logged: loggedCount, total: totalCount, defaultValue: `${loggedCount}/${totalCount} ejercicios registrados` })}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <ExerciseSheet
        ref={exerciseSheetRef}
        exercise={activeExercise?.exercise ?? null}
        workoutPlanId={plan.id}
        dayNumber={day.day_number}
        exerciseIndex={activeExercise?.exerciseIndex ?? 0}
        isToday={isToday}
        onChange={(index) => {
          // Al cerrar el sheet de ejercicio, refrescamos el conteo de "Finalizar entrenamiento"
          // (useLogExerciseSets no invalida ['exercise_logs_today', ...], así que sin esto el botón
          // podía quedar desactualizado hasta salir y volver a entrar a la pantalla).
          if (index === -1) {
            queryClient.invalidateQueries({ queryKey: ['exercise_logs_today', plan.id, day.day_number] });
          }
        }}
      />

      <SessionFeedbackSheet
        ref={feedbackSheetRef}
        workoutPlanId={plan.id}
        dayNumber={day.day_number}
        exercises={day.exercises.map((e) => ({ order: e.order, name: e.name }))}
        onSubmitted={(response) => handleFeedbackSubmitted(response, plan.id, day.day_number)}
      />
    </SafeAreaView>
  );
}
