import { ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useProfile, useActiveGoal } from '@/hooks/useProfile';
import { useActiveWorkoutPlan } from '@/hooks/useWorkoutPlan';
import { useLatestBodyData, useFirstBodyData } from '@/hooks/useBodyTracking';
import { useActiveMealPlan } from '@/hooks/useMealPlan';
import { useStreak } from '@/hooks/useStreak';
import { StreakFlame } from '@/components/home/StreakFlame';
import { WeekRing } from '@/components/home/WeekRing';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { StaggerIn } from '@/components/ui/StaggerIn';
import type { Meal } from '@/components/plans/MealPlanCard';
import { useTheme } from '@/lib/theme';
import { useHideNavOnScroll } from '@/lib/scrollNav';
import { formatDate } from '@/lib/formatDate';
import { weekProgress } from '@/lib/weekProgress';
import { gradientsByTheme, fireShadowByTheme } from '@/constants/themes';
import { typography } from '@/constants/typography';

const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const DAY_NAMES_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function normalizeDayName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function getTodayDayNames(): string[] {
  const idx = new Date().getDay();
  return [DAY_NAMES_ES[idx], DAY_NAMES_EN[idx]];
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// Opacidad del degradado ember del hero derivada del propio token de tema (sin
// hex nuevos): aproxima el radial-gradient del prototipo (.hero) con un
// LinearGradient vertical, 28%→transparente en dark / 16% en light.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface ScheduleDay {
  day_number: number;
  day_name: string;
  is_rest: boolean;
  focus?: string;
  estimated_duration_minutes?: number;
  exercises?: { name: string; order?: number; sets?: number | string; reps?: number | string }[];
}

interface MealDay {
  day_number: number;
  day_name: string;
  total_calories: number;
  meals: Meal[];
}

// Primera comida del día cuya hora de inicio no ha pasado; si ya pasaron todas, la última.
function parseStartHour(range: string): number | null {
  const m = range.match(/^(\d{1,2})/);
  return m ? parseInt(m[1], 10) : null;
}

function pickNextMeal(meals: Meal[]): Meal | undefined {
  if (meals.length === 0) return undefined;
  const currentHour = new Date().getHours();
  const upcoming = meals.find((m) => {
    const h = parseStartHour(m.time_suggestion);
    return h !== null && h >= currentHour;
  });
  return upcoming ?? meals[meals.length - 1];
}

