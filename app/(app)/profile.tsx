import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { useProfile, useActiveGoal } from '@/hooks/useProfile';
import { useProfileStats } from '@/hooks/useProfileStats';
import { useAvatarUpload } from '@/hooks/useAvatarUpload';
import { useStreak } from '@/hooks/useStreak';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { StreakFlame } from '@/components/home/StreakFlame';
import { MODALITIES } from '@/constants/modalities';
import { GOALS, FITNESS_LEVELS } from '@/constants/goals';
import { useTheme } from '@/lib/theme';
import { formatDate } from '@/lib/formatDate';

function daysInForja(createdAt: string | undefined): number {
  if (!createdAt) return 0;
  return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export default function ProfileScreen() {
  const { t } = useTranslation(['profile']);
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const { data: goal } = useActiveGoal();
  const { data: stats } = useProfileStats();
  const { data: streak } = useStreak();
  const { pickAndUpload, uploading, error: avatarError, permissionDenied } = useAvatarUpload();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? t('fallbackName');
  const initial = displayName.charAt(0).toUpperCase();
  const goalMeta = GOALS.find((g) => g.type === goal?.type);
  const levelMeta = FITNESS_LEVELS.find((l) => l.value === goal?.fitness_level);
  const modalityIds = goal ? [goal.modality, ...(goal.secondary_modalities ?? [])].filter(Boolean) : [];

  const periodEnd = subscription?.current_period_end
    ? formatDate(subscription.current_period_end, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const memberSinceLabel = profile?.created_at
    ? t('memberSince', { date: formatDate(profile.created_at, { month: 'long', year: 'numeric' }) })
    : null;

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

      <ScrollView contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 40 }}>
        <Animated.View entering={FadeInUp.duration(250)} style={{ gap: 20 }}>
          {/* Identidad */}
          <View className="items-center gap-3">
            <TouchableOpacity onPress={pickAndUpload} disabled={uploading} activeOpacity={0.8}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: colors.primaryDim,
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={{ width: 96, height: 96 }} contentFit="cover" />
                ) : (
                  <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 36, color: colors.primary }}>{initial}</Text>
                )}
              </View>
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: colors.surfaceElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera" size={15} color={colors.primary} />
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
            <View className="items-center gap-1.5">
              <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>{displayName}</Text>
              <Text style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}>{user?.email}</Text>
              {isPremium ? <Badge label={t('premiumBadge')} variant="premium" /> : <Badge label={t('freeBadge')} variant="muted" />}
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

          {/* Stats */}
          <View className="flex-row gap-3">
            <StatCard value={stats?.plansGenerated ?? 0} label={t('stats.plans')} />
            <StatCard value={stats?.bodyRecords ?? 0} label={t('stats.records')} />
            <StatCard value={daysInForja(profile?.created_at)} label={t('stats.daysInForja')} />
          </View>

          {/* Objetivo activo */}
          {goal && goalMeta ? (
            <TouchableOpacity
              onPress={() => router.push('/(app)/settings/training' as never)}
              activeOpacity={0.7}
              className="bg-surface border border-border rounded-2xl p-4 gap-2"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-xl">{goalMeta.icon}</Text>
                <Text className="flex-1" style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>
                  {t(goalMeta.titleKey)}
                  {levelMeta ? ` · ${t(levelMeta.labelKey)}` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
              <View className="flex-row flex-wrap gap-2">
                {modalityIds.map((id) => {
                  const m = MODALITIES.find((mod) => mod.id === id);
                  if (!m) return null;
                  return (
                    <View key={id} className="bg-primary-dim rounded-full px-3 py-1">
                      <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12, color: colors.primary }}>
                        {m.icon} {t(m.labelKey)}
                      </Text>
                    </View>
                  );
                })}
              </View>
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

          {/* Upgrade card — free users only */}
          {!isPremium && (
            <View
              style={{
                backgroundColor: colors.accent + '15',
                borderWidth: 1,
                borderColor: colors.accent + '40',
                borderRadius: 16,
                padding: 16,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="flash" size={22} color={colors.accent} />
                <Text
                  style={{
                    fontFamily: 'SpaceGrotesk-Bold',
                    fontSize: 16,
                    color: colors.text,
                    flex: 1,
                  }}
                >
                  {t('upgrade.title')}
                </Text>
              </View>
              <Text
                style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}
              >
                {t('upgrade.description')}
              </Text>
              <Button
                label={t('upgrade.cta')}
                onPress={() => router.push('/(app)/upgrade' as never)}
              />
            </View>
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
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
