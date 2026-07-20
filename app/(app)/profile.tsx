import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { useProfile, useActiveGoal } from '@/hooks/useProfile';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { useStreak } from '@/hooks/useStreak';
import { useLatestBodyData, useFirstBodyData } from '@/hooks/useBodyTracking';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { useCreditBalance } from '@/hooks/useCreditBalance';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { StaggerIn } from '@/components/ui/StaggerIn';
import { StreakFlame } from '@/components/home/StreakFlame';
import { MODALITIES } from '@/constants/modalities';
import { GOALS } from '@/constants/goals';
import { gradientsByTheme, fireShadowByTheme } from '@/constants/themes';
import { useTheme } from '@/lib/theme';
import { useHideNavOnScroll } from '@/lib/scrollNav';
import { formatDate } from '@/lib/formatDate';

function daysInForja(createdAt: string | undefined): number {
  if (!createdAt) return 0;
  return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export default function ProfileScreen() {
  const { t } = useTranslation(['profile']);
  const { colors, resolved } = useTheme();
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const { data: goal } = useActiveGoal();
  const { data: stats } = useProfileStats();
  const { data: streak } = useStreak();
  const { data: latestBody } = useLatestBodyData();
  const { data: firstBody } = useFirstBodyData();
  const { pickAndUpload, uploading, error: avatarError, permissionDenied } = useAvatarUpload();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();
  const { data: creditBalance } = useCreditBalance();
  const navScroll = useHideNavOnScroll();

  const gradients = gradientsByTheme[resolved];
  const fireShadow = fireShadowByTheme[resolved];

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? t('fallbackName');
  const initial = displayName.charAt(0).toUpperCase();
  const goalMeta = GOALS.find((g) => g.type === goal?.type);
  const modalityIds = goal ? [goal.modality, ...(goal.secondary_modalities ?? [])].filter(Boolean) : [];

  // Título de forjador: premium siempre gana; si no, el nivel del goal activo con fallback a "casual"
  const forgerTitle = isPremium
    ? t('forgerTitle.premium')
    : t(`forgerTitle.${goal?.fitness_level}`, { defaultValue: t('forgerTitle.casual') });

  const periodEnd = subscription?.current_period_end
    ? formatDate(subscription.current_period_end, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const memberSinceLabel = profile?.created_at
    ? t('memberSince', { date: formatDate(profile.created_at, { month: 'long', year: 'numeric' }) })
    : null;

  // Progreso del objetivo activo — mismo criterio que components/progress/GoalProgress.tsx
  // (solo goals de peso con meta y al menos 2 mediciones)
  const showWeightProgress =
    goal != null &&
    (goal.type === 'weight_loss' || goal.type === 'muscle_gain') &&
    goal.target_weight_kg != null &&
    firstBody?.weight_kg != null &&
    latestBody?.weight_kg != null;

  let goalProgressPct = 0;
  if (showWeightProgress) {
    const startWeight = firstBody!.weight_kg as number;
    const currentWeight = latestBody!.weight_kg as number;
    const targetWeight = goal!.target_weight_kg as number;
    const totalChange = Math.abs(startWeight - targetWeight);
    const signedChange =
      goal!.type === 'weight_loss' ? startWeight - currentWeight : currentWeight - startWeight;
    goalProgressPct = totalChange > 0 ? Math.min(Math.max((signedChange / totalChange) * 100, 0), 100) : 0;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header con engrane */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('title')}
        </Text>
        <TouchableOpacity onPress={() => router.push('/(app)/settings' as never)} hitSlop={12}>
          <Ionicons name="settings-outline" size={24} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 120 }} {...navScroll}>
        <StaggerIn index={0}>
        <View style={{ gap: 20 }}>
          {/* Identidad */}
          <View className="items-center gap-3">
            <TouchableOpacity onPress={pickAndUpload} disabled={uploading} activeOpacity={0.8}>
              <View style={[{ width: 64, height: 64, borderRadius: 22, overflow: 'hidden' }, fireShadow]}>
                {uploading ? (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surfaceElevated,
                    }}
                  >
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : profile?.avatar_url ? (
                  // Foto de usuario: se conserva tal cual, solo con el marco nuevo (64/22/fireShadow)
                  <Image source={{ uri: profile.avatar_url }} style={{ width: 64, height: 64 }} contentFit="cover" />
                ) : (
                  // Fallback sin foto: gradiente ember + inicial Bebas
                  <LinearGradient
                    colors={gradients.ember}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 32, color: colors.onPrimary }}>
                      {initial}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <View
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera" size={13} color={colors.primary} />
              </View>
            </TouchableOpacity>
            {permissionDenied ? (
              <View className="items-center gap-1">
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.warning }}>
                  {t('avatar.permissionDenied')}
                </Text>
                <TouchableOpacity onPress={() => Linking.openSettings()}>
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.primary }}>
                    {t('avatar.openSettings')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {avatarError ? (
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.destructive }}>{avatarError}</Text>
            ) : null}
            <View className="items-center gap-1">
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 19, color: colors.text }}>{displayName}</Text>
              <Text
                style={{
                  fontFamily: 'SpaceGrotesk-Bold',
                  fontSize: 11,
                  letterSpacing: 2.2,
                  textTransform: 'uppercase',
                  color: colors.accentText,
                  marginTop: 2,
                }}
              >
                {forgerTitle}
              </Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                {user?.email}
              </Text>
              {isPremium ? <Badge label={t('premiumBadge')} variant="premium" /> : <Badge label={t('freeBadge')} variant="muted" />}
              {!isPremium && creditBalance ? (
                <Badge label={t('creditsBadge', { count: creditBalance })} variant="muted" />
              ) : null}
              {memberSinceLabel ? (
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
                  {memberSinceLabel}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Racha */}
          <View className="items-center">
            <StreakFlame streak={streak ?? 0} />
          </View>
        </View>
        </StaggerIn>

        {/* Stats */}
        <StaggerIn index={1}>
          <View className="flex-row gap-3">
            <StatCard value={stats?.plansGenerated ?? 0} label={t('stats.plans')} />
            <StatCard value={stats?.bodyRecords ?? 0} label={t('stats.records')} />
            <StatCard value={daysInForja(profile?.created_at)} label={t('stats.daysInForja')} />
          </View>
        </StaggerIn>

        {/* Objetivo activo */}
        <StaggerIn index={2}>
          {goal && goalMeta ? (
            <TouchableOpacity
              onPress={() => router.push('/(app)/settings/training' as never)}
              activeOpacity={0.7}
              className="bg-surface border border-border rounded-2xl p-4"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  style={{
                    fontFamily: 'SpaceGrotesk-Bold',
                    fontSize: 11,
                    letterSpacing: 2.2,
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                  }}
                >
                  {t('goal.activeEyebrow')}
                </Text>
                {goal.target_weight_kg != null ? (
                  <Text style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 11.5, color: colors.textMuted }}>
                    {t('goal.targetMeta', { value: goal.target_weight_kg.toFixed(1) })}
                  </Text>
                ) : null}
              </View>

              <Text
                style={{ fontFamily: 'Inter-Medium', fontSize: 14.5, color: colors.text, marginTop: 7 }}
              >
                {t(goalMeta.titleKey)} — {t(goalMeta.descriptionKey)}
              </Text>

              {showWeightProgress ? (
                <>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 99,
                      backgroundColor: colors.chip,
                      overflow: 'hidden',
                      marginTop: 10,
                    }}
                  >
                    <LinearGradient
                      colors={gradients.ember}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ width: `${goalProgressPct}%`, height: '100%', borderRadius: 99 }}
                    />
                  </View>
                  <Text
                    style={{ fontFamily: 'JetBrainsMono-Medium', fontSize: 10.5, color: colors.textFaint, marginTop: 7 }}
                  >
                    {t('goal.progressCaption', { pct: goalProgressPct.toFixed(0) })}
                  </Text>
                </>
              ) : null}

              {modalityIds.length > 0 ? (
                <View className="flex-row flex-wrap gap-2 mt-3">
                  {modalityIds.map((id) => {
                    const m = MODALITIES.find((mod) => mod.id === id);
                    if (!m) return null;
                    return (
                      <View
                        key={id}
                        className="bg-primary-dim rounded-full px-3 py-1"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
                      >
                        <Ionicons name={m.iconName} size={12} color={colors.primary} />
                        <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.primary }}>
                          {t(m.labelKey)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.push('/(app)/settings/training' as never)}
              activeOpacity={0.7}
              className="bg-surface border border-border rounded-2xl p-4 flex-row items-center gap-3"
            >
              <Text className="text-xl">🎯</Text>
              <Text className="flex-1" style={{ fontFamily: 'Inter-Medium', fontSize: 14, color: colors.text }}>
                {t('goal.defineCta')}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </StaggerIn>

        {/* Upgrade card — free users only, o Renewal info — premium users only */}
        <StaggerIn index={3}>
          {!isPremium && (
            <TouchableOpacity onPress={() => router.push('/(app)/upgrade' as never)} activeOpacity={0.85}>
              <View style={{ borderRadius: 16, overflow: 'hidden', padding: 17 }}>
                {/* Siempre oscuro en ambos temas — decisión del prototipo v7 */}
                <LinearGradient
                  colors={['#1B120A', '#2A1A0E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <LinearGradient
                  colors={['rgba(251,191,36,0.25)', 'rgba(251,191,36,0)']}
                  start={{ x: 1, y: 0 }}
                  end={{ x: 0.3, y: 0.7 }}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                />
                <Text
                  style={{
                    fontFamily: 'SpaceGrotesk-Bold',
                    fontSize: 11,
                    letterSpacing: 2.2,
                    textTransform: 'uppercase',
                    color: '#C9B8A8',
                  }}
                >
                  {t('upgrade.eyebrow')}
                </Text>
                <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 24, color: '#FAF7F2', marginTop: 6 }}>
                  {t('premiumBadge')}
                </Text>
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12.5, color: '#FAF7F2', opacity: 0.75, marginTop: 5 }}>
                  {t('upgrade.description')}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Renewal info — premium users only */}
          {isPremium && periodEnd && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              <Text
                style={{
                  fontFamily: 'Inter-Regular',
                  fontSize: 13,
                  color: colors.textMuted,
                  flex: 1,
                }}
              >
                {t('renewal', { date: periodEnd })}
              </Text>
            </View>
          )}
        </StaggerIn>
      </ScrollView>
    </SafeAreaView>
  );
}
