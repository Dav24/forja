import { useState } from 'react';
import { Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { useOnboardingStore } from '@/store/onboarding.store';
import { useProfileStore } from '@/store/profile.store';
import { SparkBurst } from '@/components/effects/SparkBurst';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { ATHLETIC_BACKGROUNDS, SUPPLEMENTS, type AthleticBackground, type SupplementCode } from '@/constants/goals';
import { Input } from '@/components/ui/Input';

export default function Step5Athletic() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [background, setBackground] = useState<AthleticBackground | null>(null);
  const [supplements, setSupplements] = useState<SupplementCode[]>([]);
  const [supplementsOther, setSupplementsOther] = useState('');
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const { user } = useAuthStore();
  const { goalId, reset } = useOnboardingStore();
  const { setOnboardingCompleted } = useProfileStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function toggleSupplement(value: SupplementCode) {
    setSupplements((prev) => {
      if (value === 'none') return prev.includes('none') ? [] : ['none'];
      const without = prev.filter((s) => s !== 'none');
      return without.includes(value) ? without.filter((s) => s !== value) : [...without, value];
    });
  }

  async function finishOnboarding() {
    const { error } = await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user!.id);
    if (error) throw error;
    setCelebrating(true);
  }

  async function handleFinish() {
    if (!user) return;
    setLoading(true);
    try {
      if (goalId && background) {
        const { error: goalError } = await supabase.from('goals').update({ athletic_background: background }).eq('id', goalId);
        if (goalError) throw goalError;
      }
      const supplementsOtherTrimmed = supplementsOther.trim().slice(0, 200).replace(/[^\w\s,áéíóúñü.]/gi, '');
      if (supplements.length > 0) {
        const { error: profileError } = await supabase.from('profiles').update({
          supplements,
          supplements_other: supplementsOtherTrimmed || null,
        }).eq('id', user.id);
        if (profileError) throw profileError;
      }
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step5.errors.unknown');
      Alert.alert(t('step5.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await finishOnboarding();
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : t('step5.errors.unknown');
      Alert.alert(t('step5.errors.saveFailed.title'), message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('step5.eyebrow')}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step5.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step5.subtitle')}
          </Text>
        </View>

        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step5.backgroundQuestion')}
        </Text>
        <View className="gap-2 mb-8">
          {ATHLETIC_BACKGROUNDS.map((b) => {
            const isSelected = background === b.value;
            return (
              <TouchableOpacity
                key={b.value}
                onPress={() => setBackground(b.value)}
                className={`p-4 rounded-xl border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                  {t(b.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
          {t('step5.supplementsQuestion')}
        </Text>
        <View className="flex-row flex-wrap gap-2 mb-3">
          {SUPPLEMENTS.map((s) => {
            const isSelected = supplements.includes(s.value);
            return (
              <TouchableOpacity
                key={s.value}
                onPress={() => toggleSupplement(s.value)}
                className={`rounded-full px-4 py-2 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                  {t(s.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!supplements.includes('none') ? (
          <Input
            placeholder={t('step5.otherPlaceholder')}
            value={supplementsOther}
            onChangeText={setSupplementsOther}
          />
        ) : null}

        <View className="mt-6 p-3 rounded-xl border" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: 12, color: colors.textMuted }}>
            {t('step5.safetyNote')}
          </Text>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border gap-2"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className="rounded-xl h-14 items-center justify-center bg-primary"
          onPress={handleFinish}
          disabled={loading || celebrating}
        >
          {loading ? <ActivityIndicator color={colors.background} /> : (
            <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.background }}>
              {t('step5.finishButton')}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip} disabled={loading || celebrating} className="items-center py-2">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: colors.textMuted }}>
            {t('step5.skipButton')}
          </Text>
        </TouchableOpacity>
      </View>

      <SparkBurst
        trigger={celebrating}
        onDone={() => {
          setOnboardingCompleted(true);
          reset();
          router.replace('/(app)');
        }}
      />
    </View>
  );
}
