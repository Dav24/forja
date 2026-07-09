import { Linking, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { SettingsGroup, SettingsRow } from '@/components/settings/SettingsRow';
import { colors } from '@/constants/colors';

export default function NotificationsScreen() {
  const { t } = useTranslation('settings');
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const reminders = profile?.notif_reminders ?? true;
  const updates = profile?.notif_updates ?? true;

  const switchProps = {
    trackColor: { false: colors.border, true: colors.primaryDim },
    thumbColor: colors.primary,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('notifications.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <SettingsGroup title={t('notifications.pushGroupTitle')}>
          <SettingsRow
            icon="barbell-outline"
            label={t('notifications.reminders')}
            rightElement={
              <Switch {...switchProps} value={reminders} onValueChange={(v) => updateProfile.mutate({ notif_reminders: v })} />
            }
          />
          <SettingsRow
            icon="trending-up-outline"
            label={t('notifications.updates')}
            rightElement={
              <Switch {...switchProps} value={updates} onValueChange={(v) => updateProfile.mutate({ notif_updates: v })} />
            }
          />
        </SettingsGroup>

        <Text className="px-1" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
          {t('notifications.systemOffNotice')}
        </Text>
        <TouchableOpacity onPress={() => Linking.openSettings()} className="mt-2 px-1">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.primary }}>{t('notifications.openSettings')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
