import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '@/store/onboarding.store';
import { checkWeightGoalSafety } from '@/lib/weightGoalSafety';
import { useTheme } from '@/lib/theme';
import { typography } from '@/constants/typography';

type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

const GENDERS: { value: Gender; labelKey: string }[] = [
  { value: 'male',              labelKey: 'step3.genders.male' },
  { value: 'female',            labelKey: 'step3.genders.female' },
  { value: 'other',             labelKey: 'step3.genders.other' },
  { value: 'prefer_not_to_say', labelKey: 'step3.genders.preferNotToSay' },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; labelKey: string; descriptionKey: string }[] = [
  { value: 'sedentary',   labelKey: 'step3.activityLevels.sedentary.label',   descriptionKey: 'step3.activityLevels.sedentary.description' },
  { value: 'light',       labelKey: 'step3.activityLevels.light.label',       descriptionKey: 'step3.activityLevels.light.description' },
  { value: 'moderate',    labelKey: 'step3.activityLevels.moderate.label',    descriptionKey: 'step3.activityLevels.moderate.description' },
  { value: 'active',      labelKey: 'step3.activityLevels.active.label',      descriptionKey: 'step3.activityLevels.active.description' },
  { value: 'very_active', labelKey: 'step3.activityLevels.veryActive.label',  descriptionKey: 'step3.activityLevels.veryActive.description' },
];

export default function Step2Body() {
  const { t } = useTranslation('onboarding');
  const { colors } = useTheme();
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const { setStep2, targetWeightKg, targetDate, goalType } = useOnboardingStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function handleContinue() {
    if (!weight || !height || !age || !gender || !activityLevel) {
      Alert.alert(t('step3.errors.missingFields.title'), t('step3.errors.missingFields.body'));
      return;
    }
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseInt(age, 10);
    if (isNaN(w) || w < 20 || w > 300) { Alert.alert(t('step3.errors.invalidWeight.title'), t('step3.errors.invalidWeight.body')); return; }
    if (isNaN(h) || h < 100 || h > 250) { Alert.alert(t('step3.errors.invalidHeight.title'), t('step3.errors.invalidHeight.body')); return; }
    if (isNaN(a) || a < 12 || a > 100) { Alert.alert(t('step3.errors.invalidAge.title'), t('step3.errors.invalidAge.body')); return; }

    if (targetWeightKg != null && targetDate && (goalType === 'weight_loss' || goalType === 'muscle_gain')) {
      const check = checkWeightGoalSafety({
        goalType,
        currentWeightKg: w,
        targetWeightKg,
        targetDate,
      });
      if (!check.valid) {
        if (check.reasonKey === 'wrongDirection') {
          Alert.alert(t('step3.errors.wrongDirectionGoal.title'), t('step3.errors.wrongDirectionGoal.body'));
        } else {
          Alert.alert(
            t('step3.errors.unsafeGoalRate.title'),
            t('step3.errors.unsafeGoalRate.body', {
              rate: check.rateKgPerWeek?.toFixed(2),
              maxRate: check.maxSafeRateKgPerWeek?.toFixed(2),
            }),
          );
        }
        return;
      }
    }

    setStep2({ weightKg: w, heightCm: h, age: a, gender, activityLevel });
    router.push('/(auth)/onboarding/step-4-level');
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="pt-6 pb-8">
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.caption, color: colors.textMuted, marginBottom: 4 }}>
            {t('layout.stepOf', { current: 3, total: 6 })}
          </Text>
          <Text style={{ fontFamily: 'BebasNeue-Regular', fontSize: typography.sizes.screenTitle, color: colors.text }}>
            {t('step3.title')}
          </Text>
          <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.body, color: colors.textMuted, marginTop: 8 }}>
            {t('step3.subtitle')}
          </Text>
        </View>

        {/* Peso y altura en fila */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <Text className="text-text text-sm font-medium mb-2">{t('step3.weightLabel')}</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
              placeholder={t('step3.weightPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="flex-1">
            <Text className="text-text text-sm font-medium mb-2">{t('step3.heightLabel')}</Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
              placeholder={t('step3.heightPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
            />
          </View>
        </View>

        {/* Edad */}
        <View className="mb-6">
          <Text className="text-text text-sm font-medium mb-2">{t('step3.ageLabel')}</Text>
          <TextInput
            className="bg-surface border border-border rounded-xl px-4 h-14 text-text text-base"
            placeholder={t('step3.agePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
          />
        </View>

        {/* Género */}
        <View className="mb-6">
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
            {t('step3.genderLabel')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.value}
                onPress={() => setGender(g.value)}
                className={`px-4 h-10 rounded-full border items-center justify-center ${gender === g.value ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
              >
                <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: gender === g.value ? colors.primary : colors.text }}>
                  {t(g.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nivel de actividad */}
        <View className="mb-6">
          <Text style={{ fontFamily: 'SpaceGrotesk-Bold', fontSize: 16, color: colors.text, marginBottom: 12 }}>
            {t('step3.activityLabel')}
          </Text>
          <View className="gap-2">
            {ACTIVITY_LEVELS.map((level) => {
              const isSelected = activityLevel === level.value;
              return (
                <TouchableOpacity
                  key={level.value}
                  onPress={() => setActivityLevel(level.value)}
                  className={`p-3 rounded-xl border flex-row items-center gap-3 ${isSelected ? 'bg-primary-dim border-primary' : 'bg-surface border-border'}`}
                >
                  <View className="flex-1">
                    <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.bodySmall, color: isSelected ? colors.primary : colors.text }}>
                      {t(level.labelKey)}
                    </Text>
                    <Text style={{ fontFamily: 'Inter-Regular', fontSize: typography.sizes.caption, color: colors.textMuted, marginTop: 2 }}>
                      {t(level.descriptionKey)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View className="w-5 h-5 rounded-full bg-primary items-center justify-center">
                      <Ionicons name="checkmark" size={12} color={colors.background} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 bg-background border-t border-border"
        style={{ paddingBottom: insets.bottom + 16, paddingTop: 16 }}
      >
        <TouchableOpacity
          className="bg-primary rounded-xl h-14 items-center justify-center"
          onPress={handleContinue}
        >
          <Text style={{ fontFamily: 'Inter-Medium', fontSize: typography.sizes.body, color: colors.background }}>
            {t('layout.continue')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
