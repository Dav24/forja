import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { setAppLanguage, type AppLanguage } from '@/lib/i18n';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useTheme } from '@/lib/theme';

const OPTIONS: { value: AppLanguage; flag: string; labelKey: 'settings:language.spanish' | 'settings:language.english' }[] = [
  { value: 'es', flag: '🇲🇽', labelKey: 'settings:language.spanish' },
  { value: 'en', flag: '🇺🇸', labelKey: 'settings:language.english' },
];

export default function LanguageScreen() {
  const { t, i18n } = useTranslation('settings');
  const { colors } = useTheme();
  const updateProfile = useUpdateProfile();

  function selectLanguage(lang: AppLanguage) {
    if (lang === i18n.language) return;
    setAppLanguage(lang);
    updateProfile.mutate(
      { language: lang },
      { onError: () => Alert.alert(t('language.saveErrorTitle'), t('language.saveErrorBody')) }
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('language.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {OPTIONS.map((opt) => {
          const active = i18n.language === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => selectLanguage(opt.value)}
              activeOpacity={0.7}
              className={`rounded-2xl border px-4 py-3.5 flex-row items-center gap-3 ${active ? 'border-primary bg-primary-dim' : 'border-border bg-surface'}`}
            >
              <Text className="text-xl">{opt.flag}</Text>
              <Text className="flex-1" style={{ fontFamily: 'Inter-Medium', fontSize: 15, color: active ? colors.primary : colors.text }}>
                {t(opt.labelKey)}
              </Text>
              {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
            </TouchableOpacity>
          );
        })}
        <Text className="px-1 mt-2" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted, lineHeight: 18 }}>
          {t('language.aiNote')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
