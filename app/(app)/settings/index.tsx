import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Application from 'expo-application';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useSubscription, useIsPremium } from '@/hooks/useSubscription';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/config';
import { useTheme } from '@/lib/theme';
import type { ThemePref } from '@/constants/themes';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation('settings');
  const { colors } = useTheme();
  const isPremium = useIsPremium();
  useSubscription(); // precalienta la query para la subpantalla

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        {/* Ajustes siempre se entra desde Perfil; back explícito para no depender
            del historial del TabRouter (back() caía al primer tab = inicio) */}
        <TouchableOpacity onPress={() => router.navigate('/(app)/profile' as never)} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('hub.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <SettingsGroup title={t('hub.groupAccount')}>
          <SettingsRow icon="person-outline" label={t('hub.rowAccount')} onPress={() => router.push('/(app)/settings/account' as never)} />
          <SettingsRow icon="barbell-outline" label={t('hub.rowTraining')} onPress={() => router.push('/(app)/settings/training' as never)} />
        </SettingsGroup>

        <SettingsGroup title={t('hub.groupPreferences')}>
          <SettingsRow icon="notifications-outline" label={t('hub.rowNotifications')} onPress={() => router.push('/(app)/settings/notifications' as never)} />
          <SettingsRow
            icon="globe-outline"
            label={t('hub.rowLanguage')}
            value={i18n.language === 'es' ? t('language.spanish') : t('language.english')}
            onPress={() => router.push('/(app)/settings/language' as never)}
          />
          <View className="px-4 py-3.5 bg-surface">
            <Text className="mb-2.5" style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: colors.text }}>
              {t('hub.rowAppearance')}
            </Text>
            <ThemeSegment />
          </View>
        </SettingsGroup>

        <SettingsGroup title={t('hub.groupSubscription')}>
          <SettingsRow
            icon="diamond-outline"
            label={t('hub.rowSubscription')}
            value={isPremium ? t('tier.premium') : t('tier.free')}
            onPress={() => router.push('/(app)/settings/subscription' as never)}
          />
        </SettingsGroup>

        {(PRIVACY_URL || TERMS_URL) ? (
          <SettingsGroup title={t('hub.groupLegal')}>
            {PRIVACY_URL ? (
              <SettingsRow icon="shield-checkmark-outline" label={t('hub.rowPrivacy')} onPress={() => Linking.openURL(PRIVACY_URL)} />
            ) : null}
            {TERMS_URL ? (
              <SettingsRow icon="document-text-outline" label={t('hub.rowTerms')} onPress={() => Linking.openURL(TERMS_URL)} />
            ) : null}
          </SettingsGroup>
        ) : null}

        <SettingsGroup title={t('hub.groupSupport')}>
          <SettingsRow
            icon="mail-outline"
            label={t('hub.rowSupport')}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Soporte%20Forja`)}
          />
        </SettingsGroup>

        <SettingsGroup>
          <SettingsRow icon="log-out-outline" label={t('hub.signOut')} danger onPress={() => supabase.auth.signOut()} />
        </SettingsGroup>

        <Text className="text-center mt-2" style={{ fontFamily: 'JetBrainsMono-Regular', fontSize: 12, color: colors.textMuted }}>
          {t('hub.version', {
            version: Application.nativeApplicationVersion ?? '?',
            build: Application.nativeBuildVersion ?? '?',
          })}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ThemeSegment() {
  const { t } = useTranslation('settings');
  const { colors, pref, setPref } = useTheme();
  const options: { key: ThemePref; label: string }[] = [
    { key: 'light', label: t('appearance.light') },
    { key: 'system', label: t('appearance.system') },
    { key: 'dark', label: t('appearance.dark') },
  ];
  return (
    <View
      className="flex-row"
      style={{ backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 3, gap: 3 }}
    >
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          onPress={() => setPref(o.key)}
          activeOpacity={0.7}
          style={{
            flex: 1,
            paddingVertical: 8,
            borderRadius: 9,
            alignItems: 'center',
            backgroundColor: pref === o.key ? colors.surfaceElevated : 'transparent',
          }}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 12.5, color: pref === o.key ? colors.text : colors.textMuted }}>
            {o.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
