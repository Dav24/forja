import { ActivityIndicator, Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
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
import { colors } from '@/constants/colors';

function memberSince(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return `Forjador desde ${label}`;
}

function daysInForja(createdAt: string | undefined): number {
  if (!createdAt) return 0;
  return Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
}

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const { data: goal } = useActiveGoal();
  const { data: stats } = useProfileStats();
  const { data: streak } = useStreak();
  const { pickAndUpload, uploading, error: avatarError, permissionDenied } = useAvatarUpload();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();

  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();
  const goalMeta = GOALS.find((g) => g.type === goal?.type);
  const levelMeta = FITNESS_LEVELS.find((l) => l.value === goal?.fitness_level);
  const modalityIds = goal ? [goal.modality, ...(goal.secondary_modalities ?? [])].filter(Boolean) : [];

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header con engrane */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Perfil
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
                  Permiso denegado. Actívalo en los ajustes del teléfono.
                </Text>
                <TouchableOpacity onPress={() => Linking.openSettings()}>
                  <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.primary }}>
                    Abrir ajustes del teléfono
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
              {isPremium ? <Badge label="MAESTRO FORJADOR" variant="premium" /> : <Badge label="APRENDIZ" variant="muted" />}
              {memberSince(profile?.created_at) ? (
                <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
                  {memberSince(profile?.created_at)}
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
            <StatCard value={stats?.plansGenerated ?? 0} label="Planes" />
            <StatCard value={stats?.bodyRecords ?? 0} label="Registros" />
            <StatCard value={daysInForja(profile?.created_at)} label="Días en Forja" />
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
                  {goalMeta.title}
                  {levelMeta ? ` · ${levelMeta.label}` : ''}
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
                        {m.icon} {m.label}
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
                Define tu objetivo
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
                  Desbloquea todo el potencial de Vulcano
                </Text>
              </View>
              <Text
                style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}
              >
                Chat ilimitado, planes sin restricciones y seguimiento completo de tu cuerpo.
              </Text>
              <Button
                label="Hazte Maestro"
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
                Tu suscripción se renueva el {periodEnd}
              </Text>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
