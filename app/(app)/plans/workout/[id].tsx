import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { colors } from '@/constants/colors';
import { StatCard } from '@/components/ui/StatCard';
import { useLocalizedPlan } from '@/hooks/useLocalizedPlan';

type Exercise = {
  order: number;
  name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  technique_notes: string;
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
  weekly_schedule_summary?: string;
  duration_weeks?: number;
  progression_notes?: string;
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

export default function WorkoutPlanDetailScreen() {
  const { t } = useTranslation('plans');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const todayIndex = getTodayDayIndex();
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

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

  const { content, isTranslating, error: translateError } = useLocalizedPlan<LocalizedWorkoutContent>(
    plan ?? null,
    'workout',
  );

  if (isLoading || (plan && isTranslating)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, marginTop: 12 }}>
            {isLoading ? t('workout.loading') : t('translating')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
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

  const view = content ?? { title: plan.title, description: plan.description, schedule: plan.schedule };
  const schedule: WorkoutDay[] = Array.isArray(view.schedule) ? view.schedule : [];
  const trainDays = schedule.filter((d) => !d.is_rest);
  const restDays = schedule.filter((d) => d.is_rest);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Nav bar — back button only */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Step 1: Plan title — Bebas 30px */}
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 0.5 }}>
          {view.title}
        </Text>

        {/* weekly_schedule_summary (fallback to description) */}
        {(plan.weekly_schedule_summary ?? view.description) ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
            {plan.weekly_schedule_summary ?? view.description}
          </Text>
        ) : null}

        {translateError ? (
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 10,
            padding: 10,
            marginTop: 12,
            borderWidth: 1,
            borderColor: colors.border,
          }}>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12 }}>
              {t('translateError')}
            </Text>
          </View>
        ) : null}

        {/* StatCards row */}
        <View className="flex-row gap-2.5 my-4">
          <StatCard value={String(trainDays.length)} label={t('workout.statForgeDays')} />
          <StatCard value={String(restDays.length)} label={t('workout.statRest')} />
          <StatCard value={String(plan.duration_weeks ?? 8)} label={t('workout.statWeeks')} />
        </View>

        {/* Progression notes */}
        {plan.progression_notes ? (
          <View style={{
            backgroundColor: colors.primaryDim + '30',
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.primary + '20',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: 'SpaceGrotesk-Bold', fontSize: 11, letterSpacing: 1 }}>
                {t('workout.progression')}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18 }}>
              {plan.progression_notes}
            </Text>
          </View>
        ) : null}

        {/* Schedule list */}
        {schedule.map((day, index) => {
          const jsDay = day.day_number === 7 ? 0 : day.day_number;
          const isToday = jsDay === todayIndex;
          const isExpanded = expandedDay === index;
          const dayLabel = t('workout.dayHeader', {
            number: day.day_number,
            focus: day.is_rest ? t('workout.restUpper') : (day.focus ?? '').toUpperCase(),
          });

          return (
            <TouchableOpacity
              key={index}
              activeOpacity={day.is_rest ? 1 : 0.8}
              onPress={() => {
                if (!day.is_rest) setExpandedDay(isExpanded ? null : index);
              }}
              style={{
                backgroundColor: isToday ? colors.primaryDim + '40' : colors.surface,
                borderRadius: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: isToday ? colors.primary + '50' : colors.border,
                overflow: 'hidden',
              }}
            >
              {/* Step 2: Day header — Bebas 19px */}
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: day.is_rest
                    ? colors.surfaceElevated
                    : isToday
                    ? colors.primary
                    : colors.primaryDim + '60',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Ionicons
                    name={day.is_rest ? 'moon-outline' : 'barbell-outline'}
                    size={18}
                    color={day.is_rest ? colors.textMuted : isToday ? colors.background : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{
                      fontFamily: 'BebasNeue-Regular',
                      fontSize: 19,
                      color: day.is_rest ? colors.textMuted : colors.primary,
                    }}>
                      {dayLabel}
                    </Text>
                    {isToday && (
                      <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: colors.background, fontFamily: 'SpaceGrotesk-Bold', fontSize: 10 }}>{t('workout.todayBadge')}</Text>
                      </View>
                    )}
                  </View>
                  {!day.is_rest && (
                    <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
                      {t('workout.exercisesMeta', {
                        n: day.exercises.length,
                        minutes: day.estimated_duration_minutes,
                      })}
                    </Text>
                  )}
                </View>
                {!day.is_rest && (
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                )}
              </View>

              {/* Step 3: Expanded exercises — editorial pattern */}
              {isExpanded && !day.is_rest && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 14 }}>
                  {day.exercises.map((ex, ei) => (
                    <View key={ei}>
                      {/* Exercise row */}
                      <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      }}>
                        {/* Order number — Bebas 16px stone */}
                        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 16, color: '#57534E', minWidth: 22 }}>
                          {String(ex.order ?? ei + 1).padStart(2, '0')}
                        </Text>
                        {/* Exercise name — Inter-Medium */}
                        <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14 }}>
                          {ex.name}
                        </Text>
                        {/* Chips — JetBrainsMono-Medium, primaryBright */}
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                            <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.primaryBright }}>
                              {ex.sets}×{ex.reps}
                            </Text>
                          </View>
                          {ex.rest_seconds ? (
                            <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.primaryBright }}>
                                {ex.rest_seconds}s
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      {/* Technique notes — Inter-Regular 12 italic textMuted */}
                      {ex.technique_notes ? (
                        <Text style={{
                          fontFamily: 'Inter-Regular',
                          fontSize: 12,
                          fontStyle: 'italic',
                          color: colors.textMuted,
                          paddingTop: 4,
                          paddingBottom: 2,
                          paddingLeft: 32,
                        }}>
                          {ex.technique_notes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
