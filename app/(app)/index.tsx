import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfile, useActiveGoal } from '@/hooks/useProfile';
import { useActiveWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useLatestBodyData } from '@/hooks/useBodyTracking';
import { useStreak } from '@/hooks/useStreak';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { colors } from '@/constants/colors';

const GOAL_LABELS: Record<string, string> = {
  weight_loss: 'Bajar de peso',
  muscle_gain: 'Ganar músculo',
  recomposition: 'Recomposición',
  powerlifting: 'Powerlifting',
  sport_specific: 'Deporte específico',
  general_fitness: 'Fitness general',
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getTodayDayName() {
  return DAY_NAMES[new Date().getDay()];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: goal, isLoading: loadingGoal } = useActiveGoal();
  const { data: plan, isLoading: loadingPlan } = useActiveWorkoutPlan();
  const { data: bodyData, isLoading: loadingBody } = useLatestBodyData();
  const { data: streak = 0 } = useStreak();

  const todayDayName = getTodayDayName();
  const schedule = plan?.schedule as { days?: { day: string; muscle_groups: string[]; exercises: { name: string }[] }[] } | null;
  const todayWorkout = schedule?.days?.find((d) => d.day === todayDayName);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header: saludo + streak */}
      <View className="px-5 mb-6 flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-text-muted text-sm">{getGreeting()},</Text>
          {loadingProfile
            ? <Skeleton className="h-8 w-40 mt-1" />
            : <Text className="text-text font-bold text-3xl mt-0.5" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                {profile?.display_name ?? 'Atleta'} 👋
              </Text>
          }
        </View>

        {/* Streak badge */}
        <View className="bg-surface border border-border rounded-2xl px-3 py-2 items-center ml-4">
          <Text className="text-warning text-lg">🔥</Text>
          <Text className="text-warning font-bold text-lg" style={{ fontFamily: 'JetBrainsMono-Medium' }}>
            {streak}
          </Text>
          <Text className="text-text-muted text-xs">días</Text>
        </View>
      </View>

      {/* Plan de hoy */}
      <View className="px-5 mb-4">
        <Text className="text-text-muted text-sm font-medium mb-3 uppercase tracking-widest">Entrenamiento de hoy</Text>
        {loadingPlan
          ? <Skeleton className="h-32 w-full" />
          : plan
            ? (
              <Card className="gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-text font-bold text-lg" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                    {plan.title}
                  </Text>
                  <Badge label={plan.is_active ? 'Activo' : 'Inactivo'} variant="primary" />
                </View>

                {todayWorkout
                  ? (
                    <View className="gap-2">
                      <View className="flex-row gap-2 flex-wrap">
                        {todayWorkout.muscle_groups.map((g) => (
                          <Badge key={g} label={g} variant="muted" />
                        ))}
                      </View>
                      <Text className="text-text-muted text-sm">
                        {todayWorkout.exercises.length} ejercicios · {todayDayName}
                      </Text>
                      {todayWorkout.exercises.slice(0, 3).map((ex) => (
                        <View key={ex.name} className="flex-row items-center gap-2">
                          <View className="w-1.5 h-1.5 rounded-full bg-primary" />
                          <Text className="text-text text-sm">{ex.name}</Text>
                        </View>
                      ))}
                      {todayWorkout.exercises.length > 3 && (
                        <Text className="text-text-muted text-sm">
                          +{todayWorkout.exercises.length - 3} más
                        </Text>
                      )}
                    </View>
                  )
                  : <Text className="text-text-muted text-sm">Día de descanso 💤</Text>
                }

                <TouchableOpacity
                  className="border border-border rounded-xl h-10 items-center justify-center mt-1"
                  onPress={() => router.push('/(app)/plans/workout')}
                >
                  <Text className="text-text text-sm font-semibold">Ver plan completo</Text>
                </TouchableOpacity>
              </Card>
            )
            : (
              <Card className="items-center py-6 gap-3">
                <Text className="text-4xl">🏋️</Text>
                <Text className="text-text font-bold text-lg text-center" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                  Sin plan de entrenamiento
                </Text>
                <Text className="text-text-muted text-sm text-center">
                  Tu coach IA generará un plan personalizado para ti
                </Text>
                <TouchableOpacity
                  className="bg-primary rounded-xl h-11 px-6 items-center justify-center mt-1"
                  onPress={() => router.push('/(app)/plans/workout')}
                >
                  <Text className="text-background font-bold text-sm">Generar mi plan</Text>
                </TouchableOpacity>
              </Card>
            )
        }
      </View>

      {/* Stats rápidas */}
      <View className="px-5 mb-6">
        <Text className="text-text-muted text-sm font-medium mb-3 uppercase tracking-widest">Stats</Text>
        <View className="flex-row gap-3">
          {/* Peso */}
          <Card className="flex-1 gap-1">
            <Text className="text-text-muted text-xs">Último peso</Text>
            {loadingBody
              ? <Skeleton className="h-8 w-20 mt-1" />
              : <Text className="text-text font-bold text-2xl" style={{ fontFamily: 'JetBrainsMono-Medium' }}>
                  {bodyData?.weight_kg ? `${bodyData.weight_kg}` : '—'}
                  <Text className="text-text-muted text-sm font-normal"> kg</Text>
                </Text>
            }
          </Card>

          {/* Objetivo */}
          <Card className="flex-1 gap-1">
            <Text className="text-text-muted text-xs">Objetivo</Text>
            {loadingGoal
              ? <Skeleton className="h-8 w-20 mt-1" />
              : <Text className="text-text font-bold text-sm mt-1" style={{ fontFamily: 'SpaceGrotesk-SemiBold' }} numberOfLines={2}>
                  {goal ? GOAL_LABELS[goal.type] : '—'}
                </Text>
            }
          </Card>
        </View>
      </View>

      {/* CTA Coach */}
      <View className="px-5">
        <TouchableOpacity
          className="rounded-2xl overflow-hidden"
          onPress={() => router.push('/(app)/chat')}
          activeOpacity={0.85}
        >
          <View className="bg-primary-dim border border-primary p-5 flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center">
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.background} />
            </View>
            <View className="flex-1">
              <Text className="text-primary font-bold text-lg" style={{ fontFamily: 'SpaceGrotesk-Bold' }}>
                Hablar con mi Coach
              </Text>
              <Text className="text-text-muted text-sm mt-0.5">
                Tu entrenador IA está listo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