// Eyebrow compartido del hero/bento (prototipo v7, .eyebrow): Space Grotesk
// 700 11px, letterspacing 2.2, uppercase vía textTransform (no .toUpperCase()).
function Eyebrow({ children, color, center }: { children: ReactNode; color: string; center?: boolean }) {
  return (
    <Text
      style={{
        fontFamily: 'SpaceGrotesk-Bold',
        fontSize: 11,
        letterSpacing: 2.2,
        textTransform: 'uppercase',
        color,
        textAlign: center ? 'center' : 'left',
      }}
    >
      {children}
    </Text>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation('home');
  const { colors, resolved } = useTheme();
  const gradients = gradientsByTheme[resolved];
  const fireShadow = fireShadowByTheme[resolved];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: goal } = useActiveGoal();
  const { data: plan, isLoading: loadingPlan } = useActiveWorkoutPlan();
  const { data: bodyData } = useLatestBodyData();
  const { data: firstBody } = useFirstBodyData();
  const { data: mealPlan } = useActiveMealPlan();
  const { data: streak = 0 } = useStreak();
  const navScroll = useHideNavOnScroll();

  const todayNames = getTodayDayNames();
  const todayJsDay = new Date().getDay();
  const schedule: ScheduleDay[] = Array.isArray(plan?.schedule) ? (plan.schedule as unknown as ScheduleDay[]) : [];
  const todayWorkout = schedule.find((d) => todayNames.includes(normalizeDayName(d.day_name)));
  const todayExercises = todayWorkout?.exercises ?? [];
  const isRestOrUnscheduled = !todayWorkout || todayWorkout.is_rest;

  const defaultFocus = t('hero.defaultFocus');
  const focusFull = (todayWorkout?.focus ?? defaultFocus).toUpperCase();
  const focusShort = todayWorkout?.focus?.split(' - ')[0]?.trim() || defaultFocus;

  const { done, total } = weekProgress(schedule, todayJsDay);
  const ringProgress = total > 0 ? done / total : 0;

  const goalProgressPct = (() => {
    const start = firstBody?.weight_kg;
    const current = bodyData?.weight_kg;
    const target = goal?.target_weight_kg;
    if (start == null || current == null || target == null || start === target) return null;
    const pct = Math.round(((current - start) / (target - start)) * 100);
    return Math.min(Math.max(pct, 0), 100);
  })();

  const weightDelta = (() => {
    const first = firstBody?.weight_kg;
    const current = bodyData?.weight_kg;
    if (first == null || current == null || first === current) return null;
    const diff = current - first;
    return { arrow: diff <= 0 ? '↓' : '↑', value: Math.abs(diff).toFixed(1) };
  })();

  const mealPlanData = mealPlan?.meals as unknown as { days?: MealDay[] } | undefined;
  const todayMealDay = (mealPlanData?.days ?? []).find((d) => todayNames.includes(normalizeDayName(d.day_name)));
  const nextMeal = todayMealDay ? pickNextMeal(todayMealDay.meals) : undefined;

  const dateEyebrow = `${capitalize(formatDate(new Date(), { weekday: 'long' }))} · ${formatDate(new Date(), { day: 'numeric', month: 'short' })}`;

  const heroCta = !plan
    ? { label: t('empty.cta'), onPress: () => router.push('/(app)/plans/workout') }
    : isRestOrUnscheduled
      ? { label: t('hero.ctaRest'), onPress: () => router.push(`/(app)/plans/workout/${(plan as { id: string }).id}`) }
      : { label: t('hero.cta'), onPress: () => router.push(`/(app)/plans/workout/${(plan as { id: string }).id}`) };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
      {...navScroll}
    >
      {/* Section 0 — Fila superior: fecha + saludo + racha */}
      <StaggerIn index={0}>
        <View className="px-5 mb-4 flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Eyebrow color={colors.textMuted}>{dateEyebrow}</Eyebrow>
            <Text
              style={{
                fontFamily: 'BebasNeue-Regular',
                fontSize: typography.sizes.display,
                lineHeight: typography.sizes.display * 1.02,
                color: colors.text,
                letterSpacing: 1,
                marginTop: 4,
              }}
            >
              {t('greeting.title')}
            </Text>
            <Text
              style={{
                fontFamily: 'BebasNeue-Regular',
                fontSize: typography.sizes.display,
                lineHeight: typography.sizes.display * 1.02,
                color: colors.primaryText,
                letterSpacing: 1,
              }}
            >
              {(profile?.display_name ?? t('greeting.fallbackName')).toUpperCase()}
            </Text>
          </View>
          <StreakFlame streak={streak} compact />
        </View>
      </StaggerIn>

      {/* Section 1 — Hero: anillo semanal + estado del día */}
      <StaggerIn index={1}>
        <View className="px-5 mb-3">
          {loadingPlan ? (
            <Skeleton className="w-full" style={{ height: 340, borderRadius: 26 }} />
          ) : (
            <View
              style={{
                borderRadius: 26,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: 20,
                paddingTop: 22,
                paddingBottom: 20,
              }}
            >
              <LinearGradient
                colors={[hexToRgba(colors.primary, resolved === 'dark' ? 0.28 : 0.16), 'transparent']}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '55%',
                  borderTopLeftRadius: 26,
                  borderTopRightRadius: 26,
                }}
              />

              {plan && total > 0 && (
                <Eyebrow color={colors.textMuted} center>
                  {t('hero.weekEyebrow', { done, total })}
                </Eyebrow>
              )}

              <View style={{ alignSelf: 'center', marginTop: 6, marginBottom: 2 }}>
                <WeekRing progress={ringProgress} size={196}>
                  {!plan ? (
                    <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
                      <Text
                        style={{ fontFamily: 'BebasNeue-Regular', fontSize: 27, lineHeight: 28, color: colors.text, textAlign: 'center' }}
                      >
                        {t('hero.noPlanLine1')}
                        {'\n'}
                        {t('hero.noPlanLine2')}
                      </Text>
                    </View>
                  ) : isRestOrUnscheduled ? (
                    <View style={{ alignItems: 'center', paddingHorizontal: 12 }}>
                      <Text
                        style={{ fontFamily: 'BebasNeue-Regular', fontSize: 27, lineHeight: 28, color: colors.text, textAlign: 'center' }}
                      >
                        {t('hero.restLine1')}
                        {'\n'}
                        {t('hero.restLine2')}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center', paddingHorizontal: 8, gap: 2 }}>
                      <Eyebrow color={colors.primaryText} center>
                        {t('hero.dayEyebrow', { number: todayWorkout?.day_number ?? 1, focus: focusShort })}
                      </Eyebrow>
                      <Text
                        style={{ fontFamily: 'BebasNeue-Regular', fontSize: 27, lineHeight: 28, color: colors.text, textAlign: 'center' }}
                      >
                        {focusFull}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'JetBrainsMono-Medium',
                          fontSize: 10,
                          color: colors.textMuted,
                          letterSpacing: -0.2,
                          marginTop: 3,
                        }}
                      >
                        {t('hero.meta', { count: todayExercises.length, minutes: todayWorkout?.estimated_duration_minutes ?? 0 })}
                      </Text>
                    </View>
                  )}
                </WeekRing>
              </View>

              <TouchableOpacity activeOpacity={0.85} onPress={heroCta.onPress} style={[{ marginTop: 14 }, fireShadow]}>
                <LinearGradient
                  colors={gradients.ember}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 16,
                    paddingVertical: 15,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Ionicons name="barbell-outline" size={16} color={colors.onPrimary} />
                  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 14.5, letterSpacing: 0.6, color: colors.onPrimary }}>
                    {heroCta.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </StaggerIn>

      {/* Section 2 — Bento: peso actual + siguiente comida */}
      <StaggerIn index={2}>
        <View className="px-5 mb-3 flex-row gap-3">
          <Card className="flex-1">
            <Eyebrow color={colors.textMuted}>{t('bento.weightLabel')}</Eyebrow>
            <View className="flex-row items-baseline" style={{ marginTop: 7 }}>
              <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: typography.sizes.stat, color: colors.text }}>
                {bodyData?.weight_kg != null ? bodyData.weight_kg.toFixed(1) : '—'}
              </Text>
              {bodyData?.weight_kg != null && (
                <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 13, color: colors.textMuted }}> kg</Text>
              )}
            </View>
            {weightDelta && (
              <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11.5, color: colors.success, marginTop: 4 }}>
                {t('bento.weightDelta', weightDelta)}
              </Text>
            )}
          </Card>

          <Card className="flex-1">
            <Eyebrow color={colors.textMuted}>{t('bento.nextMealLabel')}</Eyebrow>
            {nextMeal ? (
              <>
                <Text
                  numberOfLines={2}
                  style={{ fontFamily: 'Inter-Medium', fontSize: 13.5, lineHeight: 18, color: colors.text, marginTop: 7 }}
                >
                  {nextMeal.name}
                </Text>
                <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                  {t('bento.mealMeta', { time: nextMeal.time_suggestion, kcal: nextMeal.calories })}
                </Text>
              </>
            ) : (
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(app)/plans/meal')} style={{ marginTop: 7 }}>
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.primaryText }}>{t('empty.cta')}</Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>
      </StaggerIn>

      {/* Section 3 — Vulcano te espera + stats de meta conservados */}
      <StaggerIn index={3}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/(app)/chat')} className="px-5 mb-3">
          <Card className="flex-row items-center gap-3">
            <VulcanoAvatar size={40} />
            <View className="flex-1">
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 13.5, color: colors.text }}>{t('vulcano.title')}</Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {t('vulcano.quote')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Card>
        </TouchableOpacity>

        <View className="px-5 flex-row gap-2.5">
          <StatCard value={goal?.target_weight_kg ?? '—'} decimals={1} suffix=" kg" label={t('stats.goal')} />
          <StatCard value={goalProgressPct ?? '—'} suffix="%" label={t('stats.progress')} />
        </View>
      </StaggerIn>
    </ScrollView>
  );
}
