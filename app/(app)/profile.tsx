import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useProfile } from '@/hooks/useProfile';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { colors } from '@/constants/colors';

export default function ProfileScreen() {
  const { user } = useAuthStore();
  const { data: profile } = useProfile();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();

  const displayName =
    profile?.display_name ?? user?.email?.split('@')[0] ?? 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('es-MX', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 22, color: colors.text }}>
          Perfil
        </Text>
      </View>

      <Animated.View entering={FadeInUp.duration(250)} style={{ flex: 1, padding: 20, gap: 20 }}>
        {/* Avatar + name + plan badge */}
        <View style={{ alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primaryDim,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 28, color: colors.primary }}
            >
              {initial}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text
              style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}
            >
              {displayName}
            </Text>
            <Text
              style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.textMuted }}
            >
              {user?.email}
            </Text>
            {isPremium ? (
              <Badge label="PREMIUM" variant="premium" />
            ) : (
              <Badge label="FREE" variant="muted" />
            )}
          </View>
        </View>

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
              label="Hazte Premium"
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

      {/* Sign out */}
      <View style={{ padding: 20 }}>
        <Button variant="ghost" label="Cerrar sesión" onPress={handleSignOut} />
      </View>
    </SafeAreaView>
  );
}
