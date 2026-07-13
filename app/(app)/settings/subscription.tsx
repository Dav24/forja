import { Linking, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth.store';
import { useIsPremium, useSubscription } from '@/hooks/useSubscription';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { buildPortalURL } from '@/lib/payments';
import { formatDate } from '@/lib/formatDate';
import { useTheme } from '@/lib/theme';

export default function SubscriptionScreen() {
  const { t } = useTranslation('settings');
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const isPremium = useIsPremium();
  const { data: subscription } = useSubscription();

  const periodEnd = subscription?.current_period_end
    ? formatDate(subscription.current_period_end, { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: 30, color: colors.text, letterSpacing: 1 }}>
          {t('subscription.title')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View className="bg-surface border border-border rounded-2xl p-4 items-center gap-3">
          {isPremium ? <Badge label={t('tier.premiumBadge')} variant="premium" /> : <Badge label={t('tier.freeBadge')} variant="muted" />}
          {isPremium && periodEnd ? (
            <Text style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
              {t('subscription.renewsOn', { date: periodEnd })}
            </Text>
          ) : (
            <Text className="text-center" style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
              {t('subscription.freeNotice')}
            </Text>
          )}
        </View>

        {isPremium ? (
          <Button
            label={t('subscription.manage')}
            variant="secondary"
            onPress={() => user && Linking.openURL(buildPortalURL(user.id))}
          />
        ) : (
          <Button label={t('subscription.becomeMaster')} onPress={() => router.push('/(app)/upgrade' as never)} />
        )}
        {isPremium ? (
          <Text className="text-center px-4" style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            {t('subscription.manageNotice')}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
