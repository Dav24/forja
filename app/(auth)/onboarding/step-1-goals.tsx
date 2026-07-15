import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/store/onboarding.store';
import { VulcanoAvatar } from '@/components/chat/VulcanoAvatar';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';
import { GOALS, type GoalType } from '@/constants/goals';
import { TargetWeightPicker } from '@/components/goals/TargetWeightPicker';

export default function Step1Goals() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [selected, setSelected] = useState<GoalType | null>(null);
  const [targetWeightInput, setTargetWeightInput] = useState('');
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const showsWeightTarget = selected === 'weight_loss' || selected === 'muscle_gain';
  const { setStep1 } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleContinue() {
    if (!selected) return;
    const parsedTarget = showsWeightTarget && targetWeightInput.trim()
      ? Number(targetWeightInput.trim().replace(',', '.'))
      : null;
    setStep1({
      goalType: selected,
      targetWeightKg: parsedTarget !== null && Number.isFinite(parsedTarget) ? parsedTarget : null,
      targetDate: showsWeightTarget ? targetDate : null,
    });
    router.push('/(auth)/onboarding/step-2-modality');
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-6 items-center mb-6">
          <VulcanoAvatar size={72} />
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 20, color: colors.text, textAlign: 'center', marginTop: 12 }}>
            {t('step1.vulcanoTitle')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.bodySmall, color: colors.textMuted, textAlign: 'center', marginTop: 4 }}>
            {t('step1.vulcanoSubtitle')}
          </Text>
        </View>

        <View className="pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 1, total: 5 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step1.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step1.subtitle')}
          </Text>
        </View>

        <View className="gap-3">
          {GOALS.map((goal) => {
            const isSelected = selected === goal.type;
            return (
              <TouchableOpacity
                key={goal.type}
                onPress={() => setSelected(goal.type)}
                className={`rounded-2xl p-4 border ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center gap-4">
                  <View style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name={goal.iconName} size={22} color={isSelected ? colors.background : colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: isSelected ? colors.primary : colors.text }}>
                      {t(goal.titleKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                      {t(goal.descriptionKey)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-6 h-6 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={14} color={colors.background} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {showsWeightTarget && (
          <View className="mt-6">
            <TargetWeightPicker
              weightValue={targetWeightInput}
              onChangeWeight={setTargetWeightInput}
              targetDate={targetDate}
              onChangeTargetDate={setTargetDate}
            />
          </View>
        )}
      </ScrollView>

      {/* Botón fijo al fondo */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className={`rounded-xl h-14 items-center justify-center ${selected ? 'bg-primary' : 'bg-surface'}`}
          onPress={handleContinue}
          disabled={!selected}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: selected ? colors.background : colors.textMuted }}>
            {t('layout.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
