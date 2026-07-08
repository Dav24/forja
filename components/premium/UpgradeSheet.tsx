import { forwardRef } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { colors } from '@/constants/colors';
import { useAuthStore } from '@/store/auth.store';
import { buildPaymentURL } from '@/lib/payments';

export type UpgradeContext = 'chart_range' | 'body_composition' | 'meal_plan' | 'generic';

interface UpgradeSheetProps {
  context?: UpgradeContext;
}

const COPY: Record<UpgradeContext, { titleKey: string; bulletKeys: string[] }> = {
  chart_range: {
    titleKey: 'upgrade.sheet.chartRange.title',
    bulletKeys: [
      'upgrade.sheet.chartRange.bullets.0',
      'upgrade.sheet.chartRange.bullets.1',
      'upgrade.sheet.chartRange.bullets.2',
    ],
  },
  body_composition: {
    titleKey: 'upgrade.sheet.bodyComposition.title',
    bulletKeys: [
      'upgrade.sheet.bodyComposition.bullets.0',
      'upgrade.sheet.bodyComposition.bullets.1',
      'upgrade.sheet.bodyComposition.bullets.2',
    ],
  },
  meal_plan: {
    titleKey: 'upgrade.sheet.mealPlan.title',
    bulletKeys: [
      'upgrade.sheet.mealPlan.bullets.0',
      'upgrade.sheet.mealPlan.bullets.1',
      'upgrade.sheet.mealPlan.bullets.2',
    ],
  },
  generic: {
    titleKey: 'upgrade.sheet.generic.title',
    bulletKeys: [
      'upgrade.sheet.generic.bullets.0',
      'upgrade.sheet.generic.bullets.1',
      'upgrade.sheet.generic.bullets.2',
    ],
  },
};

export const UpgradeSheet = forwardRef<BottomSheet, UpgradeSheetProps>(
  function UpgradeSheet({ context = 'generic' }, ref) {
    const { t } = useTranslation('plans');
    const { titleKey, bulletKeys } = COPY[context];
    const userId = useAuthStore((s) => s.user?.id);

    function handleUpgrade() {
      if (userId) Linking.openURL(buildPaymentURL(userId, 'yearly'));
    }

    function handleSeeAll() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ref as any)?.current?.close?.();
      router.push('/(app)/upgrade' as never);
    }

    return (
      <Sheet ref={ref} snapPoints={['60%']}>
        <View className="gap-4">
          <View className="flex-row items-center gap-[10px]">
            <Ionicons name="lock-closed" size={22} color={colors.accent} />
            <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text }}>
              {t(titleKey)}
            </Text>
          </View>

          <View className="gap-[10px]">
            {bulletKeys.map((bulletKey, i) => (
              <View key={i} className="flex-row items-center gap-[10px]">
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text className="flex-1" style={{ fontFamily: 'Inter-Regular', fontSize: 14, color: colors.text }}>
                  {t(bulletKey)}
                </Text>
              </View>
            ))}
          </View>

          <Text className="text-center" style={{ fontFamily: 'Inter-Regular', fontSize: 13, color: colors.textMuted }}>
            {t('upgrade.sheet.fromPrice')}
          </Text>

          <Button label={t('upgrade.sheet.cta')} onPress={handleUpgrade} />

          <TouchableOpacity onPress={handleSeeAll} activeOpacity={0.7} className="items-center">
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: 13, color: colors.accent }}>
              {t('upgrade.sheet.seeAll')}
            </Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    );
  },
);
