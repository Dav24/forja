import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';

export default function SuccessScreen() {
  const { t } = useTranslation('plans');
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['subscription'] });
    setBurst(true);
  }, [queryClient]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <SparkBurst trigger={burst} onDone={() => setBurst(false)} />
        <Text
          style={{
            fontFamily: 'BebasNeue-Regular',
            fontSize: 40,
            color: colors.text,
            letterSpacing: 1,
            textAlign: 'center',
          }}
        >
          {t('success.title')}
        </Text>
        <Text
          style={{
            fontFamily: 'Inter-Regular',
            fontSize: 16,
            color: colors.textMuted,
            textAlign: 'center',
          }}
        >
          {t('success.subtitle')}
        </Text>
        <Button label={t('success.cta')} onPress={() => router.replace('/(app)')} />
      </View>
    </SafeAreaView>
  );
}
