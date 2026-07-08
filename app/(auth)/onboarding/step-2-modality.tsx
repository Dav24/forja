import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/store/onboarding.store';
import { MODALITIES, type ModalityId } from '@/constants/modalities';
import { Input } from '@/components/ui/Input';

export default function Step2Modality() {
  const { t } = useTranslation('onboarding');
  const [principal, setPrincipal] = useState<ModalityId | null>(null);
  const [secondary, setSecondary] = useState<ModalityId[]>([]);
  const [sportType, setSportType] = useState('');
  const { setStep2Modality } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const needsSport = principal === 'ball_sports' || secondary.includes('ball_sports');

  function selectPrincipal(id: ModalityId) {
    setPrincipal(id);
    setSecondary((prev) => prev.filter((s) => s !== id));
  }

  function toggleSecondary(id: ModalityId) {
    setSecondary((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function handleContinue() {
    if (!principal) return;
    setStep2Modality({
      modality: principal,
      secondaryModalities: secondary,
      sportType: needsSport && sportType.trim() ? sportType.trim() : null,
    });
    router.push('/(auth)/onboarding/step-3-body');
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 pb-8">
          <Text className="text-text-muted text-sm font-medium mb-1">{t('layout.stepOf', { current: 2, total: 4 })}</Text>
          <Text className="text-text font-bold text-3xl">{t('step2.title')}</Text>
          <Text className="text-text-muted text-base mt-2">{t('step2.subtitle')}</Text>
        </View>

        <View className="gap-3">
          {MODALITIES.map((m) => {
            const isSelected = principal === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => selectPrincipal(m.id)}
                className={`rounded-2xl p-4 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <Text className="text-3xl">{m.icon}</Text>
                  <View className="flex-1">
                    <Text className={`font-semibold text-base ${isSelected ? 'text-primary' : 'text-text'}`}>
                      {t(m.labelKey)}
                    </Text>
                    <Text className="text-text-muted text-sm mt-0.5">{t(m.descriptionKey)}</Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Text className="text-background font-bold text-xs">✓</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {principal && (
          <View className="mt-8">
            <Text className="text-text font-semibold text-lg">{t('step2.secondaryTitle')}</Text>
            <Text className="text-text-muted text-sm mt-1 mb-3">{t('step2.secondarySubtitle')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {MODALITIES.filter((m) => m.id !== principal).map((m) => {
                const on = secondary.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => toggleSecondary(m.id)}
                    className={`rounded-full px-4 py-2 border ${on ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-sm ${on ? 'text-primary' : 'text-text'}`}>
                      {m.icon} {t(m.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {needsSport && (
          <View className="mt-6">
            <Text className="text-text font-semibold text-base mb-2">{t('step2.sportLabel')}</Text>
            <Input placeholder={t('step2.sportPlaceholder')} value={sportType} onChangeText={setSportType} />
          </View>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${principal ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleContinue}
          disabled={!principal}
        >
          <Text className={`font-bold text-base ${principal ? 'text-background' : 'text-text-muted'}`}>
            {t('layout.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
