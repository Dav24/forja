import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/theme';

export default function HealthHubScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('health.hubTitle')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 12 }}>
        <TouchableOpacity
          onPress={() => router.push('/(app)/settings/health/injuries' as never)}
          className="p-5 rounded-2xl border flex-row items-center gap-3"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Ionicons name="body-outline" size={22} color={colors.primary} />
          <View className="flex-1">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>{t('health.injuriesButtonTitle')}</Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{t('health.injuriesButtonSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(app)/settings/health/conditions' as never)}
          className="p-5 rounded-2xl border flex-row items-center gap-3"
          style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        >
          <Ionicons name="nutrition-outline" size={22} color={colors.accent} />
          <View className="flex-1">
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text }}>{t('health.conditionsButtonTitle')}</Text>
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{t('health.conditionsButtonSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
