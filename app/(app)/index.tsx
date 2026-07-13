import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useProfile, useActiveGoal } from '@/hooks/useProfile';
import { useActiveWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useLatestBodyData, useFirstBodyData } from '@/hooks/useBodyTracking';
import { useStreak } from '@/hooks/useStreak';
import { ForjaWordmark } from '@/components/brand/ForjaWordmark';
import { StreakFlame } from '@/components/home/StreakFlame';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/lib/theme';

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DAY_NAMES_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function normalizeDayName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function getTodayDayNames(): string[] {
  const idx = new Date().getDay();
  return [DAY_NAMES_ES[idx], DAY_NAMES_EN[idx]];
}

interface ScheduleDay {
  day_number: number;
  day_name: string;
  is_rest: boolean;
  focus?: string;
  duration_min?: number;
  exercises?: { name: string; order?: number; sets?: number | string; reps?: number | string }[];
}

function getGreetingPeriod(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 19) return 'afternoon';
  return 'evening';
}

export default function HomeScreen() {
  const { t } = useTranslation('home');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: goal } = useActiveGoal();
  const { data: plan, isLoading: loadingPlan } = useActiveWorkoutPlan();
  const { data: bodyData } = useLatestBodyData();
  const { data: firstBody } = useFirstBodyData();
  const { data: streak = 0 } = useStreak();

  const todayNames = getTodayDayNames();
  const schedule: ScheduleDay[] = Array.isArray(plan?.schedule) ? (plan.schedule as unknown as ScheduleDay[]) : [];
  const todayWorkout = schedule.find((d) => todayNames.includes(normalizeDayName(d.day_name)));
  const todayExercises = todayWorkout?.exercises ?? [];

  const greetingPeriod = getGreetingPeriod();
  const greetingText =
    greetingPeriod === 'morning'
      ? t('greeting.morning')
      : greetingPeriod === 'afternoon'
        ? t('greeting.afternoon')
        : t('greeting.evening');

  const defaultFocus = t('hero.defaultFocus');
  const heroLine1 = !plan ? t('hero.noPlanLine1') : todayWorkout && !todayWorkout.is_rest ? t('hero.workoutLine1') : t('hero.restLine1');
  const heroLine2 = !plan ? t('hero.noPlanLine2') : todayWorkout && !todayWorkout.is_rest ? (todayWorkout.focus ?? defaultFocus).toUpperCase() : t('hero.restLine2');

  const goalProgressPct = (() => {
    const start = firstBody?.weight_kg;
    const current = bodyData?.weight_kg;
    const target = goal?.target_weight_kg;
    if (start == null || current == null || target == null || start === target) return null;
    const pct = Math.round(((current - start) / (target - start)) * 100);
    return Math.min(Math.max(pct, 0), 100);
  })();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Section 0 — Brand header */}
      <Animated.View entering={FadeInUp.duration(250).delay(0)}>
        <View className="px-5 mb-4 flex-row items-center justify-between">
          <ForjaWordmark size="sm" />
          <StreakFlame streak={streak} compact />
        </View>
      </Animated.View>

      {/* Section 1 — Saludo + hero editorial */}
      <Animated.View entering={FadeInUp.duration(250).delay(60)}>
        <View className="px-5 mb-4">
          <Text className="text-text-muted text-sm" style={{ fontFamily: 'Inter-Regular' }}>
            {greetingText}, {profile?.display_name ?? t('greeting.fallbackName')}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 34, lineHeight: 38, color: colors.text, letterSpacing: 1 }}>
            {heroLine1}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 34, lineHeight: 38, color: colors.primary, letterSpacing: 1 }}>
            {heroLine2}
          </Text>
        </View>
      </Animated.View>

      {/* Section 2 — Card del día */}
      <Animated.View entering={FadeInUp.duration(250).delay(120)}>
        <View className="px-5 mb-4">
          {loadingPlan ? (
            <Skeleton className="h-40 w-full" />
          ) : plan ? (
            <Card>
              {/* Bebas day header */}
              <Text
                style={{ fontFamily: 'BebasNeue-Regular', fontSize: 19, color: colors.primary, letterSpacing: 0.5 }}
                className="mb-2"
              >
                {todayWorkout
                  ? t('today.dayHeader', {
                      number: todayWorkout.day_number,
                      focus: (todayWorkout.focus ?? defaultFocus).toUpperCase(),
                    })
                  : plan.title.toUpperCase()}
              </Text>

              {todayWorkout && !todayWorkout.is_rest ? (
                <>
                  {todayExercises.slice(0, 3).map((ex, i) => (
                    <View
                      key={`${ex.name}-${i}`}
                      className="flex-row items-center gap-2.5 py-2 border-b border-border"
                    >
                      <Text
                        style={{ fontFamily: 'BebasNeue-Regular', fontSize: 16, color: '#57534E', minWidth: 22 }}
                      >
                        {String(ex.order ?? i + 1).padStart(2, '0')}
                      </Text>
                      <Text className="flex-1 text-text text-sm" style={{ fontFamily: 'Inter-Medium' }}>
                        {ex.name}
                      </Text>
                      {ex.sets != null && ex.reps != null && (
                        <View className="bg-surface-elevated rounded-md px-2 py-0.5">
                          <Text
                            style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.accent }}
                          >
                            {ex.sets}×{ex.reps}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                  {todayExercises.length > 3 && (
                    <Text className="text-text-muted text-sm pt-2">
                      {t('today.moreExercises', { count: todayExercises.length - 3 })}
                    </Text>
                  )}
                </>
              ) : (
                <Text className="text-text-muted text-sm">
                  {todayWorkout?.is_rest ? t('today.restDay') : t('today.noWorkout')}
                </Text>
              )}
            </Card>
          ) : (
            <Card className="items-center py-6 gap-3">
              <Text className="text-text text-sm text-center" style={{ fontFamily: 'Inter-Medium' }}>
                {t('empty.message')}
              </Text>
              <Button
                label={t('empty.cta')}
                size="sm"
                variant="secondary"
                onPress={() => router.push('/(app)/plans/workout')}
              />
            </Card>
          )}
        </View>
      </Animated.View>

      {/* Section 3 — Stats + CTA */}
      <Animated.View entering={FadeInUp.duration(250).delay(180)}>
        <View className="px-5 mb-4 flex-row gap-2.5">
          <StatCard value={bodyData?.weight_kg ?? '—'} decimals={1} suffix=" kg" label={t('stats.current')} />
          <StatCard value={goal?.target_weight_kg ?? '—'} decimals={1} suffix=" kg" label={t('stats.goal')} />
          <StatCard value={goalProgressPct ?? '—'} suffix="%" label={t('stats.progress')} />
        </View>

        <View className="px-5">
          <Button label={t('chatCta')} size="md" onPress={() => router.push('/(app)/chat')} />
        </View>
      </Animated.View>
    </ScrollView>
  );
}
