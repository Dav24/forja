import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Application from 'expo-application';
import { supabase } from '@/lib/supabase';
import { useSubscription, useIsPremium } from '@/hooks/useSubscription';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config';
import { colors } from '@/constants/colors';

export default function SettingsScreen() {
  const isPremium = useIsPremium();
  useSubscription(); // precalienta la query para la subpantalla

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          Ajustes
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <SettingsGroup title="Cuenta">
          <SettingsRow icon="person-outline" label="Cuenta" onPress={() => router.push('/(app)/settings/account' as never)} />
          <SettingsRow icon="barbell-outline" label="Mi entrenamiento" onPress={() => router.push('/(app)/settings/training' as never)} />
        </SettingsGroup>

        <SettingsGroup title="Preferencias">
          <SettingsRow icon="notifications-outline" label="Notificaciones" onPress={() => router.push('/(app)/settings/notifications' as never)} />
          <SettingsRow icon="globe-outline" label="Idioma" value="Español" onPress={() => router.push('/(app)/settings/language' as never)} />
        </SettingsGroup>

        <SettingsGroup title="Suscripción">
          <SettingsRow
            icon="diamond-outline"
            label="Suscripción"
            value={isPremium ? 'Maestro Forjador' : 'Aprendiz'}
            onPress={() => router.push('/(app)/settings/subscription' as never)}
          />
        </SettingsGroup>

        {(PRIVACY_URL || TERMS_URL) ? (
          <SettingsGroup title="Legal">
            {PRIVACY_URL ? (
              <SettingsRow icon="shield-checkmark-outline" label="Política de privacidad" onPress={() => Linking.openURL(PRIVACY_URL)} />
            ) : null}
            {TERMS_URL ? (
              <SettingsRow icon="document-text-outline" label="Términos y condiciones" onPress={() => Linking.openURL(TERMS_URL)} />
            ) : null}
          </SettingsGroup>
        ) : null}

        <SettingsGroup title="Soporte">
          <SettingsRow
            icon="mail-outline"
            label="Contactar soporte"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Soporte%20Forja`)}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon="log-out-outline" label="Cerrar sesión" danger onPress={() => supabase.auth.signOut()} />
        </SettingsGroup>

        <Text className="text-center mt-2" style={{ fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: colors.textMuted }}>
          Forja v{Application.nativeApplicationVersion ?? '?'} ({Application.nativeBuildVersion ?? '?'})
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
