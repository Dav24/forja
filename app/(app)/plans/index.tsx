import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useActiveWorkoutPlan, useGeneratePlan } from '@/hooks/useWorkoutPlan';
import { colors } from '@/constants/colors';
import { Badge } from '@/components/ui/Badge';
import { useIsPremium } from '@/hooks/useSubscription';

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getTodayDayIndex() {
  return new Date().getDay(); // 0=Dom, 1=Lun...
}

export default function PlansScreen() {
  const { data: activePlan, isLoading, refetch } = useActiveWorkoutPlan();
  const { generating, promptDaysAndGenerate } = useGeneratePlan(refetch);
  const isPremium = useIsPremium();

  const todayIndex = getTodayDayIndex();

  type WorkoutDay = {
    day_number: number;
    day_name: string;
    is_rest: boolean;
    focus: string;
    estimated_duration_minutes: number;
    exercises: { name: string; sets: number; reps: string }[];
  };

  const schedule: WorkoutDay[] = Array.isArray(activePlan?.schedule)
    ? (activePlan.schedule as unknown as WorkoutDay[])
    : [];

  // day_number va de 1-7, donde 1=Lun. Ajustamos al índice JS (0=Dom)
  const todayWorkout = schedule.find((d) => {
    const jsDay = d.day_number === 7 ? 0 : d.day_number;
    return jsDay === todayIndex;
  });

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
      <Animated.View entering={FadeInUp.duration(250)} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
            Planes
          </Text>
          <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 14, marginTop: 2 }}>
            Tu rutina personalizada con IA
          </Text>
        </View>

        {/* Plan activo o estado vacío */}
        {activePlan ? (
          <>
            {/* Card plan activo */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push(`/(app)/plans/workout/${(activePlan as { id: string }).id}`)}
              style={{
                backgroundColor: colors.surfaceElevated,
                borderRadius: 16,
                padding: 16,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.primary + '30',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                  <Text style={{ color: colors.primary, fontFamily: 'Inter-Medium', fontSize: 12 }}>PLAN ACTIVO</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <Text className="uppercase" style={{ color: colors.text, fontFamily: 'BebasNeue-Regular', fontSize: 22, letterSpacing: 0.5, marginBottom: 4 }}>
                {(activePlan as { title: string }).title}
              </Text>
              {(activePlan as { description?: string }).description ? (
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>
                  {(activePlan as { description: string }).description}
                </Text>
              ) : null}

              {/* Mini calendario semanal */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
                {schedule.map((day, i) => {
                  const jsDay = day.day_number === 7 ? 0 : day.day_number;
                  const isToday = jsDay === todayIndex;
                  const isRest = day.is_rest;
                  return (
                    <View
                      key={i}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: isToday
                          ? colors.primary
                          : isRest
                          ? colors.surface
                          : colors.primaryDim + '40',
                      }}
                    >
                      <Text style={{
                        fontFamily: 'Inter-Medium',
                        fontSize: 10,
                        color: isToday ? colors.background : isRest ? colors.textMuted : colors.primary,
                      }}>
                        {DAY_NAMES[jsDay]}
                      </Text>
                      <Ionicons
                        name={isRest ? 'moon-outline' : 'barbell-outline'}
                        size={12}
                        color={isToday ? colors.background : isRest ? colors.textMuted : colors.primary}
                        style={{ marginTop: 2 }}
                      />
                    </View>
                  );
                })}
              </View>
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
                  HOY — {todayWorkout.day_name.toUpperCase()}
                </Text>
                <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, marginBottom: 4 }}>
                  {todayWorkout.focus}
                </Text>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 13 }}>
                  {todayWorkout.exercises.length} ejercicios · ~{todayWorkout.estimated_duration_minutes} min
                </Text>
                <TouchableOpacity
                  onPress={() => router.push(`/(app)/plans/workout/${(activePlan as { id: string }).id}`)}
                  activeOpacity={0.8}
                  style={{ marginTop: 12, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: colors.background, fontFamily: 'Inter-Bold', fontSize: 14 }}>
                    Ver rutina completa
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
                  Día de descanso
                </Text>
                <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 13, marginTop: 4 }}>
                  Hoy toca recuperación. Tu cuerpo también trabaja en reposo.
                </Text>
              </View>
            ) : null}

            {/* Botón nuevo plan */}
            <TouchableOpacity
              onPress={() => promptDaysAndGenerate('Generar Plan')}
              disabled={generating}
              activeOpacity={0.7}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
                opacity: generating ? 0.6 : 1,
              }}
            >
              {generating ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
              )}
              <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Medium', fontSize: 14 }}>
                {generating ? 'Generando plan...' : 'Generar nuevo plan'}
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
              backgroundColor: colors.primaryDim + '40',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}>
              <Ionicons name="barbell-outline" size={36} color={colors.primary} />
            </View>
            <Text style={{ color: colors.text, fontFamily: 'SpaceGrotesk-Bold', fontSize: 22, textAlign: 'center', marginBottom: 8 }}>
              Sin plan activo
            </Text>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
              Genera tu primer plan personalizado con IA. Tarda menos de 30 segundos.
            </Text>
            <TouchableOpacity
              onPress={() => promptDaysAndGenerate('Generar Plan')}
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
                {generating ? 'Generando tu plan...' : 'Generar mi plan'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Acceso a planes alimenticios */}
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
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent + '20', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="nutrition-outline" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <Text className="uppercase" style={{ color: colors.text, fontFamily: 'BebasNeue-Regular', fontSize: 22, letterSpacing: 0.5, flex: 1 }}>
                Planes Alimenticios
              </Text>
              {!isPremium && <Badge label="PREMIUM" variant="premium" />}
            </View>
            <Text style={{ color: colors.textMuted, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 2 }}>
              Nutrición personalizada con IA
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}
