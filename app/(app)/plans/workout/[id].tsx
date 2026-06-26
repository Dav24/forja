import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { colors } from '@/constants/colors';

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

function getTodayDayIndex() {
  return new Date().getDay();
}

export default function WorkoutPlanDetailScreen() {
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

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, marginTop: 12 }}>
            Cargando plan...
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
            Plan no encontrado
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter-Medium', fontSize: 15 }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const schedule: WorkoutDay[] = Array.isArray(plan.schedule) ? plan.schedule : [];
  const trainDays = schedule.filter((d) => !d.is_rest);
  const restDays = schedule.filter((d) => d.is_rest);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ flex: 1, color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 18 }} numberOfLines={1}>
          {plan.title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Descripción */}
        {plan.description ? (
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
            {plan.description}
          </Text>
        ) : null}

        {/* Stats rápidos */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {[
            { icon: 'barbell-outline' as const, label: `${trainDays.length} días/sem`, color: colors.primary },
            { icon: 'moon-outline' as const, label: `${restDays.length} descanso`, color: colors.accent },
            { icon: 'time-outline' as const, label: `${plan.duration_weeks ?? 8} semanas`, color: colors.warning },
          ].map((stat, i) => (
            <View key={i} style={{
              flex: 1,
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 12,
              alignItems: 'center',
              gap: 4,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <Ionicons name={stat.icon} size={20} color={stat.color} />
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 11, textAlign: 'center' }}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Progresión */}
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
              <Text style={{ color: colors.primary, fontFamily: 'Inter-Bold', fontSize: 12 }}>PROGRESIÓN</Text>
            </View>
            <Text style={{ color: colors.text, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18 }}>
              {plan.progression_notes}
            </Text>
          </View>
        ) : null}

        {/* Lista de días */}
        <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, marginBottom: 12 }}>
          Programa semanal
        </Text>

        {schedule.map((day, index) => {
          const jsDay = day.day_number === 7 ? 0 : day.day_number;
          const isToday = jsDay === todayIndex;
          const isExpanded = expandedDay === index;

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
              {/* Cabecera del día */}
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
                      color: day.is_rest ? colors.textMuted : colors.text,
                      fontFamily: 'Inter-Bold',
                      fontSize: 15,
                    }}>
                      {day.day_name}
                    </Text>
                    {isToday && (
                      <View style={{ backgroundColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 10 }}>HOY</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
                    {day.is_rest ? 'Descanso' : `${day.focus} · ${day.exercises.length} ejercicios · ~${day.estimated_duration_minutes}min`}
                  </Text>
                </View>
                {!day.is_rest && (
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                )}
              </View>

              {/* Ejercicios expandidos */}
              {isExpanded && !day.is_rest && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 14 }}>
                  {day.exercises.map((ex, ei) => (
                    <View key={ei} style={{
                      paddingTop: 12,
                      borderTopWidth: ei > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                      marginTop: ei > 0 ? 0 : 0,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontFamily: 'Inter-SemiBold', fontSize: 14 }}>
                            {ex.name}
                          </Text>
                          {ex.muscle_group ? (
                            <Text style={{ color: colors.primary, fontFamily: 'Inter-Medium', fontSize: 11, marginTop: 2 }}>
                              {ex.muscle_group}
                            </Text>
                          ) : null}
                          {ex.technique_notes ? (
                            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                              {ex.technique_notes}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Text style={{ color: colors.text, fontFamily: 'Inter-Bold', fontSize: 13 }}>
                              {ex.sets}×{ex.reps}
                            </Text>
                          </View>
                          {ex.rest_seconds ? (
                            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 11 }}>
                              {ex.rest_seconds}s descanso
                            </Text>
                          ) : null}
                        </View>
                      </View>
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
